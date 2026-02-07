# backend/app/services/news_crawler.py
import os
import re
import requests
from datetime import datetime, date
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.models.newsdesk import RawNews
from app.config import settings


class NewsCrawler:
    """뉴스 수집 서비스 - 네이버 검색 API + yfinance"""

    # 검색 키워드 (카테고리별)
    KEYWORDS = {
        # 국내 시장
        "market_kr": [
            "코스피", "코스닥", "증시", "주식시장", "국내증시",
            "외국인 매수", "기관 매도", "개인투자자",
        ],
        # 해외 시장
        "market_us": [
            "나스닥", "S&P500", "다우존스", "미국증시", "뉴욕증시",
            "월가", "미국 선물",
        ],
        # 매크로/금리
        "macro": [
            "금리", "기준금리", "연준", "FOMC", "파월",
            "인플레이션", "CPI", "고용지표",
            "환율", "달러", "엔화", "유로",
        ],
        # 빅테크/해외 종목
        "bigtech": [
            "엔비디아", "테슬라", "애플", "마이크로소프트", "아마존",
            "구글", "메타", "넷플릭스", "AMD", "인텔",
        ],
        # 국내 대형주
        "kr_large": [
            "삼성전자", "SK하이닉스", "현대차", "기아", "LG에너지솔루션",
            "삼성바이오", "셀트리온", "POSCO", "네이버", "카카오",
        ],
        # 섹터
        "sector": [
            "반도체", "2차전지", "배터리", "AI 반도체", "HBM",
            "바이오", "제약", "자동차", "조선", "방산",
            "태양광", "풍력", "원전", "우주항공",
        ],
        # 이슈/테마
        "theme": [
            "IPO", "공모주", "상장", "실적", "어닝",
            "배당", "자사주", "M&A", "인수합병",
            "트럼프", "관세", "무역전쟁",
        ],
    }

    def __init__(self, db: Session):
        self.db = db
        self.naver_client_id = os.getenv("NAVER_CLIENT_ID", "")
        self.naver_client_secret = os.getenv("NAVER_CLIENT_SECRET", "")

    def collect_all(self, target_date: date) -> int:
        """모든 소스에서 뉴스 수집"""
        total = 0

        # 네이버 키워드 검색 (메인)
        total += self._collect_naver_news(target_date)

        # 해외 뉴스 (yfinance)
        total += self._collect_yfinance_news(target_date)

        print(f"=== Total collected: {total} articles ===")
        return total

    def _collect_naver_news(self, target_date: date) -> int:
        """네이버 검색 API로 뉴스 수집 (키워드 대폭 확대)"""
        if not self.naver_client_id or not self.naver_client_secret:
            print("NAVER API credentials not set")
            return 0

        collected = 0
        seen_links = set()  # 중복 제거용

        for category, keywords in self.KEYWORDS.items():
            category_count = 0

            for keyword in keywords:
                try:
                    url = "https://openapi.naver.com/v1/search/news.json"
                    headers = {
                        "X-Naver-Client-Id": self.naver_client_id,
                        "X-Naver-Client-Secret": self.naver_client_secret,
                    }
                    params = {
                        "query": keyword,
                        "display": 10,  # 키워드당 10개
                        "sort": "date",
                    }

                    response = requests.get(url, headers=headers, params=params, timeout=10)
                    if response.status_code != 200:
                        continue

                    data = response.json()
                    for item in data.get("items", []):
                        link = item.get("link", "")

                        # 이미 수집한 링크면 스킵
                        if link in seen_links:
                            continue
                        seen_links.add(link)

                        # DB 중복 체크
                        existing = self.db.query(RawNews).filter(
                            RawNews.link == link,
                            RawNews.newsdesk_date == target_date
                        ).first()

                        if existing:
                            continue

                        news = RawNews(
                            source="naver",
                            title=self._clean_html(item.get("title", "")),
                            description=self._clean_html(item.get("description", "")),
                            link=link,
                            pub_date=self._parse_naver_date(item.get("pubDate")),
                            newsdesk_date=target_date,
                        )
                        self.db.add(news)
                        collected += 1
                        category_count += 1

                except Exception as e:
                    print(f"Naver crawl error for '{keyword}': {e}")

            print(f"[{category}] Collected {category_count} articles")

        self.db.commit()
        print(f"=== Naver total: {collected} articles ===")
        return collected

    def _collect_yfinance_news(self, target_date: date) -> int:
        """yfinance로 해외 뉴스 수집"""
        try:
            import yfinance as yf
        except ImportError:
            print("yfinance not installed")
            return 0

        tickers = ["^GSPC", "^IXIC", "AAPL", "NVDA", "TSLA", "MSFT", "GOOGL", "AMZN"]
        collected = 0
        seen_links = set()

        for ticker_symbol in tickers:
            try:
                ticker = yf.Ticker(ticker_symbol)
                news = ticker.news or []

                for item in news[:5]:  # 각 티커당 최대 5개
                    # 새로운 yfinance 구조: item['content'] 안에 데이터
                    content = item.get("content", {})
                    if not content:
                        continue

                    title = content.get("title", "")
                    if not title:
                        continue

                    # URL 추출
                    canonical = content.get("canonicalUrl", {})
                    link = canonical.get("url", "") if canonical else ""
                    if not link:
                        click_through = content.get("clickThroughUrl", {})
                        link = click_through.get("url", "") if click_through else ""

                    if not link or link in seen_links:
                        continue
                    seen_links.add(link)

                    # DB 중복 체크
                    existing = self.db.query(RawNews).filter(
                        RawNews.link == link,
                        RawNews.newsdesk_date == target_date
                    ).first()

                    if existing:
                        continue

                    # 날짜 파싱
                    pub_date_str = content.get("pubDate", "")
                    pub_date = None
                    if pub_date_str:
                        try:
                            pub_date = datetime.fromisoformat(pub_date_str.replace("Z", "+00:00"))
                        except:
                            pass

                    summary = content.get("summary", "") or ""

                    news_item = RawNews(
                        source="yfinance",
                        title=title,
                        description=summary[:500] if summary else None,
                        link=link,
                        pub_date=pub_date,
                        newsdesk_date=target_date,
                    )
                    self.db.add(news_item)
                    collected += 1

            except Exception as e:
                print(f"yfinance error for '{ticker_symbol}': {e}")

        self.db.commit()
        print(f"=== yfinance total: {collected} articles ===")
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
