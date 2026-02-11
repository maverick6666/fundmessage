from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field

from app.schemas.user import UserBrief
from app.schemas.position import PriceTarget, PositionBrief


class BuyOrder(BaseModel):
    price: Decimal
    quantity: Optional[Decimal] = None  # 매수 수량
    ratio: Optional[Decimal] = Field(None, ge=0, le=1)  # Legacy - 비율 방식


class BuyRequestCreate(BaseModel):
    target_ticker: str
    ticker_name: Optional[str] = None  # 종목명
    target_market: str = "KOSPI"  # KOSPI, KOSDAQ, NASDAQ, NYSE, CRYPTO
    order_type: str = "amount"  # 'amount' or 'quantity'
    order_amount: Optional[Decimal] = None  # 매수 금액
    order_quantity: Optional[Decimal] = None  # 매수 수량
    buy_price: Optional[Decimal] = None  # 매수 희망가 (None이면 시장가)
    buy_orders: Optional[List[BuyOrder]] = None  # Legacy - Empty means market order
    target_ratio: Optional[Decimal] = Field(None, ge=0, le=1)  # Legacy - Portfolio ratio
    take_profit_targets: Optional[List[PriceTarget]] = None
    stop_loss_targets: Optional[List[PriceTarget]] = None
    memo: Optional[str] = None  # 메모


class SellRequestCreate(BaseModel):
    position_id: int
    sell_quantity: Decimal
    sell_price: Optional[Decimal] = None  # None means market order
    sell_reason: Optional[str] = None


class RequestApprove(BaseModel):
    # 팀장이 직접 입력하지 않으면 요청자의 희망 가격/수량 사용
    executed_price: Optional[Decimal] = None
    executed_quantity: Optional[Decimal] = None
    executed_at: Optional[datetime] = None


class RequestReject(BaseModel):
    rejection_reason: str


class RequestDiscuss(BaseModel):
    title: str = Field(..., max_length=200)
    agenda: str = Field(..., min_length=1, max_length=500)  # 토론 의제 (필수)


class RequestResponse(BaseModel):
    id: int
    position_id: Optional[int]
    request_type: str
    target_ticker: Optional[str]
    ticker_name: Optional[str] = None
    target_market: Optional[str]
    order_type: Optional[str] = None
    order_amount: Optional[Decimal] = None
    order_quantity: Optional[Decimal] = None
    buy_price: Optional[Decimal] = None
    buy_orders: Optional[List[dict]]
    target_ratio: Optional[Decimal]
    take_profit_targets: Optional[List[dict]]
    stop_loss_targets: Optional[List[dict]]
    memo: Optional[str] = None
    sell_quantity: Optional[Decimal]
    sell_price: Optional[Decimal]
    sell_reason: Optional[str]
    status: str
    requester: UserBrief
    approved_by: Optional[UserBrief] = None
    approved_at: Optional[datetime]
    rejection_reason: Optional[str]
    executed_price: Optional[Decimal]
    executed_quantity: Optional[Decimal]
    executed_at: Optional[datetime]
    created_at: datetime
    position: Optional[PositionBrief] = None
    discussion_id: Optional[int] = None  # 토론 ID (status가 discussion일 때)

    class Config:
        from_attributes = True


class RequestBrief(BaseModel):
    id: int
    request_type: str
    requester: str
    quantity: Optional[Decimal]

    class Config:
        from_attributes = True


class RequestListResponse(BaseModel):
    requests: List[RequestResponse]
    total: int
    page: int = 1
    limit: int = 20
