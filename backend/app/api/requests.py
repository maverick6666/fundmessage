from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.request import (
    BuyRequestCreate, SellRequestCreate, RequestResponse,
    RequestApprove, RequestReject, RequestDiscuss, RequestListResponse
)
from app.schemas.user import UserBrief
from app.schemas.position import PositionBrief
from app.schemas.discussion import DiscussionCreate, DiscussionResponse
from app.schemas.common import APIResponse
from app.services.request_service import RequestService
from app.services.discussion_service import DiscussionService
from app.services.notification_service import NotificationService
from app.dependencies import get_current_user, get_manager_or_admin, get_writer_user
from app.models.user import User

router = APIRouter()


def request_to_response(request) -> RequestResponse:
    approver = None
    if request.approver:
        approver = UserBrief.model_validate(request.approver)

    position = None
    if request.position:
        # 남은 계획 수 계산
        remaining_buys = 0
        remaining_tps = 0
        remaining_sls = 0
        if request.position.buy_plan:
            remaining_buys = sum(1 for b in request.position.buy_plan if not b.get('completed', False))
        if request.position.take_profit_targets:
            remaining_tps = sum(1 for t in request.position.take_profit_targets if not t.get('completed', False))
        if request.position.stop_loss_targets:
            remaining_sls = sum(1 for s in request.position.stop_loss_targets if not s.get('completed', False))

        position = PositionBrief(
            id=request.position.id,
            ticker=request.position.ticker,
            ticker_name=request.position.ticker_name,
            market=request.position.market,
            status=request.position.status,
            is_info_confirmed=request.position.is_info_confirmed,
            average_buy_price=request.position.average_buy_price,
            total_quantity=request.position.total_quantity,
            total_buy_amount=request.position.total_buy_amount,
            remaining_buys=remaining_buys,
            remaining_take_profits=remaining_tps,
            remaining_stop_losses=remaining_sls
        )

    # 토론중인 경우 가장 최근 discussion의 id를 가져옴
    discussion_id = None
    if request.discussions:
        # 가장 최근 토론 (open 상태 우선)
        open_discussions = [d for d in request.discussions if d.status == 'open']
        if open_discussions:
            discussion_id = open_discussions[-1].id
        elif request.discussions:
            discussion_id = request.discussions[-1].id

    return RequestResponse(
        id=request.id,
        position_id=request.position_id,
        request_type=request.request_type,
        target_ticker=request.target_ticker,
        ticker_name=request.ticker_name,
        target_market=request.target_market,
        order_type=request.order_type,
        order_amount=request.order_amount,
        order_quantity=request.order_quantity,
        buy_price=request.buy_price,
        buy_orders=request.buy_orders,
        target_ratio=request.target_ratio,
        take_profit_targets=request.take_profit_targets,
        stop_loss_targets=request.stop_loss_targets,
        memo=request.memo,
        sell_quantity=request.sell_quantity,
        sell_price=request.sell_price,
        sell_reason=request.sell_reason,
        status=request.status,
        requester=UserBrief.model_validate(request.requester),
        approved_by=approver,
        approved_at=request.approved_at,
        rejection_reason=request.rejection_reason,
        executed_price=request.executed_price,
        executed_quantity=request.executed_quantity,
        executed_at=request.executed_at,
        created_at=request.created_at,
        position=position,
        discussion_id=discussion_id
    )


@router.post("/buy", response_model=APIResponse, status_code=201)
async def create_buy_request(
    request_data: BuyRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_writer_user)
):
    """Create a buy request"""
    request_service = RequestService(db)
    request = request_service.create_buy_request(request_data, current_user.id)

    # 매니저에게 새 요청 알림
    notification_service = NotificationService(db)
    notification_service.notify_new_request(
        requester_id=current_user.id,
        requester_name=current_user.full_name,
        request_id=request.id,
        ticker=request_data.target_ticker,
        request_type="buy"
    )

    return APIResponse(
        success=True,
        data={"request": request_to_response(request)},
        message="Buy request created successfully"
    )


@router.post("/sell", response_model=APIResponse, status_code=201)
async def create_sell_request(
    request_data: SellRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_writer_user)
):
    """Create a sell request"""
    request_service = RequestService(db)
    request = request_service.create_sell_request(request_data, current_user.id)

    # 매니저에게 새 요청 알림
    notification_service = NotificationService(db)
    notification_service.notify_new_request(
        requester_id=current_user.id,
        requester_name=current_user.full_name,
        request_id=request.id,
        ticker=request_data.target_ticker,
        request_type="sell"
    )

    return APIResponse(
        success=True,
        data={"request": request_to_response(request)},
        message="Sell request created successfully"
    )


@router.get("", response_model=APIResponse)
async def get_requests(
    status: Optional[str] = None,
    request_type: Optional[str] = None,
    requester_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get requests list"""
    request_service = RequestService(db)
    requests, total = request_service.get_requests(
        status=status,
        request_type=request_type,
        requester_id=requester_id,
        page=page,
        limit=limit
    )

    return APIResponse(
        success=True,
        data=RequestListResponse(
            requests=[request_to_response(r) for r in requests],
            total=total,
            page=page,
            limit=limit
        )
    )


@router.get("/{request_id}", response_model=APIResponse)
async def get_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get request detail"""
    request_service = RequestService(db)
    request = request_service.get_request_by_id(request_id)

    if not request:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found"
        )

    return APIResponse(
        success=True,
        data=request_to_response(request)
    )


@router.post("/{request_id}/approve", response_model=APIResponse)
async def approve_request(
    request_id: int,
    approve_data: RequestApprove,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_manager_or_admin)
):
    """Approve a request (manager/admin only)"""
    request_service = RequestService(db)
    request, position = request_service.approve_request(request_id, approve_data, current_user.id)

    # 요청자에게 알림 전송 (본인 요청이 아닌 경우에만)
    if request.requester_id != current_user.id:
        notification_service = NotificationService(db)
        notification_service.notify_request_approved(
            requester_id=request.requester_id,
            request_id=request.id,
            ticker=request.target_ticker,
            position_id=position.id if position else None
        )

    response_data = {
        "request": request_to_response(request)
    }

    if position:
        response_data["position"] = {
            "id": position.id,
            "ticker": position.ticker,
            "status": position.status,
            "average_buy_price": float(position.average_buy_price) if position.average_buy_price else None,
            "total_quantity": float(position.total_quantity) if position.total_quantity else None
        }

    return APIResponse(
        success=True,
        data=response_data,
        message="Request approved and position updated"
    )


@router.post("/{request_id}/reject", response_model=APIResponse)
async def reject_request(
    request_id: int,
    reject_data: RequestReject,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_manager_or_admin)
):
    """Reject a request (manager/admin only)"""
    request_service = RequestService(db)
    request = request_service.reject_request(request_id, reject_data.rejection_reason, current_user.id)

    # 요청자에게 알림 전송 (본인 요청이 아닌 경우에만)
    if request.requester_id != current_user.id:
        notification_service = NotificationService(db)
        notification_service.notify_request_rejected(
            requester_id=request.requester_id,
            request_id=request.id,
            ticker=request.target_ticker,
            reason=reject_data.rejection_reason
        )

    return APIResponse(
        success=True,
        data={"request": request_to_response(request)},
        message="Request rejected"
    )


@router.post("/{request_id}/discuss", response_model=APIResponse, status_code=201)
async def start_discussion(
    request_id: int,
    discuss_data: RequestDiscuss,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_manager_or_admin)
):
    """Start a discussion for a request (manager/admin only)"""
    discussion_service = DiscussionService(db)

    discussion_create = DiscussionCreate(
        request_id=request_id,
        title=discuss_data.title,
        agenda=discuss_data.agenda
    )
    discussion = discussion_service.create_discussion(discussion_create, current_user.id)

    request_service = RequestService(db)
    request = request_service.get_request_by_id(request_id)

    # 요청자에게 토론 개시 알림 전송
    if request.requester_id != current_user.id:
        notification_service = NotificationService(db)
        notification_service.notify_discussion_opened(
            requester_id=request.requester_id,
            discussion_id=discussion.id,
            title=discussion.title,
            request_id=request_id
        )

    return APIResponse(
        success=True,
        data={
            "request": request_to_response(request),
            "discussion": {
                "id": discussion.id,
                "request_id": discussion.request_id,
                "title": discussion.title,
                "status": discussion.status,
                "opened_by": current_user.id,
                "opened_at": discussion.opened_at.isoformat() if discussion.opened_at else None
            }
        },
        message="Discussion session started"
    )


@router.post("/{request_id}/request-discussion", response_model=APIResponse)
async def request_discussion(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_writer_user)
):
    """Request a discussion for own request (for team members to ask managers)"""
    request_service = RequestService(db)
    request = request_service.get_request_by_id(request_id)

    if not request:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found"
        )

    # 자신의 요청만 토론 요청 가능
    if request.requester_id != current_user.id:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only request discussion for your own requests"
        )

    # 이미 토론중이거나 승인/거부된 요청은 불가
    if request.status != 'pending':
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only request discussion for pending requests"
        )

    # 매니저들에게 알림 전송
    notification_service = NotificationService(db)
    notification_service.notify_discussion_requested(
        requester_id=current_user.id,
        requester_name=current_user.full_name,
        request_id=request_id,
        ticker=request.target_ticker
    )

    return APIResponse(
        success=True,
        message="토론 요청이 매니저에게 전송되었습니다"
    )


@router.delete("/{request_id}", response_model=APIResponse)
async def delete_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_manager_or_admin)
):
    """요청 삭제 (팀장/관리자만) - DB에서 완전 삭제"""
    from app.models.request import Request
    from app.models.discussion import Discussion
    from app.models.message import Message

    request = db.query(Request).filter(Request.id == request_id).first()
    if not request:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found"
        )

    ticker = request.target_ticker

    # 연관된 토론 삭제
    discussions = db.query(Discussion).filter(Discussion.request_id == request_id).all()
    for disc in discussions:
        db.query(Message).filter(Message.discussion_id == disc.id).delete()
        db.delete(disc)

    # 요청 삭제
    db.delete(request)
    db.commit()

    return APIResponse(
        success=True,
        message=f"요청 '{ticker}'이(가) 삭제되었습니다"
    )
