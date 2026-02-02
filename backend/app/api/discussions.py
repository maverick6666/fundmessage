from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.discussion import (
    DiscussionResponse, DiscussionClose,
    MessageCreate, MessageResponse, DiscussionMessagesResponse
)
from app.schemas.user import UserBrief
from app.schemas.common import APIResponse
from app.services.discussion_service import DiscussionService
from app.dependencies import get_current_user, get_manager_or_admin
from app.models.user import User

router = APIRouter()


def discussion_to_response(discussion, message_count: int = 0) -> DiscussionResponse:
    return DiscussionResponse(
        id=discussion.id,
        request_id=discussion.request_id,
        title=discussion.title,
        status=discussion.status,
        summary=discussion.summary,
        opened_by=UserBrief.model_validate(discussion.opener),
        closed_by=UserBrief.model_validate(discussion.closer) if discussion.closer else None,
        opened_at=discussion.opened_at,
        closed_at=discussion.closed_at,
        message_count=message_count
    )


def message_to_response(message) -> MessageResponse:
    return MessageResponse(
        id=message.id,
        discussion_id=message.discussion_id,
        user=UserBrief.model_validate(message.user),
        content=message.content,
        message_type=message.message_type,
        created_at=message.created_at
    )


@router.get("/{discussion_id}", response_model=APIResponse)
async def get_discussion(
    discussion_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get discussion detail"""
    discussion_service = DiscussionService(db)
    discussion = discussion_service.get_discussion_by_id(discussion_id)

    if not discussion:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Discussion not found"
        )

    message_count = discussion_service.get_message_count(discussion_id)

    return APIResponse(
        success=True,
        data=discussion_to_response(discussion, message_count)
    )


@router.get("/{discussion_id}/messages", response_model=APIResponse)
async def get_messages(
    discussion_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get discussion messages"""
    discussion_service = DiscussionService(db)
    messages, total = discussion_service.get_messages(discussion_id, page, limit)

    return APIResponse(
        success=True,
        data=DiscussionMessagesResponse(
            messages=[message_to_response(m) for m in messages],
            total=total,
            page=page,
            limit=limit
        )
    )


@router.post("/{discussion_id}/messages", response_model=APIResponse, status_code=201)
async def create_message(
    discussion_id: int,
    message_data: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Send a message to discussion"""
    discussion_service = DiscussionService(db)
    message = discussion_service.create_message(discussion_id, message_data, current_user.id)

    return APIResponse(
        success=True,
        data=message_to_response(message)
    )


@router.post("/{discussion_id}/close", response_model=APIResponse)
async def close_discussion(
    discussion_id: int,
    close_data: DiscussionClose,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_manager_or_admin)
):
    """Close a discussion (manager/admin only)"""
    discussion_service = DiscussionService(db)
    discussion = discussion_service.close_discussion(discussion_id, close_data, current_user.id)
    message_count = discussion_service.get_message_count(discussion_id)

    return APIResponse(
        success=True,
        data={
            **discussion_to_response(discussion, message_count).model_dump(),
            "export_url": f"/api/v1/discussions/{discussion_id}/export"
        },
        message="Discussion closed successfully"
    )


@router.post("/{discussion_id}/reopen", response_model=APIResponse)
async def reopen_discussion(
    discussion_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_manager_or_admin)
):
    """Reopen a closed discussion (manager/admin only)"""
    discussion_service = DiscussionService(db)
    discussion = discussion_service.reopen_discussion(discussion_id, current_user.id)
    message_count = discussion_service.get_message_count(discussion_id)

    return APIResponse(
        success=True,
        data=discussion_to_response(discussion, message_count),
        message="Discussion reopened successfully"
    )


@router.get("/{discussion_id}/export")
async def export_discussion(
    discussion_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Export discussion data as JSON"""
    discussion_service = DiscussionService(db)
    export_data = discussion_service.get_discussion_export(discussion_id)

    return JSONResponse(content=export_data)
