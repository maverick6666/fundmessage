from sqlalchemy import Column, Integer, Numeric, DateTime, Text
from sqlalchemy.sql import func

from app.database import Base


class TeamSettings(Base):
    """팀 설정 (초기 자본금 등)"""
    __tablename__ = "team_settings"

    id = Column(Integer, primary_key=True, index=True)
    initial_capital = Column(Numeric(20, 2), default=0)  # 초기 자본금
    description = Column(Text)  # 설명/메모

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
