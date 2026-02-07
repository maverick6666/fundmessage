from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel
from decimal import Decimal

from app.schemas.user import UserBrief


class PlanChange(BaseModel):
    """개별 변경 항목 (deprecated)"""
    action: str  # "add" | "modify" | "delete"
    type: str  # "buy" | "take_profit" | "stop_loss"
    user: str  # 사용자명
    price: Optional[float] = None
    quantity: Optional[float] = None
    old_price: Optional[float] = None  # 수정 시 이전 가격
    old_quantity: Optional[float] = None  # 수정 시 이전 수량
    timestamp: str  # ISO 형식


class TradingPlanCreate(BaseModel):
    """계획 저장 (record_type='plan_saved')"""
    buy_plan: Optional[List[dict]] = None
    take_profit_targets: Optional[List[dict]] = None
    stop_loss_targets: Optional[List[dict]] = None
    memo: Optional[str] = None
    changes: Optional[List[PlanChange]] = None  # 변경 이력 (deprecated)


class ExecutionCreate(BaseModel):
    """체결 기록 (record_type='execution')"""
    plan_type: str  # "buy" | "take_profit" | "stop_loss"
    execution_index: int  # 몇 번째 체결인지 (1차, 2차 등)
    target_price: float  # 계획했던 가격
    target_quantity: float  # 계획했던 수량
    executed_price: float  # 실제 체결 가격
    executed_quantity: float  # 실제 체결 수량


class TradingPlanSubmit(BaseModel):
    pass


class TradingPlanResponse(BaseModel):
    id: int
    position_id: int
    version: int
    record_type: str = 'plan_saved'  # plan_saved | execution

    # 계획 저장용
    buy_plan: Optional[List[dict]] = None
    take_profit_targets: Optional[List[dict]] = None
    stop_loss_targets: Optional[List[dict]] = None
    memo: Optional[str] = None
    changes: Optional[List[dict]] = None  # 변경 이력 (deprecated)

    # 체결 기록용
    plan_type: Optional[str] = None
    execution_index: Optional[int] = None
    target_price: Optional[float] = None
    target_quantity: Optional[float] = None
    executed_price: Optional[float] = None
    executed_quantity: Optional[float] = None
    executed_amount: Optional[float] = None
    profit_loss: Optional[float] = None
    profit_rate: Optional[float] = None

    status: str
    user: Optional[UserBrief] = None
    created_at: datetime
    submitted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TradingPlanListResponse(BaseModel):
    plans: List[TradingPlanResponse]
    total: int
