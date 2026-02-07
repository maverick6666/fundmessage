from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel

from app.schemas.user import UserBrief


class PlanChange(BaseModel):
    """개별 변경 항목"""
    action: str  # "add" | "modify" | "delete"
    type: str  # "buy" | "take_profit" | "stop_loss"
    user: str  # 사용자명
    price: Optional[float] = None
    quantity: Optional[float] = None
    old_price: Optional[float] = None  # 수정 시 이전 가격
    old_quantity: Optional[float] = None  # 수정 시 이전 수량
    timestamp: str  # ISO 형식


class TradingPlanCreate(BaseModel):
    buy_plan: Optional[List[dict]] = None
    take_profit_targets: Optional[List[dict]] = None
    stop_loss_targets: Optional[List[dict]] = None
    memo: Optional[str] = None
    changes: Optional[List[PlanChange]] = None  # 변경 이력


class TradingPlanSubmit(BaseModel):
    pass


class TradingPlanResponse(BaseModel):
    id: int
    position_id: int
    version: int
    buy_plan: Optional[List[dict]] = None
    take_profit_targets: Optional[List[dict]] = None
    stop_loss_targets: Optional[List[dict]] = None
    memo: Optional[str] = None
    changes: Optional[List[dict]] = None  # 변경 이력
    status: str
    user: Optional[UserBrief] = None
    created_at: datetime
    submitted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TradingPlanListResponse(BaseModel):
    plans: List[TradingPlanResponse]
    total: int
