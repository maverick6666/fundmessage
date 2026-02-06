from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field

from app.schemas.user import UserBrief


class PriceTarget(BaseModel):
    price: Decimal
    quantity: Optional[Decimal] = None  # 매도 수량
    ratio: Optional[Decimal] = None  # 비중 (legacy, 하위 호환)
    completed: bool = False  # 실행 완료 여부


class BuyPlanItem(BaseModel):
    price: Decimal  # 매수 희망가
    quantity: Optional[Decimal] = None  # 매수 수량
    ratio: Optional[Decimal] = None  # 비율 (기존 호환)
    completed: bool = False  # 실행 완료 여부


class ContributorInfo(BaseModel):
    user: UserBrief
    quantity: Decimal
    contribution_ratio: Decimal


class PositionCreate(BaseModel):
    ticker: str
    ticker_name: Optional[str] = None
    market: str = "KRX"
    average_buy_price: Decimal
    total_quantity: Decimal
    total_buy_amount: Decimal
    take_profit_targets: Optional[List[PriceTarget]] = None
    stop_loss_targets: Optional[List[PriceTarget]] = None
    opened_by: int


class PositionUpdate(BaseModel):
    ticker_name: Optional[str] = None
    average_buy_price: Optional[Decimal] = None
    total_quantity: Optional[Decimal] = None
    total_buy_amount: Optional[Decimal] = None
    take_profit_targets: Optional[List[PriceTarget]] = None
    stop_loss_targets: Optional[List[PriceTarget]] = None


class PositionClose(BaseModel):
    """포지션 종료 - 실제 청산 금액 필수"""
    total_sell_amount: Decimal  # 실제 계좌로 돌아온 금액 (필수)
    average_sell_price: Optional[Decimal] = None  # 평균 매도가 (선택, 계산 가능)
    closed_at: Optional[datetime] = None


class PositionConfirmInfo(BaseModel):
    """포지션 정보 확인/수정 (팀장용)"""
    average_buy_price: Decimal  # 실제 평균 매입가
    total_quantity: Decimal  # 실제 수량
    total_buy_amount: Optional[Decimal] = None  # 진입 금액 (자동 계산 가능)
    ticker_name: Optional[str] = None  # 종목명


class PositionStatusInfo(BaseModel):
    status: str  # 'normal', 'needs_close', 'no_plan'
    alert: Optional[str] = None  # 'warning', 'danger', None
    message: Optional[str] = None


class PositionResponse(BaseModel):
    id: int
    ticker: str
    ticker_name: Optional[str]
    market: str
    status: str
    is_info_confirmed: bool = False  # 정보 확인 완료 여부
    average_buy_price: Optional[Decimal]
    total_quantity: Optional[Decimal]
    total_buy_amount: Optional[Decimal]
    buy_plan: Optional[List[dict]] = None  # 분할 매수 계획
    take_profit_targets: Optional[List[dict]]
    stop_loss_targets: Optional[List[dict]]
    # 남은 계획 수 (프론트에서 표시용)
    remaining_buys: int = 0
    remaining_take_profits: int = 0
    remaining_stop_losses: int = 0
    average_sell_price: Optional[Decimal]
    total_sell_amount: Optional[Decimal]
    profit_loss: Optional[Decimal]
    profit_rate: Optional[Decimal]
    realized_profit_loss: Optional[Decimal] = 0  # 실현손익
    holding_period_hours: Optional[int]
    opened_at: Optional[datetime]
    closed_at: Optional[datetime]
    opened_by: Optional[UserBrief]
    closed_by: Optional[UserBrief]
    created_at: datetime
    status_info: Optional[PositionStatusInfo] = None  # 포지션 상태 정보

    class Config:
        from_attributes = True


class PositionBrief(BaseModel):
    id: int
    ticker: str
    ticker_name: Optional[str]
    market: str
    status: str
    is_info_confirmed: bool = False
    average_buy_price: Optional[Decimal]
    total_quantity: Optional[Decimal]
    total_buy_amount: Optional[Decimal]
    profit_loss: Optional[Decimal] = None
    profit_rate: Optional[Decimal] = None
    realized_profit_loss: Optional[Decimal] = 0  # 실현손익
    # 남은 계획 수
    remaining_buys: int = 0
    remaining_take_profits: int = 0
    remaining_stop_losses: int = 0
    status_info: Optional[PositionStatusInfo] = None  # 포지션 상태 정보

    class Config:
        from_attributes = True


class PositionListResponse(BaseModel):
    positions: List[PositionResponse]
    total: int
    page: int = 1
    limit: int = 20


# 팀 설정 스키마
class TeamSettingsUpdate(BaseModel):
    initial_capital_krw: Optional[Decimal] = None  # 원화
    initial_capital_usd: Optional[Decimal] = None  # 달러
    description: Optional[str] = None


class TeamSettingsResponse(BaseModel):
    id: int
    initial_capital_krw: Optional[Decimal] = 0  # 원화
    initial_capital_usd: Optional[Decimal] = 0  # 달러
    exchange_history: Optional[List[dict]] = None  # 환전 이력
    description: Optional[str]
    updated_at: datetime

    class Config:
        from_attributes = True
