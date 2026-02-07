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

    # 검색 키워드 (카테고리별) - 섹터 균형 확보
    KEYWORDS = {
        # === 핵심 (매일 필수) ===
        "core": [
            "증시", "코스피", "코스닥", "나스닥", "다우지수",
            "금리", "환율", "달러", "실적", "어닝",
        ],

        # === 금융 (신규!) ===
        "finance": [
            "시중은행", "KB금융", "신한금융", "하나금융", "우리금융",
            "증권사", "미래에셋", "삼성증권", "NH투자증권",
            "카드사", "신용카드", "PG 수수료",
            "네이버페이", "카카오페이", "토스",
            "생명보험", "손해보험", "퇴직연금", "ETF",
        ],

        # === 부동산/건설 (신규!) ===
        "realestate": [
            "아파트", "분양", "청약", "전세", "월세",
            "GTX", "재개발", "재건축", "경매",
            "현대건설", "대림", "GS건설", "HDC현대산업개발",
            "부동산", "주택", "임대차",
        ],

        # === 소비재/유통 ===
        "consumer": [
            "이마트", "롯데마트", "CU", "GS25",
            "쿠팡", "배달의민족", "마켓컬리",
            "CJ제일제당", "농심", "오뚜기",
            "물가", "소비심리", "유통",
        ],

        # === 노동/고용 (신규!) ===
        "labor": [
            "고용", "실업률", "임금", "최저임금",
            "노조", "파업", "퇴직연금", "연금개혁",
            "인력난", "구인난",
        ],

        # === 엔터/게임/미디어 (신규!) ===
        "entertainment": [
            "HYBE", "SM", "JYP", "YG",
            "넥슨", "엔씨소프트", "크래프톤",
            "넷플릭스", "OTT", "콘텐츠",
        ],

        # === 가상화폐 (신규!) ===
        "crypto": [
            "비트코인", "이더리움", "빗썸", "업비트", "코인베이스",
            "가상화폐", "암호화폐", "코인",
        ],

        # === AI/반도체 (기존, 핵심만) ===
        "ai_semi": [
            "AI 반도체", "HBM", "GPU", "AI 에이전트",
            "오픈AI", "딥시크", "ChatGPT",
            "파운드리", "TSMC", "ASML",
            "엔비디아", "SK하이닉스", "삼성전자",
        ],

        # === 전기차/배터리/모빌리티 ===
        "ev_mobility": [
            "테슬라", "전기차", "배터리", "2차전지",
            "BYD", "자율주행", "로보택시",
            "현대차", "기아", "LG에너지솔루션",
        ],

        # === 바이오/헬스케어 ===
        "bio_health": [
            "바이오", "신약", "임상", "FDA 승인",
            "셀트리온", "삼성바이오", "GLP-1", "비만치료제",
        ],

        # === 에너지/방산/인프라 ===
        "energy_infra": [
            "원전", "SMR", "태양광", "수소",
            "방산", "한화에어로스페이스", "조선",
            "데이터센터", "전력망",
        ],

        # === 매크로/정책 ===
        "macro_policy": [
            "연준", "FOMC", "파월", "금리 인하",
            "인플레이션", "CPI", "고용지표",
            "중국 경기", "엔화",
            "금투세", "밸류업", "공매도",
        ],

        # === 빅테크/플랫폼 ===
        "bigtech": [
            "애플", "마이크로소프트", "구글", "아마존", "메타",
            "네이버", "카카오", "쿠팡",
        ],

        # === 이벤트/테마 ===
        "events": [
            "IPO", "공모주", "상장", "M&A", "인수합병",
            "트럼프", "관세", "무역전쟁",
            "배당", "자사주", "주주환원",
        ],
    }

    def __init__(self, db: Session):
        self.db = db
        self.naver_client_id = os.getenv("NAVER_CLIENT_ID", "")
        self.naver_client_secret = os.getenv("NAVER_CLIENT_SECRET", "")

    def collect_all(self, target_date: date) -> int:
        """모든 소스에서 뉴스 수집 (단일 날짜)"""
        total = 0

        # 네이버 키워드 검색 (메인)
        total += self._collect_naver_news(target_date)

        # 해외 뉴스 (yfinance)
        total += self._collect_yfinance_news(target_date)

        print(f"=== Total collected: {total} articles ===")
        return total

    def collect_for_morning_briefing(self, briefing_date: date) -> int:
        """아침 브리핑용 뉴스 수집 (어제 + 오늘 새벽)

        예: 2월 8일 브리핑 = 2월 7일 전체 + 2월 8일 00:00~06:00
        """
        from datetime import timedelta

        yesterday = briefing_date - timedelta(days=1)
        total = 0

        print(f"=== Collecting for {briefing_date} morning briefing ===")
        print(f"    Yesterday: {yesterday}")
        print(f"    Today early: {briefing_date}")

        # 1. 어제 뉴스 수집
        total += self._collect_naver_news(yesterday, newsdesk_date=briefing_date)
        total += self._collect_yfinance_news(yesterday, newsdesk_date=briefing_date)

        # 2. 오늘 새벽 뉴스 수집 (현재 시간까지)
        total += self._collect_naver_news(briefing_date, newsdesk_date=briefing_date)
        total += self._collect_yfinance_news(briefing_date, newsdesk_date=briefing_date)

        print(f"=== Total collected: {total} articles ===")
        return total

    def _collect_naver_news(self, target_date: date, newsdesk_date: date = None) -> int:
        """네이버 검색 API로 뉴스 수집

        Args:
            target_date: 수집할 뉴스의 발행일
            newsdesk_date: 뉴스데스크에 저장할 날짜 (기본값: target_date)
        """
        if newsdesk_date is None:
            newsdesk_date = target_date

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

                        # target_date 날짜 기사만 수집
                        pub_date = self._parse_naver_date(item.get("pubDate"))
                        if pub_date and pub_date.date() != target_date:
                            continue

                        seen_links.add(link)

                        # DB 중복 체크 (같은 뉴스데스크에 같은 링크 있는지)
                        existing = self.db.query(RawNews).filter(
                            RawNews.link == link,
                            RawNews.newsdesk_date == newsdesk_date
                        ).first()

                        if existing:
                            continue

                        news = RawNews(
                            source="naver",
                            title=self._clean_html(item.get("title", "")),
                            description=self._clean_html(item.get("description", "")),
                            link=link,
                            pub_date=pub_date,
                            newsdesk_date=newsdesk_date,
                        )
                        self.db.add(news)
                        collected += 1
                        category_count += 1

                except Exception as e:
                    print(f"Naver crawl error for '{keyword}': {e}")

            if category_count > 0:
                print(f"[{category}] {target_date}: {category_count} articles")

        self.db.commit()
        print(f"=== Naver {target_date}: {collected} articles ===")
        return collected

    def _collect_yfinance_news(self, target_date: date, newsdesk_date: date = None) -> int:
        """yfinance로 해외 뉴스 수집

        Args:
            target_date: 수집할 뉴스의 발행일
            newsdesk_date: 뉴스데스크에 저장할 날짜 (기본값: target_date)
        """
        if newsdesk_date is None:
            newsdesk_date = target_date

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
                        RawNews.newsdesk_date == newsdesk_date
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
                        newsdesk_date=newsdesk_date,
                    )
                    self.db.add(news_item)
                    collected += 1

            except Exception as e:
                print(f"yfinance error for '{ticker_symbol}': {e}")

        self.db.commit()
        print(f"=== yfinance {target_date}: {collected} articles ===")
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
