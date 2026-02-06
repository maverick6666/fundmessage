from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship

from app.database import Base


class TeamColumn(Base):
    """팀 칼럼 - 팀원들이 자유롭게 작성하는 글"""
    __tablename__ = "team_columns"

    id = Column(Integer, primary_key=True, index=True)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=True)  # legacy markdown (하위 호환)
    blocks = Column(JSON, nullable=True)  # Editor.js 블록 형식
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 검증 관련 필드 (팀장/관리자가 파란 체크마크)
    is_verified = Column(Boolean, default=False)
    verified_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    verified_at = Column(DateTime, nullable=True)

    # Relationships
    author = relationship("User", back_populates="columns", foreign_keys=[author_id])
    verifier = relationship("User", foreign_keys=[verified_by])
