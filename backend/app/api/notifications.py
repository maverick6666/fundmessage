from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.notification import (
    NotificationResponse, NotificationListResponse,
    NotificationMarkRead, UnreadCountResponse
)
from app.schemas.common import APIResponse
from app.services.notification_service import NotificationService
from app.dependencies import get_current_user
from app.models.user import User

router = APIRouter()


@router.get("", response_model=APIResponse)
async def get_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """사용자 알림 목록 조회"""
    notification_service = NotificationService(db)
    notifications, total, unread_count = notification_service.get_notifications(
        user_id=current_user.id,
        unread_only=unread_only,
        limit=limit,
        offset=offset
    )

    return APIResponse(
        success=True,
        data=NotificationListResponse(
            notifications=[NotificationResponse.model_validate(n) for n in notifications],
            total=total,
            unread_count=unread_count
        )
    )


@router.get("/unread-count", response_model=APIResponse)
async def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """읽지 않은 알림 수 조회"""
    notification_service = NotificationService(db)
    unread_count = notification_service.get_unread_count(current_user.id)

    return APIResponse(
        success=True,
        data=UnreadCountResponse(unread_count=unread_count)
    )


@router.patch("/read", response_model=APIResponse)
async def mark_notifications_read(
    mark_data: NotificationMarkRead,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """알림을 읽음으로 표시"""
    notification_service = NotificationService(db)
    updated = notification_service.mark_as_read(
        notification_ids=mark_data.notification_ids,
        user_id=current_user.id
    )

    return APIResponse(
        success=True,
        message=f"{updated}개의 알림을 읽음으로 표시했습니다"
    )


@router.patch("/read-all", response_model=APIResponse)
async def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """모든 알림을 읽음으로 표시"""
    notification_service = NotificationService(db)
    updated = notification_service.mark_all_as_read(current_user.id)

    return APIResponse(
        success=True,
        message=f"{updated}개의 알림을 읽음으로 표시했습니다"
    )
