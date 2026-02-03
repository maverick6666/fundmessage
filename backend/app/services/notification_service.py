from datetime import datetime
from typing import Optional, List
from sqlalchemy.orm import Session

from app.models.notification import Notification
from app.models.user import User, UserRole


class NotificationService:
    def __init__(self, db: Session):
        self.db = db

    def create_notification(
        self,
        user_id: int,
        notification_type: str,
        title: str,
        message: Optional[str] = None,
        related_type: Optional[str] = None,
        related_id: Optional[int] = None
    ) -> Notification:
        notification = Notification(
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            message=message,
            related_type=related_type,
            related_id=related_id
        )
        self.db.add(notification)
        self.db.commit()
        self.db.refresh(notification)
        return notification

    def create_notification_for_managers(
        self,
        notification_type: str,
        title: str,
        message: Optional[str] = None,
        related_type: Optional[str] = None,
        related_id: Optional[int] = None,
        exclude_user_id: Optional[int] = None
    ) -> List[Notification]:
        """모든 매니저와 어드민에게 알림 생성"""
        managers = self.db.query(User).filter(
            User.role.in_([UserRole.MANAGER.value, UserRole.ADMIN.value]),
            User.is_active == True
        ).all()

        notifications = []
        for manager in managers:
            if exclude_user_id and manager.id == exclude_user_id:
                continue
            notification = Notification(
                user_id=manager.id,
                notification_type=notification_type,
                title=title,
                message=message,
                related_type=related_type,
                related_id=related_id
            )
            self.db.add(notification)
            notifications.append(notification)

        self.db.commit()
        return notifications

    def get_notifications(
        self,
        user_id: int,
        unread_only: bool = False,
        limit: int = 50,
        offset: int = 0
    ) -> tuple[List[Notification], int, int]:
        """알림 목록 조회. (notifications, total, unread_count) 반환"""
        query = self.db.query(Notification).filter(Notification.user_id == user_id)

        if unread_only:
            query = query.filter(Notification.is_read == False)

        total = query.count()
        unread_count = self.db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.is_read == False
        ).count()

        notifications = query.order_by(Notification.created_at.desc()).offset(offset).limit(limit).all()

        return notifications, total, unread_count

    def get_unread_count(self, user_id: int) -> int:
        return self.db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.is_read == False
        ).count()

    def mark_as_read(self, notification_ids: List[int], user_id: int) -> int:
        """알림을 읽음으로 표시. 업데이트된 알림 수 반환"""
        updated = self.db.query(Notification).filter(
            Notification.id.in_(notification_ids),
            Notification.user_id == user_id
        ).update({"is_read": True}, synchronize_session=False)
        self.db.commit()
        return updated

    def mark_all_as_read(self, user_id: int) -> int:
        """모든 알림을 읽음으로 표시"""
        updated = self.db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.is_read == False
        ).update({"is_read": True}, synchronize_session=False)
        self.db.commit()
        return updated

    # 편의 메서드: 특정 이벤트에 대한 알림 생성

    def notify_request_approved(
        self,
        requester_id: int,
        request_id: int,
        ticker: str
    ):
        """요청 승인 알림"""
        self.create_notification(
            user_id=requester_id,
            notification_type="request_approved",
            title=f"{ticker} 매수 요청이 승인되었습니다",
            related_type="request",
            related_id=request_id
        )

    def notify_request_rejected(
        self,
        requester_id: int,
        request_id: int,
        ticker: str,
        reason: Optional[str] = None
    ):
        """요청 거부 알림"""
        message = reason if reason else None
        self.create_notification(
            user_id=requester_id,
            notification_type="request_rejected",
            title=f"{ticker} 매수 요청이 거부되었습니다",
            message=message,
            related_type="request",
            related_id=request_id
        )

    def notify_discussion_opened(
        self,
        requester_id: int,
        discussion_id: int,
        title: str,
        request_id: Optional[int] = None
    ):
        """토론 개시 알림 (요청자에게)"""
        self.create_notification(
            user_id=requester_id,
            notification_type="discussion_opened",
            title=f"토론이 시작되었습니다: {title}",
            related_type="discussion",
            related_id=discussion_id
        )

    def notify_discussion_requested(
        self,
        requester_id: int,
        requester_name: str,
        request_id: int,
        ticker: str
    ):
        """토론 요청 알림 (매니저에게)"""
        self.create_notification_for_managers(
            notification_type="discussion_requested",
            title=f"{requester_name}님이 {ticker} 관련 토론을 요청했습니다",
            related_type="request",
            related_id=request_id,
            exclude_user_id=requester_id
        )
