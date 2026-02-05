from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.database import Base


class PositionStatus(str, enum.Enum):
    OPEN = "open"
    CLOSED = "closed"


class Position(Base):
    __tablename__ = "positions"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String(20), nullable=False, index=True)
    ticker_name = Column(String(100))
    market = Column(String(20), nullable=False)  # 'KRX', 'BINANCE'

    # Position status
    status = Column(String(20), nullable=False, default=PositionStatus.OPEN.value)
    is_info_confirmed = Column(Boolean, default=False)  # 팀장이 정보 확인/수정 완료 여부

    # Buy info
    average_buy_price = Column(Numeric(20, 4))
    total_quantity = Column(Numeric(20, 8), default=0)
    total_buy_amount = Column(Numeric(20, 2), default=0)

    # Buy plan - 분할 매수 계획 [{"price": 50000, "quantity": 10, "completed": true}, ...]
    buy_plan = Column(JSON)

    # Targets (JSONB) - completed 플래그 포함
    # [{"price": 55000, "ratio": 0.5, "completed": false}, ...]
    take_profit_targets = Column(JSON)
    stop_loss_targets = Column(JSON)

    # Sell info
    average_sell_price = Column(Numeric(20, 4))
    total_sell_amount = Column(Numeric(20, 2))

    # Performance
    profit_loss = Column(Numeric(20, 2))
    profit_rate = Column(Numeric(10, 4))
    holding_period_hours = Column(Integer)

    # Audit info
    opened_at = Column(DateTime(timezone=True))
    closed_at = Column(DateTime(timezone=True))
    opened_by = Column(Integer, ForeignKey("users.id"))
    closed_by = Column(Integer, ForeignKey("users.id"))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    opener = relationship("User", back_populates="opened_positions", foreign_keys=[opened_by])
    closer = relationship("User", back_populates="closed_positions", foreign_keys=[closed_by])
    requests = relationship("Request", back_populates="position")
    price_alerts = relationship("PriceAlert", back_populates="position")
    discussions = relationship("Discussion", back_populates="position")
    decision_notes = relationship("DecisionNote", back_populates="position", order_by="DecisionNote.created_at.desc()")
