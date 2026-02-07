from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class TradingPlan(Base):
    """매매계획 이력 (계획 저장 + 체결 기록)"""
    __tablename__ = "trading_plans"

    id = Column(Integer, primary_key=True, index=True)
    position_id = Column(Integer, ForeignKey("positions.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    version = Column(Integer, default=1)

    # 이력 유형: plan_saved (계획 저장) | execution (체결 기록)
    record_type = Column(String(20), default='plan_saved')

    # === 계획 저장 (record_type='plan_saved') ===
    buy_plan = Column(JSON, nullable=True)
    take_profit_targets = Column(JSON, nullable=True)
    stop_loss_targets = Column(JSON, nullable=True)
    memo = Column(Text, nullable=True)

    # 변경 이력 (AI 컨텍스트용 JSON) - deprecated, 이제 개별 레코드로 관리
    changes = Column(JSON, nullable=True)

    # === 체결 기록 (record_type='execution') ===
    # 체결 유형: buy | take_profit | stop_loss
    plan_type = Column(String(20), nullable=True)
    # 몇 번째 체결인지 (1차 익절, 2차 익절 등)
    execution_index = Column(Integer, nullable=True)
    # 계획했던 가격/수량
    target_price = Column(Numeric(20, 8), nullable=True)
    target_quantity = Column(Numeric(20, 8), nullable=True)
    # 실제 체결 가격/수량
    executed_price = Column(Numeric(20, 8), nullable=True)
    executed_quantity = Column(Numeric(20, 8), nullable=True)
    # 체결 금액
    executed_amount = Column(Numeric(20, 2), nullable=True)
    # 실현 손익 (익절/손절만)
    profit_loss = Column(Numeric(20, 2), nullable=True)
    profit_rate = Column(Numeric(10, 6), nullable=True)

    # 상태
    status = Column(String(20), default='draft')  # draft, submitted

    created_at = Column(DateTime, default=datetime.utcnow)
    submitted_at = Column(DateTime, nullable=True)

    # 관계
    position = relationship("Position", back_populates="trading_plans")
    user = relationship("User", back_populates="trading_plans")
