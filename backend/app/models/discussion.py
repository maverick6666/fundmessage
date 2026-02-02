from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.database import Base


class DiscussionStatus(str, enum.Enum):
    OPEN = "open"
    CLOSED = "closed"


class Discussion(Base):
    __tablename__ = "discussions"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("requests.id", ondelete="CASCADE"), nullable=True)
    position_id = Column(Integer, ForeignKey("positions.id", ondelete="CASCADE"), nullable=True)

    title = Column(String(200), nullable=False)
    status = Column(String(20), nullable=False, default=DiscussionStatus.OPEN.value, index=True)

    # Session summary
    summary = Column(Text)
    summary_by_participant = Column(JSON)  # {"user_id": "summary", ...}

    opened_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    closed_by = Column(Integer, ForeignKey("users.id"))

    opened_at = Column(DateTime(timezone=True), server_default=func.now())
    closed_at = Column(DateTime(timezone=True))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    request = relationship("Request", back_populates="discussions")
    position = relationship("Position", back_populates="discussions")
    opener = relationship("User", back_populates="opened_discussions", foreign_keys=[opened_by])
    closer = relationship("User", back_populates="closed_discussions", foreign_keys=[closed_by])
    messages = relationship("Message", back_populates="discussion", order_by="Message.created_at")
