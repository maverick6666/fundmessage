from datetime import datetime

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base
from app.utils.constants import KST


class Comment(Base):
    """문서 댓글 - 사이드뷰어에서 열리는 모든 문서에 대한 댓글"""
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    document_type = Column(String(50), nullable=False, index=True)  # decision_note, report, column, ai_column, news
    document_id = Column(Integer, nullable=False, index=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(KST))
    updated_at = Column(DateTime, default=lambda: datetime.now(KST), onupdate=lambda: datetime.now(KST))

    # Relationships
    user = relationship("User", back_populates="comments")
