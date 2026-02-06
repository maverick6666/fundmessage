from datetime import datetime, date
from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


class Attendance(Base):
    """출석 기록"""
    __tablename__ = "attendances"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    status = Column(String(20), default='present')  # present, absent, recovered
    recovered_by_column_id = Column(Integer, ForeignKey("team_columns.id"), nullable=True)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('user_id', 'date', name='uq_user_date'),
    )

    # Relationships
    user = relationship("User", back_populates="attendances", foreign_keys=[user_id])
    approver = relationship("User", foreign_keys=[approved_by])
    recovery_column = relationship("TeamColumn", foreign_keys=[recovered_by_column_id])
