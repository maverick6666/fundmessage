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
        """한국 주식 시세 (네이버 금융)"""
        try:
            async with httpx.AsyncClient() as client:
                # 네이버 금융 모바일 API (15분 지연)
                response = await client.get(
                    f"https://m.stock.naver.com/api/stock/{ticker}/basic",
                    headers={
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                    },
                    timeout=10.0
                )

                if response.status_code == 200:
                    data = response.json()
                    # 현재가 추출
                    current_price = data.get("stockEndPrice") or data.get("closePrice")
                    if current_price:
                        return Decimal(str(current_price))
        except Exception as e:
            print(f"네이버 금융 시세 조회 오류: {e}")

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
        """한국 주식 종목명 조회"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"https://m.stock.naver.com/api/stock/{ticker}/basic",
                    headers={
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                    },
                    timeout=10.0
                )

                if response.status_code == 200:
                    data = response.json()
                    name = data.get("stockName") or data.get("name")
                    price_str = data.get("closePrice") or data.get("stockEndPrice")

                    # 콤마 제거 후 숫자 변환
                    price = None
                    if price_str:
                        try:
                            price = float(str(price_str).replace(",", ""))
                        except ValueError:
                            pass

                    if name:
                        return {
                            "ticker": ticker,
                            "name": name,
                            "price": price
                        }
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

    def _parse_korean_price(self, value) -> float:
        """한국 주식 가격 파싱 (콤마 제거)"""
        if value is None:
            return 0.0
        try:
            return float(str(value).replace(",", ""))
        except (ValueError, TypeError):
            return 0.0

    async def _get_korean_candles(self, ticker: str, timeframe: str, limit: int) -> Optional[Dict[str, Any]]:
        """한국 주식 캔들 데이터 (네이버 금융)"""
        try:
            # 타임프레임 변환
            if timeframe in ["1d", "day"]:
                chart_type = "day"
            elif timeframe in ["1w", "week"]:
                chart_type = "week"
            elif timeframe in ["1M", "month"]:
                chart_type = "month"
            else:
                chart_type = "day"

            async with httpx.AsyncClient() as client:
                # 종목 정보 조회
                info_response = await client.get(
                    f"https://m.stock.naver.com/api/stock/{ticker}/basic",
                    headers={"User-Agent": "Mozilla/5.0"},
                    timeout=10.0
                )

                name = ticker
                if info_response.status_code == 200:
                    info_data = info_response.json()
                    name = info_data.get("stockName") or info_data.get("name") or ticker

                # 차트 데이터 조회
                response = await client.get(
                    f"https://m.stock.naver.com/api/stock/{ticker}/price",
                    params={"pageSize": limit, "type": chart_type},
                    headers={"User-Agent": "Mozilla/5.0"},
                    timeout=10.0
                )

                if response.status_code == 200:
                    data = response.json()
                    candles = []

                    for item in data:
                        try:
                            # 날짜 파싱 (YYYY-MM-DD 또는 YYYYMMDD 형식)
                            date_str = item.get("localTradedAt") or item.get("localDate", "")
                            if not date_str:
                                continue

                            # ISO 형식 (2026-01-30) 또는 YYYYMMDD
                            date_str = str(date_str)[:10]  # 시간 부분 제거
                            if "-" in date_str:
                                dt = datetime.strptime(date_str, "%Y-%m-%d")
                            elif len(date_str) == 8:
                                dt = datetime.strptime(date_str, "%Y%m%d")
                            else:
                                continue

                            timestamp = int(dt.timestamp())

                            candles.append({
                                "time": timestamp,
                                "open": self._parse_korean_price(item.get("openPrice")),
                                "high": self._parse_korean_price(item.get("highPrice")),
                                "low": self._parse_korean_price(item.get("lowPrice")),
                                "close": self._parse_korean_price(item.get("closePrice")),
                                "volume": float(item.get("accumulatedTradingVolume", 0))
                            })
                        except (ValueError, TypeError) as e:
                            print(f"캔들 파싱 오류: {e}, item: {item}")
                            continue

                    # 시간순 정렬 (오래된 것 먼저)
                    candles.sort(key=lambda x: x["time"])

                    return {
                        "ticker": ticker,
                        "name": name,
                        "market": "KOSPI",
                        "candles": candles
                    }
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

            # 타임프레임에 따른 기간 설정
            if timeframe in ["1d", "day"]:
                period = "1y" if limit > 100 else "6mo"
                interval = "1d"
            elif timeframe in ["1w", "week"]:
                period = "5y"
                interval = "1wk"
            elif timeframe in ["1M", "month"]:
                period = "max"
                interval = "1mo"
            elif timeframe in ["1h", "hour"]:
                period = "1mo"
                interval = "1h"
            else:
                period = "6mo"
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
