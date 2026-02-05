from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.schemas.position import (
    PositionResponse, PositionUpdate, PositionClose, PositionListResponse,
    PositionConfirmInfo, TeamSettingsUpdate, TeamSettingsResponse
)
from app.schemas.user import UserBrief
from app.schemas.common import APIResponse
from app.services.position_service import PositionService
from app.services.audit_service import AuditService
from app.services.notification_service import NotificationService
from app.dependencies import get_current_user, get_manager_or_admin, get_manager
from app.models.user import User
from app.models.team_settings import TeamSettings

router = APIRouter()


def _count_remaining(items: list) -> int:
    """미완료 항목 수 계산"""
    if not items:
        return 0
    return sum(1 for item in items if not item.get('completed', False))


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
        buy_plan=position.buy_plan,
        take_profit_targets=position.take_profit_targets,
        stop_loss_targets=position.stop_loss_targets,
        remaining_buys=_count_remaining(position.buy_plan),
        remaining_take_profits=_count_remaining(position.take_profit_targets),
        remaining_stop_losses=_count_remaining(position.stop_loss_targets),
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


# ============================================
# 팀 설정 엔드포인트 (정적 라우트 먼저!)
# ============================================

@router.get("/settings/team", response_model=APIResponse)
async def get_team_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """팀 설정 조회"""
    settings = db.query(TeamSettings).first()
    if not settings:
        settings = TeamSettings(initial_capital_krw=0, initial_capital_usd=0)
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
            initial_capital_krw=settings_data.initial_capital_krw or 0,
            initial_capital_usd=settings_data.initial_capital_usd or 0,
            description=settings_data.description
        )
        db.add(settings)
    else:
        if settings_data.initial_capital_krw is not None:
            settings.initial_capital_krw = settings_data.initial_capital_krw
        if settings_data.initial_capital_usd is not None:
            settings.initial_capital_usd = settings_data.initial_capital_usd
        if settings_data.description is not None:
            settings.description = settings_data.description

    db.commit()
    db.refresh(settings)

    return APIResponse(
        success=True,
        data=TeamSettingsResponse.model_validate(settings),
        message="팀 설정이 저장되었습니다"
    )


class CurrencyExchange(BaseModel):
    from_currency: str  # 'KRW' or 'USD'
    to_currency: str    # 'KRW' or 'USD'
    from_amount: float
    to_amount: float
    exchange_rate: Optional[float] = None
    memo: Optional[str] = None


@router.post("/settings/team/exchange", response_model=APIResponse)
async def exchange_currency(
    exchange_data: CurrencyExchange,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_manager)
):
    """환전 (팀장만) - 원화 <-> 달러"""
    settings = db.query(TeamSettings).first()
    if not settings:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="팀 설정이 없습니다")

    # 환전 처리
    if exchange_data.from_currency == 'KRW' and exchange_data.to_currency == 'USD':
        if settings.initial_capital_krw < exchange_data.from_amount:
            from fastapi import HTTPException, status
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="원화 잔액이 부족합니다")
        settings.initial_capital_krw -= exchange_data.from_amount
        settings.initial_capital_usd = (settings.initial_capital_usd or 0) + exchange_data.to_amount
    elif exchange_data.from_currency == 'USD' and exchange_data.to_currency == 'KRW':
        if (settings.initial_capital_usd or 0) < exchange_data.from_amount:
            from fastapi import HTTPException, status
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="달러 잔액이 부족합니다")
        settings.initial_capital_usd -= exchange_data.from_amount
        settings.initial_capital_krw = (settings.initial_capital_krw or 0) + exchange_data.to_amount
    else:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="잘못된 통화입니다")

    # 환전 이력 저장
    exchange_log = {
        'from_currency': exchange_data.from_currency,
        'to_currency': exchange_data.to_currency,
        'from_amount': exchange_data.from_amount,
        'to_amount': exchange_data.to_amount,
        'exchange_rate': exchange_data.exchange_rate,
        'memo': exchange_data.memo
    }
    if settings.exchange_history is None:
        settings.exchange_history = []
    from datetime import datetime
    settings.exchange_history.append({
        **exchange_log,
        'user_id': current_user.id,
        'user_name': current_user.full_name,
        'timestamp': datetime.utcnow().isoformat()
    })

    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(settings, 'exchange_history')

    db.commit()
    db.refresh(settings)

    return APIResponse(
        success=True,
        data=TeamSettingsResponse.model_validate(settings),
        message=f"{exchange_data.from_amount:,.0f} {exchange_data.from_currency} → {exchange_data.to_amount:,.2f} {exchange_data.to_currency} 환전 완료"
    )


# ============================================
# 포지션 목록 엔드포인트
# ============================================

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


# ============================================
# 개별 포지션 엔드포인트 (동적 라우트)
# ============================================

class TogglePlanItem(BaseModel):
    plan_type: str  # 'buy', 'take_profit', 'stop_loss'
    index: int
    completed: bool


class UpdatePlans(BaseModel):
    buy_plan: Optional[list] = None
    take_profit_targets: Optional[list] = None
    stop_loss_targets: Optional[list] = None


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
    position = position_service.confirm_position_info(position_id, confirm_data, current_user.id)

    return APIResponse(
        success=True,
        data=position_to_response(position),
        message="포지션 정보가 확인되었습니다"
    )


@router.post("/{position_id}/toggle-plan", response_model=APIResponse)
async def toggle_plan_item(
    position_id: int,
    toggle_data: TogglePlanItem,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_manager)
):
    """매수/익절/손절 계획 항목 완료 상태 토글 (팀장만)"""
    position_service = PositionService(db)
    position = position_service.toggle_plan_item(
        position_id,
        toggle_data.plan_type,
        toggle_data.index,
        toggle_data.completed,
        current_user.id
    )

    return APIResponse(
        success=True,
        data=position_to_response(position),
        message="계획 상태가 업데이트되었습니다"
    )


@router.patch("/{position_id}/plans", response_model=APIResponse)
async def update_plans(
    position_id: int,
    plans_data: UpdatePlans,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """매매 계획 수정 (분할매수, 익절, 손절) - 모든 팀원"""
    position_service = PositionService(db)
    position = position_service.update_plans(
        position_id,
        buy_plan=plans_data.buy_plan,
        take_profit_targets=plans_data.take_profit_targets,
        stop_loss_targets=plans_data.stop_loss_targets,
        user_id=current_user.id
    )

    return APIResponse(
        success=True,
        data=position_to_response(position),
        message="매매 계획이 수정되었습니다"
    )


@router.get("/{position_id}/audit-logs", response_model=APIResponse)
async def get_position_audit_logs(
    position_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """포지션 수정 이력 조회"""
    audit_service = AuditService(db)
    logs = audit_service.get_logs_for_entity('position', position_id)

    return APIResponse(
        success=True,
        data={
            'logs': [
                {
                    'id': log.id,
                    'action': log.action,
                    'field_name': log.field_name,
                    'old_value': log.old_value,
                    'new_value': log.new_value,
                    'changes': log.changes,
                    'user': {
                        'id': log.user.id,
                        'username': log.user.username,
                        'full_name': log.user.full_name
                    } if log.user else None,
                    'created_at': log.created_at.isoformat() if log.created_at else None
                }
                for log in logs
            ]
        }
    )


@router.post("/{position_id}/request-discussion", response_model=APIResponse)
async def request_discussion(
    position_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """포지션에 대한 토론 요청 (팀원이 매니저에게 요청)"""
    position_service = PositionService(db)
    position = position_service.get_position_by_id(position_id)

    if not position:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Position not found"
        )

    if position.status != 'open':
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="종료된 포지션입니다"
        )

    # 매니저들에게 알림 전송
    notification_service = NotificationService(db)
    notification_service.create_notification_for_managers(
        notification_type="discussion_requested",
        title=f"{current_user.full_name}님이 {position.ticker_name or position.ticker} 토론을 요청했습니다",
        related_type="position",
        related_id=position_id,
        exclude_user_id=current_user.id
    )

    return APIResponse(
        success=True,
        message="토론 요청이 매니저에게 전송되었습니다"
    )


@router.post("/{position_id}/request-early-close", response_model=APIResponse)
async def request_early_close(
    position_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """포지션 조기종료 요청 (팀원이 매니저에게 요청)"""
    position_service = PositionService(db)
    position = position_service.get_position_by_id(position_id)

    if not position:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Position not found"
        )

    if position.status != 'open':
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="종료된 포지션입니다"
        )

    notification_service = NotificationService(db)
    notification_service.create_notification_for_managers(
        notification_type="early_close_requested",
        title=f"{current_user.full_name}님이 {position.ticker_name or position.ticker} 조기종료를 요청했습니다",
        related_type="position",
        related_id=position_id,
        exclude_user_id=current_user.id
    )

    return APIResponse(
        success=True,
        message="조기종료 요청이 매니저에게 전송되었습니다"
    )
