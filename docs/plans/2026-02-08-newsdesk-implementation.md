# NewsDesk Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** AI가 매일 뉴스를 분석하여 동적 콘텐츠를 생성하는 뉴스데스크 메인 페이지 구현

**Architecture:** 백엔드에서 네이버 API + yfinance로 뉴스 수집 → GPT-5 mini로 분석/콘텐츠 생성 → DB 저장 → 프론트엔드에서 렌더링. 스케줄러로 매일 05:30에 자동 실행.

**Tech Stack:** FastAPI, SQLAlchemy, OpenAI GPT-5 mini, React, Recharts (차트), D3.js (버블), Tailwind CSS

---

## Phase 1: 백엔드 기본 구조

### Task 1: NewsDesk 모델 생성

**Files:**
- Create: `backend/app/models/newsdesk.py`
- Modify: `backend/app/models/__init__.py`

**Step 1: 모델 파일 생성**

```python
# backend/app/models/newsdesk.py
from datetime import datetime, date
from sqlalchemy import Column, Integer, String, Text, DateTime, Date, JSON, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class NewsDesk(Base):
    """일별 뉴스데스크 콘텐츠"""
    __tablename__ = "news_desks"

    id = Column(Integer, primary_key=True, index=True)
    publish_date = Column(Date, unique=True, index=True, nullable=False)

    # AI 생성 콘텐츠 (JSON)
    columns = Column(JSON, nullable=True)  # AI 칼럼 2개
    news_cards = Column(JSON, nullable=True)  # 뉴스 카드 6개
    keywords = Column(JSON, nullable=True)  # 키워드 버블 데이터
    sentiment = Column(JSON, nullable=True)  # 전체 호재/악재 비율
    top_stocks = Column(JSON, nullable=True)  # 주목 종목 3개

    # 메타 정보
    status = Column(String(20), default='pending')  # pending, generating, ready, failed
    error_message = Column(Text, nullable=True)
    raw_news_count = Column(Integer, default=0)  # 수집된 원본 뉴스 수

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class RawNews(Base):
    """수집된 원본 뉴스"""
    __tablename__ = "raw_news"

    id = Column(Integer, primary_key=True, index=True)
    source = Column(String(50), nullable=False)  # naver, yfinance
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    link = Column(String(1000), nullable=True)
    pub_date = Column(DateTime, nullable=True)
    collected_at = Column(DateTime, default=datetime.utcnow)

    # 분석 결과
    keywords = Column(JSON, nullable=True)
    sentiment = Column(String(20), nullable=True)  # positive, negative, neutral

    newsdesk_date = Column(Date, index=True)  # 어느 날짜 뉴스데스크용인지
```

**Step 2: __init__.py에 추가**

```python
# backend/app/models/__init__.py 끝에 추가
from app.models.newsdesk import NewsDesk, RawNews

# __all__ 리스트에 추가
# "NewsDesk", "RawNews"
```

**Step 3: 커밋**

```bash
git add backend/app/models/newsdesk.py backend/app/models/__init__.py
git commit -m "feat(newsdesk): add NewsDesk and RawNews models"
```

---

### Task 2: Alembic 마이그레이션 생성

**Files:**
- Create: `backend/alembic/versions/nd001_create_newsdesk_tables.py`

**Step 1: 마이그레이션 파일 생성**

```python
# backend/alembic/versions/nd001_create_newsdesk_tables.py
"""Create newsdesk tables

Revision ID: nd001
Revises: k1l2m3n4o5p6
Create Date: 2026-02-08
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'nd001'
down_revision: str = 'k1l2m3n4o5p6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'news_desks',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('publish_date', sa.Date(), nullable=False, unique=True, index=True),
        sa.Column('columns', sa.JSON(), nullable=True),
        sa.Column('news_cards', sa.JSON(), nullable=True),
        sa.Column('keywords', sa.JSON(), nullable=True),
        sa.Column('sentiment', sa.JSON(), nullable=True),
        sa.Column('top_stocks', sa.JSON(), nullable=True),
        sa.Column('status', sa.String(20), default='pending'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('raw_news_count', sa.Integer(), default=0),
        sa.Column('created_at', sa.DateTime(), default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        'raw_news',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('source', sa.String(50), nullable=False),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('link', sa.String(1000), nullable=True),
        sa.Column('pub_date', sa.DateTime(), nullable=True),
        sa.Column('collected_at', sa.DateTime(), default=sa.func.now()),
        sa.Column('keywords', sa.JSON(), nullable=True),
        sa.Column('sentiment', sa.String(20), nullable=True),
        sa.Column('newsdesk_date', sa.Date(), index=True),
    )


def downgrade() -> None:
    op.drop_table('raw_news')
    op.drop_table('news_desks')
```

**Step 2: 커밋**

```bash
git add backend/alembic/versions/nd001_create_newsdesk_tables.py
git commit -m "feat(newsdesk): add migration for newsdesk tables"
```

---

### Task 3: Pydantic 스키마 생성

**Files:**
- Create: `backend/app/schemas/newsdesk.py`

**Step 1: 스키마 파일 생성**

```python
# backend/app/schemas/newsdesk.py
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from pydantic import BaseModel


# === 키워드 버블 ===
class KeywordBubble(BaseModel):
    keyword: str
    count: int  # 언급 횟수
    sentiment: str  # positive, negative, neutral
    sentiment_ratio: Dict[str, float]  # {"positive": 0.7, "negative": 0.3}


# === 호재/악재 감성 ===
class SentimentData(BaseModel):
    positive_count: int
    negative_count: int
    neutral_count: int
    positive_ratio: float
    negative_ratio: float
    top_positive: List[str]  # 주요 호재 키워드
    top_negative: List[str]  # 주요 악재 키워드


# === 뉴스 카드 ===
class NewsCard(BaseModel):
    id: int
    title: str
    summary: str  # 썸네일용 요약 (2-3문장)
    content: str  # 상세 내용 (사이드뷰어용)
    source: str
    category: str  # 국내, 해외, AI칼럼
    keywords: List[str]
    sentiment: str
    image_url: Optional[str] = None


# === 주목 종목 ===
class TopStock(BaseModel):
    rank: int
    ticker: str
    name: str
    market: str  # KRX, NASDAQ, NYSE
    price_change: float  # 등락률
    volume: float  # 거래대금
    mention_count: int  # 뉴스 언급 횟수
    reason: str  # 왜 주목받는지 요약
    detail: str  # 상세 분석 (사이드뷰어용)
    sentiment: str
    related_news: List[str]  # 관련 뉴스 제목들


# === 뉴스데스크 전체 응답 ===
class NewsDeskResponse(BaseModel):
    id: int
    publish_date: date
    status: str

    columns: Optional[List[NewsCard]] = None
    news_cards: Optional[List[NewsCard]] = None
    keywords: Optional[List[KeywordBubble]] = None
    sentiment: Optional[SentimentData] = None
    top_stocks: Optional[List[TopStock]] = None

    raw_news_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# === 생성 요청 ===
class NewsDeskGenerateRequest(BaseModel):
    target_date: Optional[date] = None  # None이면 오늘


# === 키워드별 감성 조회 응답 ===
class KeywordSentimentResponse(BaseModel):
    keyword: str
    sentiment: SentimentData
    related_news: List[Dict[str, str]]  # title, summary
```

**Step 2: 커밋**

```bash
git add backend/app/schemas/newsdesk.py
git commit -m "feat(newsdesk): add Pydantic schemas"
```

---

### Task 4: 뉴스 크롤링 서비스 생성

**Files:**
- Create: `backend/app/services/news_crawler.py`

**Step 1: 크롤러 서비스 생성**

```python
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
```

**Step 2: 커밋**

```bash
git add backend/app/services/news_crawler.py
git commit -m "feat(newsdesk): add news crawler service"
```

---

### Task 5: AI 분석 서비스 생성

**Files:**
- Create: `backend/app/services/newsdesk_ai.py`

**Step 1: AI 분석 서비스 생성**

```python
# backend/app/services/newsdesk_ai.py
import json
from datetime import date
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
import openai

from app.config import settings
from app.models.newsdesk import NewsDesk, RawNews


class NewsDeskAI:
    """뉴스데스크 AI 분석 서비스"""

    def __init__(self, db: Session):
        self.db = db
        if settings.openai_api_key:
            self.client = openai.OpenAI(api_key=settings.openai_api_key)
        else:
            self.client = None

    def generate_newsdesk(self, target_date: date, raw_news: List[RawNews]) -> Dict[str, Any]:
        """뉴스데스크 콘텐츠 생성"""
        if not self.client:
            raise ValueError("OpenAI API key not configured")

        if not raw_news:
            raise ValueError("No news to analyze")

        # 뉴스 데이터 준비
        news_text = self._prepare_news_text(raw_news)

        # AI 호출
        prompt = self._build_prompt(target_date, news_text)

        response = self.client.chat.completions.create(
            model="gpt-5-mini",
            messages=[
                {"role": "system", "content": self._get_system_prompt()},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
        )

        content = response.choices[0].message.content
        result = json.loads(content)

        return result

    def _prepare_news_text(self, raw_news: List[RawNews]) -> str:
        """원본 뉴스를 텍스트로 변환"""
        lines = []
        for i, news in enumerate(raw_news[:50], 1):  # 최대 50개
            source_label = "국내" if news.source == "naver" else "해외"
            lines.append(f"[{i}] [{source_label}] {news.title}")
            if news.description:
                lines.append(f"    요약: {news.description[:200]}")
            lines.append("")
        return "\n".join(lines)

    def _get_system_prompt(self) -> str:
        return """당신은 금융 뉴스 분석 전문가입니다. 주어진 뉴스 목록을 분석하여 뉴스데스크 콘텐츠를 생성합니다.

## 출력 규칙
1. 반드시 유효한 JSON 형식으로 출력
2. 모든 필드를 빠짐없이 채울 것
3. 한국어로 작성 (해외 뉴스도 한국어로 번역/요약)
4. 투자 조언이 아닌 정보 전달 목적임을 명심

## 품질 기준
- 칼럼: 전문적이고 통찰력 있는 분석
- 요약: 핵심만 간결하게
- 키워드: 실제 언급된 것만 추출
- 감성: 객관적 판단"""

    def _build_prompt(self, target_date: date, news_text: str) -> str:
        return f"""# 뉴스데스크 콘텐츠 생성 요청

**날짜**: {target_date.strftime('%Y년 %m월 %d일')}

## 수집된 뉴스 목록
{news_text}

---

## 생성할 JSON 구조

```json
{{
  "columns": [
    {{
      "id": 1,
      "title": "AI 칼럼 제목 (관심을 끄는 제목)",
      "summary": "썸네일용 2-3문장 요약",
      "content": "심층 분석 내용 (500-800자, 마크다운 지원)",
      "category": "AI칼럼",
      "keywords": ["키워드1", "키워드2"],
      "sentiment": "positive|negative|neutral"
    }}
  ],
  "news_cards": [
    {{
      "id": 1,
      "title": "뉴스 제목",
      "summary": "2-3문장 요약",
      "content": "상세 내용 (300-500자)",
      "source": "출처",
      "category": "국내|해외",
      "keywords": ["키워드1"],
      "sentiment": "positive|negative|neutral"
    }}
  ],
  "keywords": [
    {{
      "keyword": "반도체",
      "count": 15,
      "sentiment": "positive",
      "sentiment_ratio": {{"positive": 0.7, "negative": 0.2, "neutral": 0.1}}
    }}
  ],
  "sentiment": {{
    "positive_count": 25,
    "negative_count": 10,
    "neutral_count": 15,
    "positive_ratio": 0.5,
    "negative_ratio": 0.2,
    "top_positive": ["반도체 호황", "실적 개선"],
    "top_negative": ["금리 인상", "환율 불안"]
  }},
  "top_stocks": [
    {{
      "rank": 1,
      "ticker": "005930",
      "name": "삼성전자",
      "market": "KRX",
      "price_change": 2.3,
      "volume": 1200000000000,
      "mention_count": 12,
      "reason": "HBM 수주 확대로 주목",
      "detail": "상세 분석 내용 (500-800자)",
      "sentiment": "positive",
      "related_news": ["삼성전자 HBM3E 양산 본격화", "엔비디아 협력 확대"]
    }}
  ]
}}
```

## 요구사항
- columns: AI 칼럼 2개 (오늘의 시장 분석)
- news_cards: 뉴스 카드 6개 (국내 3개 + 해외 3개)
- keywords: 상위 키워드 8-12개
- sentiment: 전체 시장 감성 분석
- top_stocks: 오늘 가장 많이 언급된 종목 3개

JSON만 출력하세요."""

    def save_newsdesk(self, target_date: date, content: Dict[str, Any], raw_news_count: int) -> NewsDesk:
        """생성된 콘텐츠를 DB에 저장"""
        # 기존 데이터 확인
        existing = self.db.query(NewsDesk).filter(
            NewsDesk.publish_date == target_date
        ).first()

        if existing:
            existing.columns = content.get("columns")
            existing.news_cards = content.get("news_cards")
            existing.keywords = content.get("keywords")
            existing.sentiment = content.get("sentiment")
            existing.top_stocks = content.get("top_stocks")
            existing.status = "ready"
            existing.raw_news_count = raw_news_count
            existing.error_message = None
            newsdesk = existing
        else:
            newsdesk = NewsDesk(
                publish_date=target_date,
                columns=content.get("columns"),
                news_cards=content.get("news_cards"),
                keywords=content.get("keywords"),
                sentiment=content.get("sentiment"),
                top_stocks=content.get("top_stocks"),
                status="ready",
                raw_news_count=raw_news_count,
            )
            self.db.add(newsdesk)

        self.db.commit()
        self.db.refresh(newsdesk)
        return newsdesk
```

**Step 2: 커밋**

```bash
git add backend/app/services/newsdesk_ai.py
git commit -m "feat(newsdesk): add AI content generation service"
```

---

### Task 6: API 엔드포인트 생성

**Files:**
- Create: `backend/app/api/newsdesk.py`
- Modify: `backend/app/api/__init__.py`

**Step 1: API 라우터 생성**

```python
# backend/app/api/newsdesk.py
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.newsdesk import NewsDesk
from app.models.user import User
from app.schemas.newsdesk import (
    NewsDeskResponse, NewsDeskGenerateRequest, KeywordSentimentResponse
)
from app.schemas.common import APIResponse
from app.dependencies import get_current_user
from app.services.news_crawler import NewsCrawler
from app.services.newsdesk_ai import NewsDeskAI

router = APIRouter()


@router.get("/today", response_model=APIResponse)
async def get_today_newsdesk(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """오늘의 뉴스데스크 조회"""
    today = date.today()
    newsdesk = db.query(NewsDesk).filter(
        NewsDesk.publish_date == today
    ).first()

    if not newsdesk:
        return APIResponse(
            success=True,
            data=None,
            message="오늘의 뉴스데스크가 아직 생성되지 않았습니다"
        )

    return APIResponse(
        success=True,
        data=NewsDeskResponse.model_validate(newsdesk)
    )


@router.get("/{target_date}", response_model=APIResponse)
async def get_newsdesk_by_date(
    target_date: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """특정 날짜 뉴스데스크 조회"""
    newsdesk = db.query(NewsDesk).filter(
        NewsDesk.publish_date == target_date
    ).first()

    if not newsdesk:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="해당 날짜의 뉴스데스크가 없습니다"
        )

    return APIResponse(
        success=True,
        data=NewsDeskResponse.model_validate(newsdesk)
    )


@router.post("/generate", response_model=APIResponse)
async def generate_newsdesk(
    request: NewsDeskGenerateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """뉴스데스크 생성 (수동 트리거, 팀장만)"""
    if not current_user.is_manager_or_admin():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="팀장만 뉴스데스크를 생성할 수 있습니다"
        )

    target_date = request.target_date or date.today()

    # 이미 생성 중인지 확인
    existing = db.query(NewsDesk).filter(
        NewsDesk.publish_date == target_date
    ).first()

    if existing and existing.status == "generating":
        return APIResponse(
            success=False,
            message="이미 생성 중입니다"
        )

    # 상태 업데이트
    if existing:
        existing.status = "generating"
    else:
        existing = NewsDesk(publish_date=target_date, status="generating")
        db.add(existing)
    db.commit()

    # 백그라운드에서 생성
    background_tasks.add_task(
        _generate_newsdesk_task, target_date
    )

    return APIResponse(
        success=True,
        message=f"{target_date} 뉴스데스크 생성을 시작했습니다"
    )


@router.get("/keyword/{keyword}/sentiment", response_model=APIResponse)
async def get_keyword_sentiment(
    keyword: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """특정 키워드의 호재/악재 비율 조회"""
    today = date.today()
    newsdesk = db.query(NewsDesk).filter(
        NewsDesk.publish_date == today
    ).first()

    if not newsdesk or not newsdesk.keywords:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="오늘의 뉴스데스크가 없습니다"
        )

    # 키워드 찾기
    keyword_data = None
    for kw in newsdesk.keywords:
        if kw.get("keyword") == keyword:
            keyword_data = kw
            break

    if not keyword_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"'{keyword}' 키워드를 찾을 수 없습니다"
        )

    # 관련 뉴스 필터링
    related_news = []
    all_cards = (newsdesk.columns or []) + (newsdesk.news_cards or [])
    for card in all_cards:
        if keyword in card.get("keywords", []):
            related_news.append({
                "title": card.get("title"),
                "summary": card.get("summary")
            })

    return APIResponse(
        success=True,
        data={
            "keyword": keyword,
            "sentiment": keyword_data.get("sentiment_ratio"),
            "related_news": related_news[:5]
        }
    )


def _generate_newsdesk_task(target_date: date):
    """백그라운드 뉴스데스크 생성 태스크"""
    from app.database import SessionLocal
    db = SessionLocal()

    try:
        # 1. 뉴스 수집
        crawler = NewsCrawler(db)
        count = crawler.collect_all(target_date)
        raw_news = crawler.get_raw_news(target_date)

        # 2. AI 분석
        ai = NewsDeskAI(db)
        content = ai.generate_newsdesk(target_date, raw_news)

        # 3. 저장
        ai.save_newsdesk(target_date, content, count)

    except Exception as e:
        # 에러 저장
        newsdesk = db.query(NewsDesk).filter(
            NewsDesk.publish_date == target_date
        ).first()
        if newsdesk:
            newsdesk.status = "failed"
            newsdesk.error_message = str(e)
            db.commit()
    finally:
        db.close()
```

**Step 2: __init__.py에 라우터 등록**

```python
# backend/app/api/__init__.py 에 추가

from app.api.newsdesk import router as newsdesk_router

# api_router.include_router 추가
api_router.include_router(newsdesk_router, prefix="/newsdesk", tags=["NewsDesk"])
```

**Step 3: 커밋**

```bash
git add backend/app/api/newsdesk.py backend/app/api/__init__.py
git commit -m "feat(newsdesk): add API endpoints"
```

---

## Phase 2: 프론트엔드 기본 구조

### Task 7: 프론트엔드 서비스 생성

**Files:**
- Create: `frontend/src/services/newsdeskService.js`

**Step 1: 서비스 파일 생성**

```javascript
// frontend/src/services/newsdeskService.js
import api from './api';

export const newsdeskService = {
  async getToday() {
    const response = await api.get('/newsdesk/today');
    return response.data;
  },

  async getByDate(date) {
    const response = await api.get(`/newsdesk/${date}`);
    return response.data;
  },

  async generate(targetDate = null) {
    const response = await api.post('/newsdesk/generate', {
      target_date: targetDate
    });
    return response.data;
  },

  async getKeywordSentiment(keyword) {
    const response = await api.get(`/newsdesk/keyword/${encodeURIComponent(keyword)}/sentiment`);
    return response.data;
  }
};
```

**Step 2: 커밋**

```bash
git add frontend/src/services/newsdeskService.js
git commit -m "feat(newsdesk): add frontend service"
```

---

### Task 8: NewsDesk 페이지 기본 골격 생성

**Files:**
- Create: `frontend/src/pages/NewsDesk.jsx`
- Modify: `frontend/src/App.jsx`

**Step 1: 페이지 컴포넌트 생성**

```jsx
// frontend/src/pages/NewsDesk.jsx
import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { newsdeskService } from '../services/newsdeskService';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import { formatDate } from '../utils/formatters';

export function NewsDesk() {
  const { isManager } = useAuth();
  const toast = useToast();
  const [newsdesk, setNewsdesk] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedKeyword, setSelectedKeyword] = useState(null);
  const [keywordSentiment, setKeywordSentiment] = useState(null);

  useEffect(() => {
    fetchNewsDesk();
  }, []);

  const fetchNewsDesk = async () => {
    setLoading(true);
    try {
      const result = await newsdeskService.getToday();
      if (result.success) {
        setNewsdesk(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch newsdesk:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await newsdeskService.generate();
      if (result.success) {
        toast.success(result.message);
        // 5초 후 새로고침
        setTimeout(fetchNewsDesk, 5000);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('생성 요청에 실패했습니다');
    } finally {
      setGenerating(false);
    }
  };

  const handleKeywordClick = async (keyword) => {
    setSelectedKeyword(keyword);
    try {
      const result = await newsdeskService.getKeywordSentiment(keyword);
      if (result.success) {
        setKeywordSentiment(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch keyword sentiment:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!newsdesk) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          오늘의 뉴스데스크가 아직 준비되지 않았습니다
        </h2>
        {isManager() && (
          <Button onClick={handleGenerate} loading={generating}>
            뉴스데스크 생성하기
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            뉴스데스크
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            {formatDate(newsdesk.publish_date)} · 뉴스 {newsdesk.raw_news_count}건 분석
          </p>
        </div>
        {isManager() && (
          <Button variant="secondary" onClick={handleGenerate} loading={generating}>
            새로고침
          </Button>
        )}
      </div>

      {/* TODO: 벤치마크 차트 영역 */}
      <Card>
        <CardHeader>
          <CardTitle>벤치마크 차트</CardTitle>
        </CardHeader>
        <div className="h-64 flex items-center justify-center text-gray-400">
          차트 컴포넌트 구현 예정
        </div>
      </Card>

      {/* 메인 콘텐츠 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 왼쪽: 카드 뉴스 */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            오늘의 뉴스
          </h2>
          {/* AI 칼럼 */}
          {newsdesk.columns?.map((column, i) => (
            <Card key={`column-${i}`} className="cursor-pointer hover:shadow-md transition-shadow">
              <div className="p-4">
                <span className="text-xs font-medium text-primary-600 dark:text-primary-400">
                  AI 칼럼
                </span>
                <h3 className="font-bold text-gray-900 dark:text-gray-100 mt-1">
                  {column.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  {column.summary}
                </p>
              </div>
            </Card>
          ))}
          {/* 뉴스 카드 */}
          {newsdesk.news_cards?.map((card, i) => (
            <Card key={`news-${i}`} className="cursor-pointer hover:shadow-md transition-shadow">
              <div className="p-4">
                <span className={`text-xs font-medium ${
                  card.category === '국내'
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-green-600 dark:text-green-400'
                }`}>
                  {card.category}
                </span>
                <h3 className="font-medium text-gray-900 dark:text-gray-100 mt-1">
                  {card.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                  {card.summary}
                </p>
              </div>
            </Card>
          ))}
        </div>

        {/* 오른쪽: 시각화 */}
        <div className="space-y-4">
          {/* 키워드 버블 */}
          <Card>
            <CardHeader>
              <CardTitle>키워드 버블</CardTitle>
            </CardHeader>
            <div className="p-4">
              <div className="flex flex-wrap gap-2">
                {newsdesk.keywords?.map((kw, i) => (
                  <button
                    key={i}
                    onClick={() => handleKeywordClick(kw.keyword)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      selectedKeyword === kw.keyword
                        ? 'bg-primary-600 text-white'
                        : kw.sentiment === 'positive'
                          ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400'
                          : kw.sentiment === 'negative'
                            ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                    }`}
                    style={{ fontSize: `${Math.min(14 + kw.count * 0.5, 20)}px` }}
                  >
                    {kw.keyword} ({kw.count})
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* 호재/악재 게이지 */}
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedKeyword ? `"${selectedKeyword}" 감성 분석` : '시장 감성'}
              </CardTitle>
            </CardHeader>
            <div className="p-4">
              {(() => {
                const sentiment = keywordSentiment?.sentiment || newsdesk.sentiment;
                if (!sentiment) return null;

                const positiveRatio = sentiment.positive_ratio || sentiment.positive || 0;
                const negativeRatio = sentiment.negative_ratio || sentiment.negative || 0;

                return (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-red-600 font-medium">호재</span>
                      <div className="flex-1 h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-red-500 to-red-400"
                          style={{ width: `${positiveRatio * 100}%` }}
                        />
                      </div>
                      <span className="text-blue-600 font-medium">악재</span>
                    </div>
                    <div className="text-center text-sm text-gray-500">
                      {Math.round(positiveRatio * 100)}% : {Math.round(negativeRatio * 100)}%
                    </div>
                  </div>
                );
              })()}
            </div>
          </Card>

          {/* 주목 종목 */}
          <Card>
            <CardHeader>
              <CardTitle>오늘의 주목 종목</CardTitle>
            </CardHeader>
            <div className="divide-y dark:divide-gray-700">
              {newsdesk.top_stocks?.map((stock, i) => (
                <div key={i} className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        #{stock.rank} · {stock.market}
                      </span>
                      <h4 className="font-medium text-gray-900 dark:text-gray-100">
                        {stock.name}
                      </h4>
                    </div>
                    <div className="text-right">
                      <span className={`font-bold ${
                        stock.price_change >= 0
                          ? 'text-red-600'
                          : 'text-blue-600'
                      }`}>
                        {stock.price_change >= 0 ? '+' : ''}{stock.price_change}%
                      </span>
                      <p className="text-xs text-gray-500">
                        언급 {stock.mention_count}회
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    {stock.reason}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: App.jsx에 라우트 추가**

```jsx
// frontend/src/App.jsx 상단에 import 추가
import { NewsDesk } from './pages/NewsDesk';

// Routes 안에 추가 (Dashboard 위에)
<Route
  path="/newsdesk"
  element={
    <PrivateRoute>
      <NewsDesk />
    </PrivateRoute>
  }
/>
```

**Step 3: 커밋**

```bash
git add frontend/src/pages/NewsDesk.jsx frontend/src/App.jsx
git commit -m "feat(newsdesk): add NewsDesk page component"
```

---

## Phase 3: 시각화 컴포넌트 (추후 구현)

### Task 9-12: 시각화 컴포넌트들
- Task 9: 벤치마크 차트 (토글 가능한 증시 비교)
- Task 10: 키워드 버블 차트 (D3.js 또는 recharts)
- Task 11: 감성 게이지 애니메이션
- Task 12: 사이드 뷰어 연동

---

## Phase 4: 스케줄러 & 완성

### Task 13: 스케줄러 설정
- APScheduler 또는 Celery로 05:30 자동 실행

### Task 14: 폴백 UI
- 생성 실패 시 표시할 기본 UI

### Task 15: 메인 페이지 전환
- Dashboard → NewsDesk로 메인 페이지 변경

---

## 환경 변수 추가 필요

```env
# backend/.env에 추가
NAVER_CLIENT_ID=your_naver_client_id
NAVER_CLIENT_SECRET=your_naver_client_secret
```

---

## 의존성 추가 필요

```bash
# backend
pip install yfinance apscheduler

# frontend (이미 설치됨)
# recharts, d3 (시각화용)
```
