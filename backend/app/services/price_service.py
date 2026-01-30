"""
시세 조회 서비스
- 한국 주식: 한국투자증권 API
- 미국 주식: Yahoo Finance
- 암호화폐: Binance
"""
import asyncio
from decimal import Decimal
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
import httpx
import yfinance as yf
from functools import lru_cache

from app.config import settings


class PriceService:
    """통합 시세 조회 서비스"""

    # 캐시 (1분)
    _cache: Dict[str, tuple[Decimal, datetime]] = {}
    _cache_duration = timedelta(minutes=1)

    def __init__(self):
        self.kis_token: Optional[str] = None
        self.kis_token_expires: Optional[datetime] = None

    async def get_price(self, ticker: str, market: str) -> Optional[Decimal]:
        """시세 조회 (통합)"""
        cache_key = f"{market}:{ticker}"

        # 캐시 확인
        if cache_key in self._cache:
            price, cached_at = self._cache[cache_key]
            if datetime.now() - cached_at < self._cache_duration:
                return price

        # 시장별 조회
        price = None
        if market in ["KOSPI", "KOSDAQ"]:
            price = await self.get_korean_price(ticker)
        elif market in ["NASDAQ", "NYSE"]:
            price = await self.get_us_price(ticker)
        elif market == "CRYPTO":
            price = await self.get_crypto_price(ticker)

        # 캐시 저장
        if price is not None:
            self._cache[cache_key] = (price, datetime.now())

        return price

    async def get_korean_price(self, ticker: str) -> Optional[Decimal]:
        """한국 주식 시세 (한국투자증권 API)"""
        # API 키가 없으면 None 반환
        if not settings.kis_app_key or not settings.kis_app_secret:
            return None

        try:
            # 토큰 발급/갱신
            await self._ensure_kis_token()

            if not self.kis_token:
                return None

            async with httpx.AsyncClient() as client:
                headers = {
                    "content-type": "application/json; charset=utf-8",
                    "authorization": f"Bearer {self.kis_token}",
                    "appkey": settings.kis_app_key,
                    "appsecret": settings.kis_app_secret,
                    "tr_id": "FHKST01010100"  # 주식현재가 시세
                }

                params = {
                    "FID_COND_MRKT_DIV_CODE": "J",  # 주식
                    "FID_INPUT_ISCD": ticker
                }

                response = await client.get(
                    "https://openapi.koreainvestment.com:9443/uapi/domestic-stock/v1/quotations/inquire-price",
                    headers=headers,
                    params=params
                )

                if response.status_code == 200:
                    data = response.json()
                    if data.get("rt_cd") == "0":
                        price_str = data.get("output", {}).get("stck_prpr", "0")
                        return Decimal(price_str)
        except Exception as e:
            print(f"한국 주식 시세 조회 오류: {e}")

        return None

    async def _ensure_kis_token(self):
        """한투 API 토큰 발급/갱신"""
        if self.kis_token and self.kis_token_expires and datetime.now() < self.kis_token_expires:
            return

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://openapi.koreainvestment.com:9443/oauth2/tokenP",
                    json={
                        "grant_type": "client_credentials",
                        "appkey": settings.kis_app_key,
                        "appsecret": settings.kis_app_secret
                    }
                )

                if response.status_code == 200:
                    data = response.json()
                    self.kis_token = data.get("access_token")
                    expires_in = int(data.get("expires_in", 86400))
                    self.kis_token_expires = datetime.now() + timedelta(seconds=expires_in - 60)
        except Exception as e:
            print(f"한투 API 토큰 발급 오류: {e}")

    async def get_us_price(self, ticker: str) -> Optional[Decimal]:
        """미국 주식 시세 (Yahoo Finance)"""
        try:
            # yfinance는 동기 라이브러리라 executor에서 실행
            loop = asyncio.get_event_loop()
            price = await loop.run_in_executor(None, self._fetch_yfinance_price, ticker)
            return price
        except Exception as e:
            print(f"미국 주식 시세 조회 오류: {e}")
        return None

    def _fetch_yfinance_price(self, ticker: str) -> Optional[Decimal]:
        """Yahoo Finance에서 가격 조회 (동기)"""
        try:
            stock = yf.Ticker(ticker)
            info = stock.fast_info
            price = info.get("lastPrice") or info.get("regularMarketPrice")
            if price:
                return Decimal(str(price))
        except Exception:
            pass
        return None

    async def get_crypto_price(self, ticker: str) -> Optional[Decimal]:
        """암호화폐 시세 (Binance)"""
        try:
            # USDT 페어로 변환 (예: BTC -> BTCUSDT)
            symbol = ticker.upper()
            if not symbol.endswith("USDT"):
                symbol = f"{symbol}USDT"

            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"https://api.binance.com/api/v3/ticker/price",
                    params={"symbol": symbol}
                )

                if response.status_code == 200:
                    data = response.json()
                    price_str = data.get("price", "0")
                    return Decimal(price_str)
        except Exception as e:
            print(f"암호화폐 시세 조회 오류: {e}")

        return None

    async def get_multiple_prices(self, positions: list) -> Dict[int, Dict[str, Any]]:
        """여러 포지션의 시세를 한번에 조회"""
        results = {}

        tasks = []
        for pos in positions:
            tasks.append(self._get_position_price_info(pos))

        price_infos = await asyncio.gather(*tasks, return_exceptions=True)

        for pos, info in zip(positions, price_infos):
            if isinstance(info, Exception):
                results[pos.id] = {"error": str(info)}
            else:
                results[pos.id] = info

        return results

    async def _get_position_price_info(self, position) -> Dict[str, Any]:
        """포지션의 현재가 및 평가 정보"""
        current_price = await self.get_price(position.ticker, position.market)

        if current_price is None:
            return {
                "current_price": None,
                "evaluation_amount": None,
                "profit_loss": None,
                "profit_rate": None
            }

        quantity = position.total_quantity or Decimal(0)
        buy_amount = position.total_buy_amount or Decimal(0)

        evaluation_amount = current_price * quantity
        profit_loss = evaluation_amount - buy_amount
        profit_rate = (profit_loss / buy_amount) if buy_amount > 0 else Decimal(0)

        return {
            "current_price": float(current_price),
            "evaluation_amount": float(evaluation_amount),
            "profit_loss": float(profit_loss),
            "profit_rate": float(profit_rate)
        }


# 싱글톤 인스턴스
price_service = PriceService()
