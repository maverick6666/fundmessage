from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.database import Base


class AlertType(str, enum.Enum):
    TAKE_PROFIT = "take_profit"
    STOP_LOSS = "stop_loss"


class PriceAlert(Base):
    __tablename__ = "price_alerts"

    id = Column(Integer, primary_key=True, index=True)
    position_id = Column(Integer, ForeignKey("positions.id", ondelete="CASCADE"), nullable=False, index=True)

    alert_type = Column(String(20), nullable=False)  # 'take_profit', 'stop_loss'
    target_price = Column(Numeric(20, 4), nullable=False)
    current_price = Column(Numeric(20, 4), nullable=False)

    notified_users = Column(JSON)  # [user_id, ...]
    is_read = Column(Boolean, default=False, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    position = relationship("Position", back_populates="price_alerts")
