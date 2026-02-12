"""Web Push 알림 발송 서비스"""
import json
from typing import Optional, List
from sqlalchemy.orm import Session

from app.models.push_subscription import PushSubscription
from app.config import settings


class PushService:
    def __init__(self, db: Session):
        self.db = db

    def subscribe(self, user_id: int, endpoint: str, p256dh: str, auth: str) -> PushSubscription:
        """Push 구독 등록 (같은 endpoint면 업데이트)"""
        existing = self.db.query(PushSubscription).filter(
            PushSubscription.endpoint == endpoint
        ).first()

        if existing:
            existing.user_id = user_id
            existing.p256dh = p256dh
            existing.auth = auth
        else:
            existing = PushSubscription(
                user_id=user_id,
                endpoint=endpoint,
                p256dh=p256dh,
                auth=auth,
            )
            self.db.add(existing)

        self.db.commit()
        self.db.refresh(existing)
        return existing

    def unsubscribe(self, user_id: int, endpoint: str) -> bool:
        """Push 구독 해제"""
        deleted = self.db.query(PushSubscription).filter(
            PushSubscription.user_id == user_id,
            PushSubscription.endpoint == endpoint,
        ).delete(synchronize_session=False)
        self.db.commit()
        return deleted > 0

    def get_subscriptions(self, user_id: int) -> List[PushSubscription]:
        """특정 사용자의 모든 Push 구독 조회"""
        return self.db.query(PushSubscription).filter(
            PushSubscription.user_id == user_id
        ).all()

    def send_push(
        self,
        user_id: int,
        title: str,
        body: str = "",
        url: str = "/",
        notification_type: str = "",
        related_type: Optional[str] = None,
        related_id: Optional[int] = None,
        tag: Optional[str] = None,
    ):
        """특정 사용자의 모든 기기에 Push 알림 발송"""
        if not settings.vapid_public_key or not settings.vapid_private_key:
            return

        subscriptions = self.get_subscriptions(user_id)
        if not subscriptions:
            return

        payload = json.dumps({
            "title": title,
            "body": body,
            "url": url,
            "notification_type": notification_type,
            "related_type": related_type,
            "related_id": related_id,
            "tag": tag or f"fm-{notification_type}",
        })

        try:
            from pywebpush import webpush, WebPushException
        except ImportError:
            print("pywebpush not installed, skipping push notification")
            return

        expired_endpoints = []
        for sub in subscriptions:
            try:
                webpush(
                    subscription_info={
                        "endpoint": sub.endpoint,
                        "keys": {
                            "p256dh": sub.p256dh,
                            "auth": sub.auth,
                        },
                    },
                    data=payload,
                    vapid_private_key=settings.vapid_private_key,
                    vapid_claims={"sub": settings.vapid_claims_email},
                )
            except WebPushException as e:
                # 410 Gone or 404 = subscription expired
                if hasattr(e, 'response') and e.response is not None:
                    status = e.response.status_code
                    if status in (404, 410):
                        expired_endpoints.append(sub.endpoint)
                print(f"Web Push error for user {user_id}: {e}")
            except Exception as e:
                print(f"Web Push unexpected error: {e}")

        # 만료된 구독 정리
        if expired_endpoints:
            self.db.query(PushSubscription).filter(
                PushSubscription.endpoint.in_(expired_endpoints)
            ).delete(synchronize_session=False)
            self.db.commit()
