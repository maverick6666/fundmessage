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
        pass

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
        """한국 주식 시세 (Yahoo Finance 사용)"""
        try:
            # Yahoo Finance 티커 형식으로 변환
            yahoo_ticker = f"{ticker}.KS"

            loop = asyncio.get_event_loop()
            price = await loop.run_in_executor(None, self._fetch_yfinance_price, yahoo_ticker)

            # .KS로 안되면 .KQ로 시도
            if price is None:
                yahoo_ticker = f"{ticker}.KQ"
                price = await loop.run_in_executor(None, self._fetch_yfinance_price, yahoo_ticker)

            return price
        except Exception as e:
            print(f"한국 주식 시세 조회 오류: {e}")

        return None

    async def lookup_ticker(self, ticker: str, market: str) -> Optional[Dict[str, Any]]:
        """종목 코드로 종목명과 현재가 조회"""
        if market in ["KOSPI", "KOSDAQ"]:
            return await self._lookup_korean(ticker)
        elif market in ["NASDAQ", "NYSE"]:
            return await self._lookup_us(ticker)
        elif market == "CRYPTO":
            return await self._lookup_crypto(ticker)
        return None

    async def _lookup_korean(self, ticker: str) -> Optional[Dict[str, Any]]:
        """한국 주식 종목명 조회 (Yahoo Finance 사용)"""
        try:
            # Yahoo Finance 티커 형식으로 변환
            yahoo_ticker = f"{ticker}.KS"

            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(None, self._fetch_yfinance_info, yahoo_ticker)

            # .KS로 안되면 .KQ로 시도
            if result is None:
                yahoo_ticker = f"{ticker}.KQ"
                result = await loop.run_in_executor(None, self._fetch_yfinance_info, yahoo_ticker)

            if result:
                result["ticker"] = ticker  # 원래 티커로 복원

            return result
        except Exception as e:
            print(f"한국 주식 조회 오류: {e}")
        return None

    async def _lookup_us(self, ticker: str) -> Optional[Dict[str, Any]]:
        """미국 주식 종목명 조회"""
        try:
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(None, self._fetch_yfinance_info, ticker)
            return result
        except Exception as e:
            print(f"미국 주식 조회 오류: {e}")
        return None

    def _fetch_yfinance_info(self, ticker: str) -> Optional[Dict[str, Any]]:
        """Yahoo Finance에서 종목 정보 조회 (동기)"""
        try:
            stock = yf.Ticker(ticker)
            info = stock.info
            fast_info = stock.fast_info

            name = info.get("shortName") or info.get("longName") or ticker
            price = fast_info.get("lastPrice") or fast_info.get("regularMarketPrice")

            return {
                "ticker": ticker,
                "name": name,
                "price": float(price) if price else None
            }
        except Exception:
            pass
        return None

    async def _lookup_crypto(self, ticker: str) -> Optional[Dict[str, Any]]:
        """암호화폐 정보 조회"""
        try:
            symbol = ticker.upper()
            if not symbol.endswith("USDT"):
                symbol = f"{symbol}USDT"

            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://api.binance.com/api/v3/ticker/price",
                    params={"symbol": symbol}
                )

                if response.status_code == 200:
                    data = response.json()
                    price_str = data.get("price", "0")

                    # 일반적인 암호화폐 이름 매핑
                    crypto_names = {
                        "BTC": "비트코인",
                        "ETH": "이더리움",
                        "XRP": "리플",
                        "SOL": "솔라나",
                        "DOGE": "도지코인",
                        "ADA": "에이다",
                        "AVAX": "아발란체",
                        "MATIC": "폴리곤",
                        "DOT": "폴카닷",
                        "LINK": "체인링크"
                    }

                    base_symbol = ticker.upper().replace("USDT", "")
                    name = crypto_names.get(base_symbol, base_symbol)

                    return {
                        "ticker": ticker.upper(),
                        "name": name,
                        "price": float(price_str)
                    }
        except Exception as e:
            print(f"암호화폐 조회 오류: {e}")
        return None

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

    # ========== 캔들 데이터 API ==========

    async def get_candles(self, ticker: str, market: str, timeframe: str = "1d", limit: int = 100) -> Optional[Dict[str, Any]]:
        """캔들(OHLCV) 데이터 조회"""
        if market in ["KOSPI", "KOSDAQ"]:
            return await self._get_korean_candles(ticker, timeframe, limit)
        elif market in ["NASDAQ", "NYSE"]:
            return await self._get_us_candles(ticker, timeframe, limit)
        elif market == "CRYPTO":
            return await self._get_crypto_candles(ticker, timeframe, limit)
        return None

    async def _get_korean_candles(self, ticker: str, timeframe: str, limit: int) -> Optional[Dict[str, Any]]:
        """한국 주식 캔들 데이터 (Yahoo Finance 사용)"""
        try:
            # Yahoo Finance 티커 형식으로 변환 (KOSPI: .KS, KOSDAQ: .KQ)
            # 일단 .KS로 시도하고 안되면 .KQ로 시도
            yahoo_ticker = f"{ticker}.KS"

            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                self._fetch_yfinance_candles,
                yahoo_ticker, timeframe, limit
            )

            # .KS로 안되면 .KQ로 시도
            if result is None:
                yahoo_ticker = f"{ticker}.KQ"
                result = await loop.run_in_executor(
                    None,
                    self._fetch_yfinance_candles,
                    yahoo_ticker, timeframe, limit
                )

            if result:
                result["ticker"] = ticker  # 원래 티커로 복원
                result["market"] = "KOSPI"

            return result
        except Exception as e:
            print(f"한국 주식 캔들 조회 오류: {e}")
        return None

    async def _get_us_candles(self, ticker: str, timeframe: str, limit: int) -> Optional[Dict[str, Any]]:
        """미국 주식 캔들 데이터 (Yahoo Finance)"""
        try:
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                self._fetch_yfinance_candles,
                ticker, timeframe, limit
            )
            return result
        except Exception as e:
            print(f"미국 주식 캔들 조회 오류: {e}")
        return None

    def _fetch_yfinance_candles(self, ticker: str, timeframe: str, limit: int) -> Optional[Dict[str, Any]]:
        """Yahoo Finance에서 캔들 데이터 조회 (동기)"""
        try:
            stock = yf.Ticker(ticker)

            # 타임프레임에 따른 기간 설정 (더 많은 데이터 요청)
            if timeframe in ["1d", "day"]:
                # limit에 따라 기간 조정
                if limit > 500:
                    period = "5y"
                elif limit > 250:
                    period = "2y"
                elif limit > 100:
                    period = "1y"
                else:
                    period = "6mo"
                interval = "1d"
            elif timeframe in ["1w", "week"]:
                period = "10y" if limit > 200 else "5y"
                interval = "1wk"
            elif timeframe in ["1M", "month"]:
                period = "max"
                interval = "1mo"
            elif timeframe in ["1h", "hour"]:
                period = "2mo" if limit > 200 else "1mo"
                interval = "1h"
            else:
                period = "1y"
                interval = "1d"

            hist = stock.history(period=period, interval=interval)

            if hist.empty:
                return None

            # 종목명 조회
            info = stock.info
            name = info.get("shortName") or info.get("longName") or ticker

            candles = []
            for idx, row in hist.iterrows():
                timestamp = int(idx.timestamp())
                candles.append({
                    "time": timestamp,
                    "open": float(row["Open"]),
                    "high": float(row["High"]),
                    "low": float(row["Low"]),
                    "close": float(row["Close"]),
                    "volume": float(row["Volume"])
                })

            # limit 적용
            if len(candles) > limit:
                candles = candles[-limit:]

            return {
                "ticker": ticker,
                "name": name,
                "market": "US",
                "candles": candles
            }
        except Exception as e:
            print(f"yfinance 캔들 조회 오류: {e}")
        return None

    async def _get_crypto_candles(self, ticker: str, timeframe: str, limit: int) -> Optional[Dict[str, Any]]:
        """암호화폐 캔들 데이터 (Binance)"""
        try:
            symbol = ticker.upper()
            if not symbol.endswith("USDT"):
                symbol = f"{symbol}USDT"

            # 타임프레임 변환
            interval_map = {
                "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m",
                "1h": "1h", "4h": "4h", "1d": "1d", "day": "1d",
                "1w": "1w", "week": "1w", "1M": "1M", "month": "1M"
            }
            interval = interval_map.get(timeframe, "1d")

            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://api.binance.com/api/v3/klines",
                    params={
                        "symbol": symbol,
                        "interval": interval,
                        "limit": min(limit, 1000)
                    },
                    timeout=10.0
                )

                if response.status_code == 200:
                    data = response.json()

                    # 암호화폐 이름
                    crypto_names = {
                        "BTC": "비트코인", "ETH": "이더리움", "XRP": "리플",
                        "SOL": "솔라나", "DOGE": "도지코인", "ADA": "에이다"
                    }
                    base_symbol = symbol.replace("USDT", "")
                    name = crypto_names.get(base_symbol, base_symbol)

                    candles = []
                    for item in data:
                        candles.append({
                            "time": int(item[0] / 1000),  # ms -> s
                            "open": float(item[1]),
                            "high": float(item[2]),
                            "low": float(item[3]),
                            "close": float(item[4]),
                            "volume": float(item[5])
                        })

                    return {
                        "ticker": symbol,
                        "name": name,
                        "market": "CRYPTO",
                        "candles": candles
                    }
        except Exception as e:
            print(f"암호화폐 캔들 조회 오류: {e}")
        return None


# 싱글톤 인스턴스
price_service = PriceService()
