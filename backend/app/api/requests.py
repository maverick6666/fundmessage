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
from app.dependencies import get_current_user, get_manager_or_admin
from app.models.user import User

router = APIRouter()


def request_to_response(request) -> RequestResponse:
    approver = None
    if request.approver:
        approver = UserBrief.model_validate(request.approver)

    position = None
    if request.position:
        position = PositionBrief(
            id=request.position.id,
            ticker=request.position.ticker,
            ticker_name=request.position.ticker_name,
            status=request.position.status,
            average_buy_price=request.position.average_buy_price,
            total_quantity=request.position.total_quantity
        )

    return RequestResponse(
        id=request.id,
        position_id=request.position_id,
        request_type=request.request_type,
        target_ticker=request.target_ticker,
        target_market=request.target_market,
        buy_orders=request.buy_orders,
        target_ratio=request.target_ratio,
        take_profit_targets=request.take_profit_targets,
        stop_loss_targets=request.stop_loss_targets,
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
        position=position
    )


@router.post("/buy", response_model=APIResponse, status_code=201)
async def create_buy_request(
    request_data: BuyRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a buy request"""
    request_service = RequestService(db)
    request = request_service.create_buy_request(request_data, current_user.id)

    return APIResponse(
        success=True,
        data={"request": request_to_response(request)},
        message="Buy request created successfully"
    )


@router.post("/sell", response_model=APIResponse, status_code=201)
async def create_sell_request(
    request_data: SellRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a sell request"""
    request_service = RequestService(db)
    request = request_service.create_sell_request(request_data, current_user.id)

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
        title=discuss_data.title
    )
    discussion = discussion_service.create_discussion(discussion_create, current_user.id)

    request_service = RequestService(db)
    request = request_service.get_request_by_id(request_id)

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
