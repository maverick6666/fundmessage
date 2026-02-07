from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.trading_plan import TradingPlan
from app.models.position import Position
from app.models.user import User
from app.schemas.trading_plan import (
    TradingPlanCreate, TradingPlanSubmit,
    TradingPlanResponse, TradingPlanListResponse
)
from app.schemas.user import UserBrief
from app.schemas.common import APIResponse
from app.dependencies import get_current_user
from app.services.audit_service import AuditService

router = APIRouter()


def plan_to_response(plan: TradingPlan) -> TradingPlanResponse:
    return TradingPlanResponse(
        id=plan.id,
        position_id=plan.position_id,
        version=plan.version,
        buy_plan=plan.buy_plan,
        take_profit_targets=plan.take_profit_targets,
        stop_loss_targets=plan.stop_loss_targets,
        memo=plan.memo,
        changes=plan.changes,
        status=plan.status,
        user=UserBrief.model_validate(plan.user) if plan.user else None,
        created_at=plan.created_at,
        submitted_at=plan.submitted_at
    )


@router.get("/{position_id}/plans", response_model=APIResponse)
async def get_position_plans(
    position_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """포지션의 매매계획 이력 조회"""
    position = db.query(Position).filter(Position.id == position_id).first()
    if not position:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Position not found")

    plans = db.query(TradingPlan).filter(
        TradingPlan.position_id == position_id
    ).order_by(TradingPlan.created_at.desc()).all()

    return APIResponse(
        success=True,
        data=TradingPlanListResponse(
            plans=[plan_to_response(p) for p in plans],
            total=len(plans)
        )
    )


@router.post("/{position_id}/plans", response_model=APIResponse, status_code=201)
async def create_trading_plan(
    position_id: int,
    plan_data: TradingPlanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """매매계획 저장 (draft)"""
    position = db.query(Position).filter(Position.id == position_id).first()
    if not position:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Position not found")

    if position.status != 'open':
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="종료된 포지션에는 계획을 추가할 수 없습니다")

    # 최신 버전 번호 확인
    latest = db.query(TradingPlan).filter(
        TradingPlan.position_id == position_id
    ).order_by(TradingPlan.version.desc()).first()

    next_version = (latest.version + 1) if latest else 1

    # changes를 dict 리스트로 변환
    changes_data = None
    if plan_data.changes:
        changes_data = [c.model_dump() for c in plan_data.changes]

    new_plan = TradingPlan(
        position_id=position_id,
        user_id=current_user.id,
        version=next_version,
        buy_plan=plan_data.buy_plan,
        take_profit_targets=plan_data.take_profit_targets,
        stop_loss_targets=plan_data.stop_loss_targets,
        memo=plan_data.memo,
        changes=changes_data,
        status='draft'
    )

    db.add(new_plan)
    db.commit()
    db.refresh(new_plan)

    # 감사 로그 기록 - 변경사항을 사람이 읽기 좋은 형식으로
    if changes_data:
        audit_service = AuditService(db)
        change_descriptions = []

        type_labels = {
            'buy': '매수계획',
            'take_profit': '익절계획',
            'stop_loss': '손절계획'
        }
        action_labels = {
            'add': '추가',
            'modify': '수정',
            'delete': '삭제'
        }

        for change in changes_data:
            type_label = type_labels.get(change.get('type'), change.get('type'))
            action_label = action_labels.get(change.get('action'), change.get('action'))
            price = change.get('price')
            quantity = change.get('quantity')
            old_price = change.get('old_price')
            old_quantity = change.get('old_quantity')

            if change.get('action') == 'modify' and old_price and old_quantity:
                desc = f"{type_label} {action_label}: ₩{old_price:,.0f}({old_quantity:,.0f}주) → ₩{price:,.0f}({quantity:,.0f}주)"
            elif price and quantity:
                desc = f"{type_label} {action_label}: ₩{price:,.0f}({quantity:,.0f}주)"
            else:
                desc = f"{type_label} {action_label}"

            change_descriptions.append(desc)

        if change_descriptions:
            audit_service.log_change(
                entity_type='position',
                entity_id=position_id,
                action='매매계획 저장: ' + ', '.join(change_descriptions),
                user_id=current_user.id
            )

    return APIResponse(
        success=True,
        data=plan_to_response(new_plan),
        message="매매계획이 저장되었습니다"
    )


@router.post("/{position_id}/plans/{plan_id}/submit", response_model=APIResponse)
async def submit_trading_plan(
    position_id: int,
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """매매계획 제출 (submitted)"""
    plan = db.query(TradingPlan).filter(
        TradingPlan.id == plan_id,
        TradingPlan.position_id == position_id
    ).first()

    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trading plan not found")

    if plan.status == 'submitted':
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="이미 제출된 계획입니다")

    plan.status = 'submitted'
    plan.submitted_at = datetime.utcnow()
    db.commit()
    db.refresh(plan)

    return APIResponse(
        success=True,
        data=plan_to_response(plan),
        message="매매계획이 제출되었습니다"
    )


@router.get("/{position_id}/plans/{plan_id}", response_model=APIResponse)
async def get_trading_plan(
    position_id: int,
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """특정 매매계획 조회"""
    plan = db.query(TradingPlan).filter(
        TradingPlan.id == plan_id,
        TradingPlan.position_id == position_id
    ).first()

    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trading plan not found")

    return APIResponse(
        success=True,
        data=plan_to_response(plan)
    )


@router.delete("/{position_id}/plans/{plan_id}", response_model=APIResponse)
async def delete_trading_plan(
    position_id: int,
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """매매계획 삭제 (draft만 삭제 가능, 작성자 또는 매니저만)"""
    plan = db.query(TradingPlan).filter(
        TradingPlan.id == plan_id,
        TradingPlan.position_id == position_id
    ).first()

    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trading plan not found")

    if plan.status == 'submitted':
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="제출된 계획은 삭제할 수 없습니다")

    if plan.user_id != current_user.id and not current_user.is_manager_or_admin():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="삭제 권한이 없습니다")

    db.delete(plan)
    db.commit()

    return APIResponse(
        success=True,
        message="매매계획이 삭제되었습니다"
    )
