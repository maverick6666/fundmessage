"""
종목 검색 서비스
- 한국 주식: PyKRX를 사용하여 종목명 검색
- 미국 주식: yfinance Search 사용
- 암호화폐: 정적 리스트 사용
"""
import asyncio
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from rapidfuzz import fuzz, process
import threading

# PyKRX는 동기 라이브러리
try:
    from pykrx import stock as pykrx_stock
    PYKRX_AVAILABLE = True
except ImportError:
    PYKRX_AVAILABLE = False
    print("Warning: pykrx not installed. Korean stock search will be limited.")

try:
    import yfinance as yf
    YFINANCE_AVAILABLE = True
except ImportError:
    YFINANCE_AVAILABLE = False


class StockSearchService:
    """종목 검색 서비스"""

    def __init__(self):
        # 한국 주식 캐시: {ticker: name}
        self._korean_stocks: Dict[str, str] = {}
        self._korean_stocks_list: List[Dict[str, str]] = []  # [{ticker, name, market}, ...]
        self._korean_cache_time: Optional[datetime] = None
        self._korean_cache_lock = threading.Lock()

        # 미국 주식 인기 종목 (빠른 검색용)
        self._us_popular_stocks = [
            {"ticker": "AAPL", "name": "Apple Inc.", "market": "NASDAQ"},
            {"ticker": "MSFT", "name": "Microsoft Corporation", "market": "NASDAQ"},
            {"ticker": "GOOGL", "name": "Alphabet Inc.", "market": "NASDAQ"},
            {"ticker": "AMZN", "name": "Amazon.com Inc.", "market": "NASDAQ"},
            {"ticker": "NVDA", "name": "NVIDIA Corporation", "market": "NASDAQ"},
            {"ticker": "META", "name": "Meta Platforms Inc.", "market": "NASDAQ"},
            {"ticker": "TSLA", "name": "Tesla Inc.", "market": "NASDAQ"},
            {"ticker": "AMD", "name": "Advanced Micro Devices", "market": "NASDAQ"},
            {"ticker": "NFLX", "name": "Netflix Inc.", "market": "NASDAQ"},
            {"ticker": "INTC", "name": "Intel Corporation", "market": "NASDAQ"},
            {"ticker": "JPM", "name": "JPMorgan Chase & Co.", "market": "NYSE"},
            {"ticker": "V", "name": "Visa Inc.", "market": "NYSE"},
            {"ticker": "JNJ", "name": "Johnson & Johnson", "market": "NYSE"},
            {"ticker": "WMT", "name": "Walmart Inc.", "market": "NYSE"},
            {"ticker": "PG", "name": "Procter & Gamble", "market": "NYSE"},
            {"ticker": "MA", "name": "Mastercard Inc.", "market": "NYSE"},
            {"ticker": "UNH", "name": "UnitedHealth Group", "market": "NYSE"},
            {"ticker": "HD", "name": "Home Depot Inc.", "market": "NYSE"},
            {"ticker": "DIS", "name": "Walt Disney Company", "market": "NYSE"},
            {"ticker": "BAC", "name": "Bank of America", "market": "NYSE"},
            {"ticker": "COST", "name": "Costco Wholesale", "market": "NASDAQ"},
            {"ticker": "AVGO", "name": "Broadcom Inc.", "market": "NASDAQ"},
            {"ticker": "ADBE", "name": "Adobe Inc.", "market": "NASDAQ"},
            {"ticker": "CRM", "name": "Salesforce Inc.", "market": "NYSE"},
            {"ticker": "ORCL", "name": "Oracle Corporation", "market": "NYSE"},
        ]

        # 암호화폐 리스트
        self._crypto_list = [
            {"ticker": "BTC", "name": "비트코인 (Bitcoin)", "market": "CRYPTO"},
            {"ticker": "ETH", "name": "이더리움 (Ethereum)", "market": "CRYPTO"},
            {"ticker": "XRP", "name": "리플 (Ripple)", "market": "CRYPTO"},
            {"ticker": "SOL", "name": "솔라나 (Solana)", "market": "CRYPTO"},
            {"ticker": "DOGE", "name": "도지코인 (Dogecoin)", "market": "CRYPTO"},
            {"ticker": "ADA", "name": "에이다 (Cardano)", "market": "CRYPTO"},
            {"ticker": "AVAX", "name": "아발란체 (Avalanche)", "market": "CRYPTO"},
            {"ticker": "DOT", "name": "폴카닷 (Polkadot)", "market": "CRYPTO"},
            {"ticker": "MATIC", "name": "폴리곤 (Polygon)", "market": "CRYPTO"},
            {"ticker": "LINK", "name": "체인링크 (Chainlink)", "market": "CRYPTO"},
            {"ticker": "UNI", "name": "유니스왑 (Uniswap)", "market": "CRYPTO"},
            {"ticker": "ATOM", "name": "코스모스 (Cosmos)", "market": "CRYPTO"},
            {"ticker": "LTC", "name": "라이트코인 (Litecoin)", "market": "CRYPTO"},
            {"ticker": "BCH", "name": "비트코인캐시 (Bitcoin Cash)", "market": "CRYPTO"},
            {"ticker": "NEAR", "name": "니어 프로토콜 (NEAR Protocol)", "market": "CRYPTO"},
            {"ticker": "APT", "name": "앱토스 (Aptos)", "market": "CRYPTO"},
            {"ticker": "ARB", "name": "아비트럼 (Arbitrum)", "market": "CRYPTO"},
            {"ticker": "OP", "name": "옵티미즘 (Optimism)", "market": "CRYPTO"},
            {"ticker": "INJ", "name": "인젝티브 (Injective)", "market": "CRYPTO"},
            {"ticker": "SUI", "name": "수이 (Sui)", "market": "CRYPTO"},
        ]

    def _load_korean_stocks_sync(self) -> None:
        """한국 주식 목록 로드 (동기)"""
        if not PYKRX_AVAILABLE:
            return

        try:
            # 오늘 날짜로 시도, 안되면 최근 영업일
            today = datetime.now().strftime("%Y%m%d")

            stocks = []

            # KOSPI 종목 조회
            try:
                kospi_tickers = pykrx_stock.get_market_ticker_list(today, market="KOSPI")
                for ticker in kospi_tickers:
                    name = pykrx_stock.get_market_ticker_name(ticker)
                    if name:
                        stocks.append({
                            "ticker": ticker,
                            "name": name,
                            "market": "KOSPI"
                        })
                        self._korean_stocks[ticker] = name
            except Exception as e:
                print(f"KOSPI 종목 로드 오류: {e}")

            # KOSDAQ 종목 조회
            try:
                kosdaq_tickers = pykrx_stock.get_market_ticker_list(today, market="KOSDAQ")
                for ticker in kosdaq_tickers:
                    name = pykrx_stock.get_market_ticker_name(ticker)
                    if name:
                        stocks.append({
                            "ticker": ticker,
                            "name": name,
                            "market": "KOSDAQ"
                        })
                        self._korean_stocks[ticker] = name
            except Exception as e:
                print(f"KOSDAQ 종목 로드 오류: {e}")

            self._korean_stocks_list = stocks
            self._korean_cache_time = datetime.now()
            print(f"한국 주식 {len(stocks)}개 로드 완료")

        except Exception as e:
            print(f"한국 주식 목록 로드 실패: {e}")

    async def load_korean_stocks(self) -> None:
        """한국 주식 목록 로드 (비동기 래퍼)"""
        # 캐시가 유효하면 스킵 (24시간)
        if self._korean_cache_time:
            if datetime.now() - self._korean_cache_time < timedelta(hours=24):
                return

        with self._korean_cache_lock:
            # 다른 스레드가 이미 로드했는지 다시 확인
            if self._korean_cache_time:
                if datetime.now() - self._korean_cache_time < timedelta(hours=24):
                    return

            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, self._load_korean_stocks_sync)

    async def search_stocks(
        self,
        query: str,
        market: Optional[str] = None,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """종목 검색 (이름 또는 티커)"""
        if not query or len(query) < 1:
            return []

        query = query.strip()
        results = []

        # 시장별 검색
        if market in ["KOSPI", "KOSDAQ", None]:
            results.extend(await self._search_korean(query, market, limit))

        if market in ["NASDAQ", "NYSE", None]:
            results.extend(await self._search_us(query, market, limit))

        if market in ["CRYPTO", None]:
            results.extend(self._search_crypto(query, limit))

        # 점수순 정렬 후 limit 적용
        results.sort(key=lambda x: x.get("score", 0), reverse=True)
        return results[:limit]

    async def _search_korean(
        self,
        query: str,
        market: Optional[str],
        limit: int
    ) -> List[Dict[str, Any]]:
        """한국 주식 검색"""
        # 캐시 로드 확인
        await self.load_korean_stocks()

        if not self._korean_stocks_list:
            return []

        results = []
        query_upper = query.upper()
        query_lower = query.lower()

        for stock in self._korean_stocks_list:
            # 시장 필터
            if market and stock["market"] != market:
                continue

            ticker = stock["ticker"]
            name = stock["name"]

            score = 0

            # 티커 정확 매칭
            if ticker == query_upper:
                score = 100
            # 티커 시작 매칭
            elif ticker.startswith(query_upper):
                score = 90
            # 이름 정확 매칭
            elif name == query:
                score = 95
            # 이름 시작 매칭
            elif name.startswith(query):
                score = 85
            # 이름에 포함
            elif query in name:
                score = 70
            # 퍼지 매칭
            else:
                fuzzy_score = fuzz.partial_ratio(query_lower, name.lower())
                if fuzzy_score >= 60:
                    score = fuzzy_score * 0.6

            if score > 0:
                results.append({
                    "ticker": ticker,
                    "name": name,
                    "market": stock["market"],
                    "score": score
                })

        # 점수순 정렬
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:limit]

    async def _search_us(
        self,
        query: str,
        market: Optional[str],
        limit: int
    ) -> List[Dict[str, Any]]:
        """미국 주식 검색"""
        results = []
        query_upper = query.upper()
        query_lower = query.lower()

        # 먼저 인기 종목에서 검색
        for stock in self._us_popular_stocks:
            if market and stock["market"] != market:
                continue

            ticker = stock["ticker"]
            name = stock["name"]

            score = 0

            if ticker == query_upper:
                score = 100
            elif ticker.startswith(query_upper):
                score = 90
            elif name.lower().startswith(query_lower):
                score = 85
            elif query_lower in name.lower():
                score = 70
            else:
                fuzzy_score = fuzz.partial_ratio(query_lower, name.lower())
                if fuzzy_score >= 60:
                    score = fuzzy_score * 0.6

            if score > 0:
                results.append({
                    "ticker": ticker,
                    "name": name,
                    "market": stock["market"],
                    "score": score
                })

        # yfinance Search 사용 (캐시된 인기 종목에서 못 찾은 경우)
        if len(results) < 5 and YFINANCE_AVAILABLE and len(query) >= 2:
            try:
                loop = asyncio.get_event_loop()
                yf_results = await loop.run_in_executor(
                    None,
                    self._yfinance_search,
                    query
                )

                # 이미 있는 종목 제외하고 추가
                existing_tickers = {r["ticker"] for r in results}
                for stock in yf_results:
                    if stock["ticker"] not in existing_tickers:
                        if not market or stock["market"] == market:
                            results.append(stock)

            except Exception as e:
                print(f"yfinance 검색 오류: {e}")

        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:limit]

    def _yfinance_search(self, query: str) -> List[Dict[str, Any]]:
        """yfinance를 사용한 검색 (동기)"""
        results = []
        try:
            search = yf.Search(query, max_results=10)
            quotes = search.quotes

            for quote in quotes:
                symbol = quote.get("symbol", "")
                name = quote.get("shortname") or quote.get("longname") or symbol
                exchange = quote.get("exchange", "")
                quote_type = quote.get("quoteType", "")

                # 주식만 필터
                if quote_type != "EQUITY":
                    continue

                # 시장 판별
                market = "NASDAQ"
                if exchange in ["NYQ", "NYSE"]:
                    market = "NYSE"
                elif exchange in ["NMS", "NGM", "NASDAQ"]:
                    market = "NASDAQ"
                else:
                    continue  # 미국 외 거래소는 스킵

                results.append({
                    "ticker": symbol,
                    "name": name,
                    "market": market,
                    "score": 60
                })

        except Exception as e:
            print(f"yfinance search error: {e}")

        return results

    def _search_crypto(self, query: str, limit: int) -> List[Dict[str, Any]]:
        """암호화폐 검색"""
        results = []
        query_upper = query.upper()
        query_lower = query.lower()

        for crypto in self._crypto_list:
            ticker = crypto["ticker"]
            name = crypto["name"]

            score = 0

            if ticker == query_upper:
                score = 100
            elif ticker.startswith(query_upper):
                score = 90
            elif query_lower in name.lower():
                score = 70
            else:
                fuzzy_score = fuzz.partial_ratio(query_lower, name.lower())
                if fuzzy_score >= 60:
                    score = fuzzy_score * 0.6

            if score > 0:
                results.append({
                    "ticker": ticker,
                    "name": name,
                    "market": "CRYPTO",
                    "score": score
                })

        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:limit]

    def get_korean_stock_name(self, ticker: str) -> Optional[str]:
        """티커로 한국 종목명 조회 (캐시에서)"""
        return self._korean_stocks.get(ticker)


# 싱글톤 인스턴스
stock_search_service = StockSearchService()
