from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.position import (
    PositionResponse, PositionUpdate, PositionClose, PositionListResponse,
    PositionConfirmInfo, TeamSettingsUpdate, TeamSettingsResponse
)
from app.schemas.user import UserBrief
from app.schemas.common import APIResponse
from app.services.position_service import PositionService
from app.dependencies import get_current_user, get_manager_or_admin, get_manager
from app.models.user import User
from app.models.team_settings import TeamSettings

router = APIRouter()


def position_to_response(position) -> PositionResponse:
    return PositionResponse(
        id=position.id,
        ticker=position.ticker,
        ticker_name=position.ticker_name,
        market=position.market,
        status=position.status,
        is_info_confirmed=position.is_info_confirmed or False,
        average_buy_price=position.average_buy_price,
        total_quantity=position.total_quantity,
        total_buy_amount=position.total_buy_amount,
        take_profit_targets=position.take_profit_targets,
        stop_loss_targets=position.stop_loss_targets,
        average_sell_price=position.average_sell_price,
        total_sell_amount=position.total_sell_amount,
        profit_loss=position.profit_loss,
        profit_rate=position.profit_rate,
        holding_period_hours=position.holding_period_hours,
        opened_at=position.opened_at,
        closed_at=position.closed_at,
        opened_by=UserBrief.model_validate(position.opener) if position.opener else None,
        closed_by=UserBrief.model_validate(position.closer) if position.closer else None,
        created_at=position.created_at
    )


@router.get("", response_model=APIResponse)
async def get_positions(
    status: Optional[str] = None,
    ticker: Optional[str] = None,
    opened_by: Optional[int] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get positions list"""
    position_service = PositionService(db)
    positions, total = position_service.get_positions(
        status=status,
        ticker=ticker,
        opened_by=opened_by,
        page=page,
        limit=limit
    )

    return APIResponse(
        success=True,
        data=PositionListResponse(
            positions=[position_to_response(p) for p in positions],
            total=total,
            page=page,
            limit=limit
        )
    )


@router.get("/{position_id}", response_model=APIResponse)
async def get_position(
    position_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get position detail"""
    position_service = PositionService(db)
    position = position_service.get_position_by_id(position_id)

    if not position:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Position not found"
        )

    return APIResponse(
        success=True,
        data=position_to_response(position)
    )


@router.patch("/{position_id}", response_model=APIResponse)
async def update_position(
    position_id: int,
    update_data: PositionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_manager_or_admin)
):
    """Update position (manager/admin only)"""
    position_service = PositionService(db)
    position = position_service.update_position(position_id, update_data)

    return APIResponse(
        success=True,
        data=position_to_response(position),
        message="Position updated successfully"
    )


@router.post("/{position_id}/close", response_model=APIResponse)
async def close_position(
    position_id: int,
    close_data: PositionClose,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_manager_or_admin)
):
    """포지션 종료 - 실제 청산 금액 입력 필수 (팀장/관리자)"""
    position_service = PositionService(db)
    position = position_service.close_position(position_id, close_data, current_user.id)

    return APIResponse(
        success=True,
        data=position_to_response(position),
        message="포지션이 종료되었습니다"
    )


@router.post("/{position_id}/confirm", response_model=APIResponse)
async def confirm_position_info(
    position_id: int,
    confirm_data: PositionConfirmInfo,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_manager)
):
    """포지션 정보 확인/수정 (팀장만)"""
    position_service = PositionService(db)
    position = position_service.confirm_position_info(position_id, confirm_data)

    return APIResponse(
        success=True,
        data=position_to_response(position),
        message="포지션 정보가 확인되었습니다"
    )


# 팀 설정 엔드포인트
@router.get("/settings/team", response_model=APIResponse)
async def get_team_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """팀 설정 조회"""
    settings = db.query(TeamSettings).first()
    if not settings:
        # 설정이 없으면 기본값으로 생성
        settings = TeamSettings(initial_capital=0)
        db.add(settings)
        db.commit()
        db.refresh(settings)

    return APIResponse(
        success=True,
        data=TeamSettingsResponse.model_validate(settings)
    )


@router.put("/settings/team", response_model=APIResponse)
async def update_team_settings(
    settings_data: TeamSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_manager)
):
    """팀 설정 수정 (팀장만)"""
    settings = db.query(TeamSettings).first()
    if not settings:
        settings = TeamSettings(
            initial_capital=settings_data.initial_capital,
            description=settings_data.description
        )
        db.add(settings)
    else:
        settings.initial_capital = settings_data.initial_capital
        if settings_data.description is not None:
            settings.description = settings_data.description

    db.commit()
    db.refresh(settings)

    return APIResponse(
        success=True,
        data=TeamSettingsResponse.model_validate(settings),
        message="팀 설정이 저장되었습니다"
    )
