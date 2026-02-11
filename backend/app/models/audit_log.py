from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class AuditLog(Base):
    """수정 이력 로그"""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)

    # 대상 정보
    entity_type = Column(String(50), nullable=False)  # 'position', 'request', 'discussion'
    entity_id = Column(Integer, nullable=False, index=True)

    # 변경 정보
    action = Column(Text, nullable=False)  # 'create', 'update', 'delete', 'toggle', 매매계획 변경사항 등
    field_name = Column(String(100))  # 변경된 필드명
    old_value = Column(Text)  # 이전 값
    new_value = Column(Text)  # 새 값
    changes = Column(JSON)  # 여러 필드 변경 시 {field: {old, new}, ...}

    # 수행자 정보
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", backref="audit_logs")
