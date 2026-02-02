from sqlalchemy import Column, Integer, Numeric, DateTime, Text, JSON
from sqlalchemy.sql import func

from app.database import Base


class TeamSettings(Base):
    """팀 설정 (초기 자본금 등)"""
    __tablename__ = "team_settings"

    id = Column(Integer, primary_key=True, index=True)

    # 초기 자본금 (원화/달러 분리)
    initial_capital_krw = Column(Numeric(20, 0), default=0)  # 원화 (소수점 없음)
    initial_capital_usd = Column(Numeric(20, 2), default=0)  # 달러 (소수점 2자리)

    # 환전 이력
    # [{"from_currency": "KRW", "to_currency": "USD", "from_amount": 1300000, "to_amount": 1000, "exchange_rate": 1300, "memo": "...", "user_id": 1, "user_name": "홍길동"}, ...]
    exchange_history = Column(JSON, default=list)

    description = Column(Text)  # 설명/메모

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
