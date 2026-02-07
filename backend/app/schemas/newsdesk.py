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
