from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, JSON, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.database import Base


class RequestType(str, enum.Enum):
    BUY = "buy"
    SELL = "sell"


class RequestStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    DISCUSSION = "discussion"


class Request(Base):
    __tablename__ = "requests"

    id = Column(Integer, primary_key=True, index=True)
    position_id = Column(Integer, ForeignKey("positions.id", ondelete="CASCADE"), nullable=True)
    requester_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Request type
    request_type = Column(String(20), nullable=False)  # 'buy', 'sell'

    # Buy request info
    target_ticker = Column(String(20))
    ticker_name = Column(String(100))  # 종목명
    target_market = Column(String(20))  # KOSPI, KOSDAQ, NASDAQ, NYSE, CRYPTO
    order_type = Column(String(20))  # 'amount' or 'quantity'
    order_amount = Column(Numeric(20, 4))  # 매수 금액
    order_quantity = Column(Numeric(20, 8))  # 매수 수량
    buy_price = Column(Numeric(20, 4))  # 매수 희망가 (null이면 시장가)
    buy_orders = Column(JSON)  # [{"price": 50000, "ratio": 0.3}, ...] - legacy
    target_ratio = Column(Numeric(5, 4))  # Portfolio ratio - legacy
    take_profit_targets = Column(JSON)
    stop_loss_targets = Column(JSON)
    memo = Column(Text)  # 메모

    # Sell request info
    sell_quantity = Column(Numeric(20, 8))
    sell_price = Column(Numeric(20, 4))
    sell_reason = Column(Text)

    # Approval info
    status = Column(String(20), nullable=False, default=RequestStatus.PENDING.value, index=True)
    approved_by = Column(Integer, ForeignKey("users.id"))
    approved_at = Column(DateTime(timezone=True))
    rejection_reason = Column(Text)

    # Execution info (manager input after trade)
    executed_price = Column(Numeric(20, 4))
    executed_quantity = Column(Numeric(20, 8))
    executed_at = Column(DateTime(timezone=True))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    position = relationship("Position", back_populates="requests")
    requester = relationship("User", back_populates="requests", foreign_keys=[requester_id])
    approver = relationship("User", back_populates="approved_requests", foreign_keys=[approved_by])
    discussions = relationship("Discussion", back_populates="request")
