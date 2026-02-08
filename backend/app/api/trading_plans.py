from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.database import get_db
from app.models.trading_plan import TradingPlan
from app.models.position import Position
from app.models.user import User
from app.schemas.trading_plan import (
    TradingPlanCreate, TradingPlanSubmit, ExecutionCreate,
    TradingPlanResponse, TradingPlanListResponse
)
from app.schemas.user import UserBrief
from app.schemas.common import APIResponse
from app.dependencies import get_current_user, get_writer_user
from app.services.audit_service import AuditService

router = APIRouter()


def plan_to_response(plan: TradingPlan) -> TradingPlanResponse:
    return TradingPlanResponse(
        id=plan.id,
        position_id=plan.position_id,
        version=plan.version,
        record_type=plan.record_type or 'plan_saved',
        buy_plan=plan.buy_plan,
        take_profit_targets=plan.take_profit_targets,
        stop_loss_targets=plan.stop_loss_targets,
        memo=plan.memo,
        changes=plan.changes,
        plan_type=plan.plan_type,
        execution_index=plan.execution_index,
        target_price=float(plan.target_price) if plan.target_price else None,
        target_quantity=float(plan.target_quantity) if plan.target_quantity else None,
        executed_price=float(plan.executed_price) if plan.executed_price else None,
        executed_quantity=float(plan.executed_quantity) if plan.executed_quantity else None,
        executed_amount=float(plan.executed_amount) if plan.executed_amount else None,
        profit_loss=float(plan.profit_loss) if plan.profit_loss else None,
        profit_rate=float(plan.profit_rate) if plan.profit_rate else None,
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
    current_user: User = Depends(get_writer_user)
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
        record_type='plan_saved',
        buy_plan=plan_data.buy_plan,
        take_profit_targets=plan_data.take_profit_targets,
        stop_loss_targets=plan_data.stop_loss_targets,
        memo=plan_data.memo,
        changes=changes_data,
        status='submitted'  # 저장 즉시 submitted
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
    current_user: User = Depends(get_writer_user)
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
    current_user: User = Depends(get_writer_user)
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


@router.post("/{position_id}/executions", response_model=APIResponse, status_code=201)
async def create_execution_record(
    position_id: int,
    execution_data: ExecutionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_writer_user)
):
    """체결 기록 생성 (팀장만)

    체크박스로 계획 항목 체결 시 호출.
    포지션의 해당 계획 항목을 completed=True로 업데이트하고,
    이력에 체결 기록을 추가합니다.
    """
    # 팀장 권한 확인
    if not current_user.is_manager_or_admin():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="체결 기록은 팀장만 추가할 수 있습니다"
        )

    position = db.query(Position).filter(Position.id == position_id).first()
    if not position:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Position not found")

    if position.status != 'open':
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="종료된 포지션에는 체결 기록을 추가할 수 없습니다")

    # 체결 금액 계산
    executed_amount = float(execution_data.executed_price) * float(execution_data.executed_quantity)

    # 손익 계산 (익절/손절만)
    profit_loss = None
    profit_rate = None
    if execution_data.plan_type in ['take_profit', 'stop_loss']:
        avg_price = float(position.average_buy_price) if position.average_buy_price else 0
        if avg_price > 0:
            profit_loss = (float(execution_data.executed_price) - avg_price) * float(execution_data.executed_quantity)
            investment = avg_price * float(execution_data.executed_quantity)
            profit_rate = profit_loss / investment if investment > 0 else 0

    # 최신 버전 번호 확인
    latest = db.query(TradingPlan).filter(
        TradingPlan.position_id == position_id
    ).order_by(TradingPlan.version.desc()).first()

    next_version = (latest.version + 1) if latest else 1

    # 체결 기록 생성
    execution_record = TradingPlan(
        position_id=position_id,
        user_id=current_user.id,
        version=next_version,
        record_type='execution',
        plan_type=execution_data.plan_type,
        execution_index=execution_data.execution_index,
        target_price=execution_data.target_price,
        target_quantity=execution_data.target_quantity,
        executed_price=execution_data.executed_price,
        executed_quantity=execution_data.executed_quantity,
        executed_amount=executed_amount,
        profit_loss=profit_loss,
        profit_rate=profit_rate,
        status='submitted'
    )

    db.add(execution_record)

    # 포지션의 해당 계획 항목을 completed=True로 업데이트
    plan_key = {
        'buy': 'buy_plan',
        'take_profit': 'take_profit_targets',
        'stop_loss': 'stop_loss_targets'
    }.get(execution_data.plan_type)

    if plan_key:
        plans = getattr(position, plan_key) or []
        if plans and len(plans) >= execution_data.execution_index:
            # 해당 인덱스의 항목을 completed=True로 업데이트
            idx = execution_data.execution_index - 1  # 1-based to 0-based
            if idx >= 0 and idx < len(plans):
                plans[idx]['completed'] = True
                setattr(position, plan_key, plans)
                # SQLAlchemy가 JSON 필드 변경을 감지하도록 명시
                flag_modified(position, plan_key)

    # 매수 체결 시 평균매입가와 수량 업데이트
    if execution_data.plan_type == 'buy':
        old_qty = float(position.total_quantity) if position.total_quantity else 0
        old_avg = float(position.average_buy_price) if position.average_buy_price else 0
        new_qty = float(execution_data.executed_quantity)
        new_price = float(execution_data.executed_price)

        # 가중평균 계산
        total_qty = old_qty + new_qty
        if total_qty > 0:
            new_avg = (old_avg * old_qty + new_price * new_qty) / total_qty
            position.average_buy_price = new_avg
            position.total_quantity = total_qty
            position.total_buy_amount = new_avg * total_qty

    # 익절/손절 체결 시 수량 차감
    elif execution_data.plan_type in ['take_profit', 'stop_loss']:
        old_qty = float(position.total_quantity) if position.total_quantity else 0
        sold_qty = float(execution_data.executed_quantity)
        remaining_qty = max(0, old_qty - sold_qty)
        position.total_quantity = remaining_qty

        # 전량 매도 시 포지션 종료 처리 (선택사항)
        if remaining_qty <= 0:
            # 자동 종료하지 않고, 사용자가 직접 종료하도록 유지
            pass

    db.commit()
    db.refresh(execution_record)

    # 감사 로그
    type_labels = {
        'buy': '매수',
        'take_profit': '익절',
        'stop_loss': '손절'
    }
    type_label = type_labels.get(execution_data.plan_type, execution_data.plan_type)
    audit_service = AuditService(db)
    audit_service.log_change(
        entity_type='position',
        entity_id=position_id,
        action=f"{execution_data.execution_index}차 {type_label} 체결: 계획 ₩{execution_data.target_price:,.0f} → 실제 ₩{execution_data.executed_price:,.0f} × {execution_data.executed_quantity:,.0f}",
        user_id=current_user.id
    )

    return APIResponse(
        success=True,
        data=plan_to_response(execution_record),
        message=f"{execution_data.execution_index}차 {type_label} 체결이 기록되었습니다"
    )
