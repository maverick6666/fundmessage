from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel

from app.schemas.user import UserBrief


class TradingPlanCreate(BaseModel):
    buy_plan: Optional[List[dict]] = None
    take_profit_targets: Optional[List[dict]] = None
    stop_loss_targets: Optional[List[dict]] = None
    memo: Optional[str] = None


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
    status: str
    user: Optional[UserBrief] = None
    created_at: datetime
    submitted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TradingPlanListResponse(BaseModel):
    plans: List[TradingPlanResponse]
    total: int
