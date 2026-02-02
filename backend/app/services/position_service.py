from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.position import Position, PositionStatus
from app.schemas.position import PositionCreate, PositionUpdate, PositionClose, PositionConfirmInfo


class PositionService:
    def __init__(self, db: Session):
        self.db = db

    def _convert_targets(self, targets) -> Optional[list]:
        """Decimal을 float로 변환하여 JSON 직렬화 가능하게 함"""
        if not targets:
            return None
        result = []
        for t in targets:
            item = t.model_dump() if hasattr(t, 'model_dump') else t
            result.append({
                k: float(v) if isinstance(v, Decimal) else v
                for k, v in item.items()
            })
        return result

    def get_position_by_id(self, position_id: int) -> Optional[Position]:
        return self.db.query(Position).filter(Position.id == position_id).first()

    def get_open_position_by_ticker(self, ticker: str, market: str = "KRX") -> Optional[Position]:
        return self.db.query(Position).filter(
            Position.ticker == ticker,
            Position.market == market,
            Position.status == PositionStatus.OPEN.value
        ).first()

    def get_positions(
        self,
        status: Optional[str] = None,
        ticker: Optional[str] = None,
        opened_by: Optional[int] = None,
        page: int = 1,
        limit: int = 20
    ) -> tuple[List[Position], int]:
        query = self.db.query(Position)

        if status:
            query = query.filter(Position.status == status)
        if ticker:
            query = query.filter(Position.ticker == ticker)
        if opened_by:
            query = query.filter(Position.opened_by == opened_by)

        total = query.count()
        positions = query.order_by(Position.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

        return positions, total

    def create_position(self, position_data: PositionCreate) -> Position:
        # Check if there's already an open position for this ticker
        existing = self.get_open_position_by_ticker(position_data.ticker, position_data.market)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Open position for {position_data.ticker} already exists"
            )

        position = Position(
            ticker=position_data.ticker,
            ticker_name=position_data.ticker_name,
            market=position_data.market,
            status=PositionStatus.OPEN.value,
            average_buy_price=position_data.average_buy_price,
            total_quantity=position_data.total_quantity,
            total_buy_amount=position_data.total_buy_amount,
            take_profit_targets=self._convert_targets(position_data.take_profit_targets),
            stop_loss_targets=self._convert_targets(position_data.stop_loss_targets),
            opened_at=datetime.utcnow(),
            opened_by=position_data.opened_by
        )

        self.db.add(position)
        self.db.commit()
        self.db.refresh(position)

        return position

    def create_position_from_request(
        self,
        ticker: str,
        ticker_name: Optional[str],
        market: str,
        buy_price: Decimal,
        quantity: Decimal,
        buy_plan: Optional[list],
        take_profit_targets: Optional[list],
        stop_loss_targets: Optional[list],
        opened_by: int
    ) -> Position:
        """요청 승인 시 포지션 생성 (is_info_confirmed = False)"""
        # Check if there's already an open position for this ticker
        existing = self.get_open_position_by_ticker(ticker, market)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Open position for {ticker} already exists"
            )

        position = Position(
            ticker=ticker,
            ticker_name=ticker_name,
            market=market,
            status=PositionStatus.OPEN.value,
            is_info_confirmed=False,  # 팀장이 아직 확인 안 함
            average_buy_price=buy_price,
            total_quantity=quantity,
            total_buy_amount=buy_price * quantity,
            buy_plan=buy_plan,
            take_profit_targets=take_profit_targets,
            stop_loss_targets=stop_loss_targets,
            opened_at=datetime.utcnow(),
            opened_by=opened_by
        )

        self.db.add(position)
        self.db.commit()
        self.db.refresh(position)

        return position

    def add_to_position(
        self,
        position: Position,
        additional_quantity: Decimal,
        additional_price: Decimal,
        take_profit_targets: Optional[List[dict]] = None,
        stop_loss_targets: Optional[List[dict]] = None,
        buy_plan: Optional[List[dict]] = None
    ) -> Position:
        # Calculate new average price
        old_total = position.total_buy_amount or Decimal(0)
        additional_amount = additional_quantity * additional_price
        new_total_amount = old_total + additional_amount
        new_total_quantity = (position.total_quantity or Decimal(0)) + additional_quantity

        position.average_buy_price = new_total_amount / new_total_quantity
        position.total_quantity = new_total_quantity
        position.total_buy_amount = new_total_amount

        # 추가 매수 시 정보 미확인 상태로
        position.is_info_confirmed = False

        # Merge buy plan (기존 + 새로운)
        if buy_plan:
            existing_plan = position.buy_plan or []
            position.buy_plan = existing_plan + buy_plan

        # Merge targets (기존 + 새로운)
        if take_profit_targets:
            existing_tp = position.take_profit_targets or []
            position.take_profit_targets = existing_tp + take_profit_targets
        if stop_loss_targets:
            existing_sl = position.stop_loss_targets or []
            position.stop_loss_targets = existing_sl + stop_loss_targets

        self.db.commit()
        self.db.refresh(position)

        return position

    def update_position(self, position_id: int, update_data: PositionUpdate) -> Position:
        position = self.get_position_by_id(position_id)
        if not position:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Position not found"
            )

        update_dict = update_data.model_dump(exclude_unset=True)

        if "take_profit_targets" in update_dict and update_dict["take_profit_targets"]:
            update_dict["take_profit_targets"] = self._convert_targets(update_dict["take_profit_targets"])
        if "stop_loss_targets" in update_dict and update_dict["stop_loss_targets"]:
            update_dict["stop_loss_targets"] = self._convert_targets(update_dict["stop_loss_targets"])

        for key, value in update_dict.items():
            setattr(position, key, value)

        self.db.commit()
        self.db.refresh(position)

        return position

    def close_position(self, position_id: int, close_data: PositionClose, closed_by: int) -> Position:
        """포지션 종료 - 실제 청산 금액으로 수익률 계산"""
        position = self.get_position_by_id(position_id)
        if not position:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Position not found"
            )

        if position.status == PositionStatus.CLOSED.value:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="이미 종료된 포지션입니다"
            )

        position.status = PositionStatus.CLOSED.value
        position.total_sell_amount = close_data.total_sell_amount  # 실제 청산 금액 (필수)
        position.closed_at = close_data.closed_at or datetime.utcnow()
        position.closed_by = closed_by

        # 평균 매도가 계산 (제공되지 않으면 자동 계산)
        if close_data.average_sell_price:
            position.average_sell_price = close_data.average_sell_price
        elif position.total_quantity and position.total_quantity > 0:
            position.average_sell_price = close_data.total_sell_amount / position.total_quantity

        # 수익금/수익률 자동 계산
        buy_amount = position.total_buy_amount or Decimal(0)
        position.profit_loss = close_data.total_sell_amount - buy_amount

        if buy_amount > 0:
            position.profit_rate = position.profit_loss / buy_amount

        # 보유 기간 계산
        if position.opened_at:
            delta = position.closed_at - position.opened_at
            position.holding_period_hours = int(delta.total_seconds() / 3600)

        self.db.commit()
        self.db.refresh(position)

        return position

    def reduce_position(self, position: Position, sell_quantity: Decimal) -> Position:
        if position.total_quantity is None or sell_quantity > position.total_quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Sell quantity exceeds position quantity"
            )

        position.total_quantity = position.total_quantity - sell_quantity

        # Recalculate total buy amount
        if position.average_buy_price:
            position.total_buy_amount = position.total_quantity * position.average_buy_price

        self.db.commit()
        self.db.refresh(position)

        return position

    def toggle_plan_item(
        self,
        position_id: int,
        plan_type: str,  # 'buy', 'take_profit', 'stop_loss'
        index: int,
        completed: bool
    ) -> Position:
        """계획 항목의 완료 상태 토글"""
        position = self.get_position_by_id(position_id)
        if not position:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Position not found"
            )

        if plan_type == 'buy':
            if position.buy_plan and index < len(position.buy_plan):
                position.buy_plan[index]['completed'] = completed
                # SQLAlchemy JSON 변경 감지를 위해 새 리스트로
                position.buy_plan = list(position.buy_plan)
        elif plan_type == 'take_profit':
            if position.take_profit_targets and index < len(position.take_profit_targets):
                position.take_profit_targets[index]['completed'] = completed
                position.take_profit_targets = list(position.take_profit_targets)
        elif plan_type == 'stop_loss':
            if position.stop_loss_targets and index < len(position.stop_loss_targets):
                position.stop_loss_targets[index]['completed'] = completed
                position.stop_loss_targets = list(position.stop_loss_targets)

        self.db.commit()
        self.db.refresh(position)

        return position

    def confirm_position_info(self, position_id: int, confirm_data: PositionConfirmInfo) -> Position:
        """팀장이 포지션 정보를 확인/수정하고 확정"""
        position = self.get_position_by_id(position_id)
        if not position:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Position not found"
            )

        if position.status == PositionStatus.CLOSED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="종료된 포지션은 수정할 수 없습니다"
            )

        # 정보 업데이트
        position.average_buy_price = confirm_data.average_buy_price
        position.total_quantity = confirm_data.total_quantity

        # 진입 금액 계산 (제공되지 않으면 자동 계산)
        if confirm_data.total_buy_amount:
            position.total_buy_amount = confirm_data.total_buy_amount
        else:
            position.total_buy_amount = confirm_data.average_buy_price * confirm_data.total_quantity

        # 종목명 업데이트
        if confirm_data.ticker_name:
            position.ticker_name = confirm_data.ticker_name

        # 정보 확인 완료 표시
        position.is_info_confirmed = True

        self.db.commit()
        self.db.refresh(position)

        return position
