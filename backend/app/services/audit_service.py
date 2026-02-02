from typing import Optional, List, Any
from sqlalchemy.orm import Session
from decimal import Decimal
import json

from app.models.audit_log import AuditLog


class AuditService:
    def __init__(self, db: Session):
        self.db = db

    def _serialize_value(self, value: Any) -> str:
        """값을 문자열로 직렬화"""
        if value is None:
            return None
        if isinstance(value, Decimal):
            return str(value)
        if isinstance(value, (list, dict)):
            return json.dumps(value, ensure_ascii=False, default=str)
        return str(value)

    def log_change(
        self,
        entity_type: str,
        entity_id: int,
        action: str,
        user_id: int,
        field_name: Optional[str] = None,
        old_value: Any = None,
        new_value: Any = None,
        changes: Optional[dict] = None
    ) -> AuditLog:
        """단일 필드 또는 여러 필드 변경 로그"""
        log = AuditLog(
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            field_name=field_name,
            old_value=self._serialize_value(old_value),
            new_value=self._serialize_value(new_value),
            changes=changes,
            user_id=user_id
        )

        self.db.add(log)
        self.db.commit()
        self.db.refresh(log)

        return log

    def log_multiple_changes(
        self,
        entity_type: str,
        entity_id: int,
        user_id: int,
        changes: dict  # {field: {old: ..., new: ...}, ...}
    ) -> AuditLog:
        """여러 필드 변경 로그"""
        # 직렬화
        serialized = {}
        for field, vals in changes.items():
            serialized[field] = {
                'old': self._serialize_value(vals.get('old')),
                'new': self._serialize_value(vals.get('new'))
            }

        return self.log_change(
            entity_type=entity_type,
            entity_id=entity_id,
            action='update',
            user_id=user_id,
            changes=serialized
        )

    def get_logs_for_entity(
        self,
        entity_type: str,
        entity_id: int,
        limit: int = 50
    ) -> List[AuditLog]:
        """특정 엔티티의 변경 이력 조회"""
        return self.db.query(AuditLog).filter(
            AuditLog.entity_type == entity_type,
            AuditLog.entity_id == entity_id
        ).order_by(AuditLog.created_at.desc()).limit(limit).all()
