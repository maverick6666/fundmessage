# backend/app/services/news_crawler.py
import os
import requests
from datetime import datetime, date
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.models.newsdesk import RawNews
from app.config import settings


class NewsCrawler:
    """뉴스 수집 서비스"""

    def __init__(self, db: Session):
        self.db = db
        self.naver_client_id = os.getenv("NAVER_CLIENT_ID", "")
        self.naver_client_secret = os.getenv("NAVER_CLIENT_SECRET", "")

    def collect_all(self, target_date: date) -> int:
        """모든 소스에서 뉴스 수집"""
        total = 0

        # 국내 뉴스
        total += self._collect_naver_news(target_date)

        # 해외 뉴스
        total += self._collect_yfinance_news(target_date)

        return total

    def _collect_naver_news(self, target_date: date) -> int:
        """네이버 검색 API로 국내 뉴스 수집"""
        if not self.naver_client_id or not self.naver_client_secret:
            print("NAVER API credentials not set")
            return 0

        keywords = ["증시", "코스피", "주식시장", "반도체", "금리", "환율"]
        collected = 0

        for keyword in keywords:
            try:
                url = "https://openapi.naver.com/v1/search/news.json"
                headers = {
                    "X-Naver-Client-Id": self.naver_client_id,
                    "X-Naver-Client-Secret": self.naver_client_secret,
                }
                params = {
                    "query": keyword,
                    "display": 10,
                    "sort": "date",
                }

                response = requests.get(url, headers=headers, params=params, timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    for item in data.get("items", []):
                        # 중복 체크
                        existing = self.db.query(RawNews).filter(
                            RawNews.link == item.get("link"),
                            RawNews.newsdesk_date == target_date
                        ).first()

                        if not existing:
                            news = RawNews(
                                source="naver",
                                title=self._clean_html(item.get("title", "")),
                                description=self._clean_html(item.get("description", "")),
                                link=item.get("link"),
                                pub_date=self._parse_naver_date(item.get("pubDate")),
                                newsdesk_date=target_date,
                            )
                            self.db.add(news)
                            collected += 1

            except Exception as e:
                print(f"Naver crawl error for '{keyword}': {e}")

        self.db.commit()
        return collected

    def _collect_yfinance_news(self, target_date: date) -> int:
        """yfinance로 해외 뉴스 수집"""
        try:
            import yfinance as yf
        except ImportError:
            print("yfinance not installed")
            return 0

        tickers = ["^GSPC", "^IXIC", "AAPL", "NVDA", "TSLA", "MSFT"]
        collected = 0

        for ticker_symbol in tickers:
            try:
                ticker = yf.Ticker(ticker_symbol)
                news = ticker.news or []

                for item in news[:5]:  # 각 티커당 최대 5개
                    existing = self.db.query(RawNews).filter(
                        RawNews.link == item.get("link"),
                        RawNews.newsdesk_date == target_date
                    ).first()

                    if not existing:
                        pub_timestamp = item.get("providerPublishTime", 0)
                        pub_date = datetime.fromtimestamp(pub_timestamp) if pub_timestamp else None

                        news_item = RawNews(
                            source="yfinance",
                            title=item.get("title", ""),
                            description=item.get("summary", "")[:500] if item.get("summary") else None,
                            link=item.get("link"),
                            pub_date=pub_date,
                            newsdesk_date=target_date,
                        )
                        self.db.add(news_item)
                        collected += 1

            except Exception as e:
                print(f"yfinance error for '{ticker_symbol}': {e}")

        self.db.commit()
        return collected

    def _clean_html(self, text: str) -> str:
        """HTML 태그 제거"""
        import re
        clean = re.sub(r'<[^>]+>', '', text)
        clean = clean.replace("&quot;", '"').replace("&amp;", "&")
        clean = clean.replace("&lt;", "<").replace("&gt;", ">")
        return clean.strip()

    def _parse_naver_date(self, date_str: str) -> Optional[datetime]:
        """네이버 날짜 파싱"""
        if not date_str:
            return None
        try:
            # "Sat, 08 Feb 2026 10:30:00 +0900" 형식
            from email.utils import parsedate_to_datetime
            return parsedate_to_datetime(date_str)
        except:
            return None

    def get_raw_news(self, target_date: date) -> List[RawNews]:
        """특정 날짜의 수집된 뉴스 조회"""
        return self.db.query(RawNews).filter(
            RawNews.newsdesk_date == target_date
        ).order_by(RawNews.pub_date.desc()).all()
