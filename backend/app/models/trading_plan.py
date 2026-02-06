from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class TradingPlan(Base):
    """매매계획 스냅샷 (버전 관리)"""
    __tablename__ = "trading_plans"

    id = Column(Integer, primary_key=True, index=True)
    position_id = Column(Integer, ForeignKey("positions.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    version = Column(Integer, default=1)

    # 계획 데이터 (스냅샷)
    buy_plan = Column(JSON, nullable=True)
    take_profit_targets = Column(JSON, nullable=True)
    stop_loss_targets = Column(JSON, nullable=True)
    memo = Column(Text, nullable=True)

    # 상태
    status = Column(String(20), default='draft')  # draft, submitted

    created_at = Column(DateTime, default=datetime.utcnow)
    submitted_at = Column(DateTime, nullable=True)

    # 관계
    position = relationship("Position", back_populates="trading_plans")
    user = relationship("User", back_populates="trading_plans")
