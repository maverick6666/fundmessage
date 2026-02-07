from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.discussion import (
    DiscussionResponse, DiscussionClose, DiscussionCreate,
    MessageCreate, MessageResponse, DiscussionMessagesResponse
)
from app.schemas.user import UserBrief
from app.schemas.common import APIResponse
from app.services.discussion_service import DiscussionService
from app.services.notification_service import NotificationService
from app.dependencies import get_current_user, get_manager_or_admin, get_writer_user
from app.models.user import User

router = APIRouter()


def discussion_to_response(discussion, message_count: int = 0) -> DiscussionResponse:
    return DiscussionResponse(
        id=discussion.id,
        request_id=discussion.request_id,
        position_id=discussion.position_id,
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


@router.get("", response_model=APIResponse)
async def get_discussions(
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all discussions (ordered by last activity)"""
    discussion_service = DiscussionService(db)
    discussions, total = discussion_service.get_all_discussions(
        status_filter=status,
        limit=limit,
        offset=offset
    )

    result = []
    for d in discussions:
        message_count = discussion_service.get_message_count(d.id)
        last_message = discussion_service.get_last_message(d.id)

        # 관련 정보 (포지션 또는 요청)
        ticker_name = None
        ticker = None
        requester = None

        if d.position:
            ticker_name = d.position.ticker_name
            ticker = d.position.ticker
            if d.position.opener:
                requester = {
                    "id": d.position.opener.id,
                    "username": d.position.opener.username,
                    "full_name": d.position.opener.full_name
                }
        elif d.request:
            ticker_name = d.request.ticker_name
            ticker = d.request.target_ticker
            if d.request.requester:
                requester = {
                    "id": d.request.requester.id,
                    "username": d.request.requester.username,
                    "full_name": d.request.requester.full_name
                }

        result.append({
            **discussion_to_response(d, message_count).model_dump(),
            "ticker_name": ticker_name,
            "ticker": ticker,
            "requester": requester,
            "last_message": {
                "content": last_message.content[:50] + "..." if len(last_message.content) > 50 else last_message.content,
                "user": last_message.user.full_name or last_message.user.username,
                "created_at": last_message.created_at.isoformat() if last_message.created_at else None
            } if last_message else None
        })

    return APIResponse(
        success=True,
        data={
            "discussions": result,
            "total": total
        }
    )


@router.post("", response_model=APIResponse, status_code=201)
async def create_discussion(
    discussion_data: DiscussionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_manager_or_admin)
):
    """Create a new discussion (manager/admin only)"""
    discussion_service = DiscussionService(db)
    discussion = discussion_service.create_discussion(discussion_data, current_user.id)
    message_count = discussion_service.get_message_count(discussion.id)

    return APIResponse(
        success=True,
        data=discussion_to_response(discussion, message_count),
        message="Discussion created successfully"
    )


@router.get("/position/{position_id}", response_model=APIResponse)
async def get_position_discussions(
    position_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get discussions for a position"""
    discussion_service = DiscussionService(db)
    discussions = discussion_service.get_discussions_by_position_id(position_id)

    result = []
    for d in discussions:
        data = discussion_to_response(d, discussion_service.get_message_count(d.id)).model_dump()
        # 마지막 메시지 추가
        last_msg = discussion_service.get_last_message(d.id)
        data['last_message'] = last_msg.content[:100] if last_msg else None
        result.append(data)

    return APIResponse(
        success=True,
        data=result
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
    current_user: User = Depends(get_writer_user)
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


@router.post("/{discussion_id}/request-reopen", response_model=APIResponse)
async def request_reopen_discussion(
    discussion_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Request to reopen a closed discussion (for team members)"""
    discussion_service = DiscussionService(db)
    discussion = discussion_service.get_discussion_by_id(discussion_id)

    if not discussion:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Discussion not found"
        )

    if discussion.status == 'open':
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="토론이 이미 열려있습니다"
        )

    # 매니저들에게 알림 전송
    notification_service = NotificationService(db)
    notification_service.create_notification_for_managers(
        notification_type="reopen_requested",
        title=f"{current_user.full_name}님이 '{discussion.title}' 재개를 요청했습니다",
        related_type="discussion",
        related_id=discussion_id,
        exclude_user_id=current_user.id
    )

    return APIResponse(
        success=True,
        message="토론 재개 요청이 매니저에게 전송되었습니다"
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


@router.get("/{discussion_id}/sessions", response_model=APIResponse)
async def get_discussion_sessions(
    discussion_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get discussion session list (open/close periods)"""
    discussion_service = DiscussionService(db)
    sessions = discussion_service.get_discussion_sessions(discussion_id)

    return APIResponse(
        success=True,
        data={"sessions": sessions}
    )


@router.get("/{discussion_id}/export-txt", response_model=APIResponse)
async def export_discussion_txt(
    discussion_id: int,
    sessions: Optional[str] = Query(None, description="Comma-separated session numbers"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Export discussion sessions as txt content"""
    discussion_service = DiscussionService(db)
    session_numbers = None
    if sessions:
        session_numbers = [int(s.strip()) for s in sessions.split(",") if s.strip().isdigit()]

    results = discussion_service.export_discussion_txt(discussion_id, session_numbers)

    return APIResponse(
        success=True,
        data={"files": results}
    )


@router.delete("/{discussion_id}", response_model=APIResponse)
async def delete_discussion(
    discussion_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_manager_or_admin)
):
    """토론 삭제 (팀장/관리자만) - DB에서 완전 삭제"""
    from app.models.discussion import Discussion
    from app.models.message import Message

    discussion = db.query(Discussion).filter(Discussion.id == discussion_id).first()
    if not discussion:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Discussion not found"
        )

    title = discussion.title

    # 메시지 삭제
    db.query(Message).filter(Message.discussion_id == discussion_id).delete()

    # 토론 삭제
    db.delete(discussion)
    db.commit()

    return APIResponse(
        success=True,
        message=f"토론 '{title}'이(가) 삭제되었습니다"
    )


@router.delete("/{discussion_id}/sessions/{session_number}", response_model=APIResponse)
async def delete_discussion_session(
    discussion_id: int,
    session_number: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_manager_or_admin)
):
    """토론 내 특정 세션 삭제 (팀장/관리자만)

    세션은 "Discussion started/reopened"부터 "Discussion closed"까지의 기간입니다.
    해당 세션의 모든 메시지가 삭제됩니다.
    """
    from app.models.message import Message, MessageType
    from fastapi import HTTPException

    discussion_service = DiscussionService(db)
    sessions = discussion_service.get_discussion_sessions(discussion_id)

    if session_number < 1 or session_number > len(sessions):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"잘못된 세션 번호입니다. 유효 범위: 1-{len(sessions)}"
        )

    session = sessions[session_number - 1]  # 0-indexed
    start_time = session.get('started_at')
    end_time = session.get('ended_at')

    if not start_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="세션 시작 시간을 찾을 수 없습니다"
        )

    # 해당 세션의 메시지 삭제
    query = db.query(Message).filter(Message.discussion_id == discussion_id)

    # 시작 시간 이후
    from datetime import datetime
    start_dt = datetime.fromisoformat(start_time)
    query = query.filter(Message.created_at >= start_dt)

    # 종료 시간 이전 (있는 경우)
    if end_time:
        end_dt = datetime.fromisoformat(end_time)
        query = query.filter(Message.created_at <= end_dt)

    deleted_count = query.delete(synchronize_session=False)
    db.commit()

    return APIResponse(
        success=True,
        data={"deleted_messages": deleted_count},
        message=f"세션 {session_number}의 메시지 {deleted_count}개가 삭제되었습니다"
    )
