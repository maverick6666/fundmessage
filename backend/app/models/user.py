from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.database import Base


class UserRole(str, enum.Enum):
    MANAGER = "manager"
    ADMIN = "admin"
    MEMBER = "member"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(50), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    role = Column(String(20), nullable=False, default=UserRole.MEMBER.value)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    requests = relationship("Request", back_populates="requester", foreign_keys="Request.requester_id")
    approved_requests = relationship("Request", back_populates="approver", foreign_keys="Request.approved_by")
    opened_positions = relationship("Position", back_populates="opener", foreign_keys="Position.opened_by")
    closed_positions = relationship("Position", back_populates="closer", foreign_keys="Position.closed_by")
    messages = relationship("Message", back_populates="user")
    opened_discussions = relationship("Discussion", back_populates="opener", foreign_keys="Discussion.opened_by")
    closed_discussions = relationship("Discussion", back_populates="closer", foreign_keys="Discussion.closed_by")
    notifications = relationship("Notification", back_populates="user")
    decision_notes = relationship("DecisionNote", back_populates="author")
    columns = relationship("TeamColumn", back_populates="author")
    attendances = relationship("Attendance", back_populates="user", foreign_keys="Attendance.user_id")
    trading_plans = relationship("TradingPlan", back_populates="user")

    def is_manager_or_admin(self) -> bool:
        return self.role in [UserRole.MANAGER.value, UserRole.ADMIN.value]
