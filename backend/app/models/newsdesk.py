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

    # 사용량 제한
    generation_count = Column(Integer, default=0)  # 해당 날짜 생성 횟수
    last_generated_at = Column(DateTime, nullable=True)  # 마지막 생성 시각 (KST)

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
