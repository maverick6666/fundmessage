from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.database import Base


class MessageType(str, enum.Enum):
    TEXT = "text"
    SYSTEM = "system"


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    discussion_id = Column(Integer, ForeignKey("discussions.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    content = Column(Text, nullable=False)
    message_type = Column(String(20), default=MessageType.TEXT.value)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Relationships
    discussion = relationship("Discussion", back_populates="messages")
    user = relationship("User", back_populates="messages")
