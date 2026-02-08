from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from sqlalchemy.orm.attributes import flag_modified

from app.models.position import Position, PositionStatus
from app.schemas.position import PositionCreate, PositionUpdate, PositionClose, PositionConfirmInfo
from app.services.audit_service import AuditService


class PositionService:
    def __init__(self, db: Session):
        self.db = db

    def _convert_targets(self, targets) -> Optional[list]:
        """Decimal을 float로 변환하여 JSON 직렬화 가능하게 함. 빈 항목(가격/수량 없음) 필터링."""
        if not targets:
            return None
        result = []
        for t in targets:
            item = t.model_dump() if hasattr(t, 'model_dump') else t
            # 빈 항목 필터링 (가격과 수량 둘 다 있어야 유효)
            if not item.get('price') or not item.get('quantity'):
                continue
            result.append({
                k: float(v) if isinstance(v, Decimal) else v
                for k, v in item.items()
            })
        return result if result else None

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
            # timezone-aware/naive datetime 호환 처리
            opened = position.opened_at.replace(tzinfo=None) if position.opened_at.tzinfo else position.opened_at
            closed = position.closed_at.replace(tzinfo=None) if position.closed_at.tzinfo else position.closed_at
            delta = closed - opened
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
        completed: bool,
        user_id: int = None
    ) -> Position:
        """계획 항목의 완료 상태 토글 - 실제 포지션에 영향을 줌"""
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

        old_value = None
        new_value = None
        field_name = None
        changes = {}

        if plan_type == 'buy':
            if position.buy_plan and index < len(position.buy_plan):
                item = position.buy_plan[index]
                old_completed = item.get('completed', False)

                # 이미 같은 상태면 무시
                if old_completed == completed:
                    return position

                # 매수 체크: 수량 증가, 평균단가 재계산
                if completed and not old_completed:
                    buy_price = Decimal(str(item.get('price', 0)))
                    buy_quantity = Decimal(str(item.get('quantity', 0)))

                    if buy_price > 0 and buy_quantity > 0:
                        old_qty = position.total_quantity or Decimal(0)
                        old_amount = position.total_buy_amount or Decimal(0)
                        new_amount = buy_price * buy_quantity

                        position.total_quantity = old_qty + buy_quantity
                        position.total_buy_amount = old_amount + new_amount

                        if position.total_quantity > 0:
                            position.average_buy_price = position.total_buy_amount / position.total_quantity

                        changes['total_quantity'] = {'old': float(old_qty), 'new': float(position.total_quantity)}
                        changes['average_buy_price'] = {'old': float(position.average_buy_price or 0), 'new': float(position.average_buy_price)}

                # 매수 체크 해제: 수량 감소 (체크 해제는 허용하지 않음)
                elif not completed and old_completed:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="체결된 매수는 취소할 수 없습니다. 매도 계획을 사용하세요."
                    )

                position.buy_plan[index]['completed'] = completed
                old_value = old_completed
                new_value = completed
                field_name = f"buy_plan[{index}].completed"
                flag_modified(position, 'buy_plan')

        elif plan_type in ['take_profit', 'stop_loss']:
            targets = position.take_profit_targets if plan_type == 'take_profit' else position.stop_loss_targets
            target_name = 'take_profit_targets' if plan_type == 'take_profit' else 'stop_loss_targets'
            label = '익절' if plan_type == 'take_profit' else '손절'

            if targets and index < len(targets):
                item = targets[index]
                old_completed = item.get('completed', False)

                if old_completed == completed:
                    return position

                # 익절/손절 체크: 수량 감소, 실현손익 계산
                if completed and not old_completed:
                    sell_price = Decimal(str(item.get('price', 0)))
                    sell_quantity = Decimal(str(item.get('quantity', 0)))

                    if sell_price > 0 and sell_quantity > 0:
                        current_qty = position.total_quantity or Decimal(0)

                        if sell_quantity > current_qty:
                            raise HTTPException(
                                status_code=status.HTTP_400_BAD_REQUEST,
                                detail=f"{label} 수량({sell_quantity})이 보유 수량({current_qty})보다 많습니다"
                            )

                        # 실현손익 계산
                        avg_buy = position.average_buy_price or Decimal(0)
                        realized_pnl = (sell_price - avg_buy) * sell_quantity

                        old_qty = float(current_qty)
                        old_realized = float(position.realized_profit_loss or 0)

                        position.total_quantity = current_qty - sell_quantity
                        position.total_buy_amount = position.total_quantity * avg_buy
                        position.realized_profit_loss = (position.realized_profit_loss or Decimal(0)) + realized_pnl

                        changes['total_quantity'] = {'old': old_qty, 'new': float(position.total_quantity)}
                        changes['realized_profit_loss'] = {'old': old_realized, 'new': float(position.realized_profit_loss)}

                # 익절/손절 체크 해제는 허용하지 않음
                elif not completed and old_completed:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"체결된 {label}은 취소할 수 없습니다"
                    )

                targets[index]['completed'] = completed
                old_value = old_completed
                new_value = completed
                field_name = f"{target_name}[{index}].completed"
                flag_modified(position, target_name)

        self.db.commit()
        self.db.refresh(position)

        # Audit log
        if user_id and field_name:
            audit_service = AuditService(self.db)
            if changes:
                audit_service.log_multiple_changes(
                    entity_type='position',
                    entity_id=position_id,
                    user_id=user_id,
                    changes=changes
                )
            else:
                audit_service.log_change(
                    entity_type='position',
                    entity_id=position_id,
                    action='toggle',
                    user_id=user_id,
                    field_name=field_name,
                    old_value=old_value,
                    new_value=new_value
                )

        return position

    def get_position_status_info(self, position: Position) -> dict:
        """포지션의 상태 정보 계산 (팀장 주의 필요 여부 등)"""
        if position.status == PositionStatus.CLOSED.value:
            return {'status': 'closed', 'alert': None}

        current_qty = float(position.total_quantity or 0)

        # 유효한 계획 항목 수 계산 (가격과 수량이 있는 것만)
        def count_valid_items(items, completed_only=False):
            if not items:
                return 0
            return sum(1 for i in items
                      if i.get('price') and i.get('quantity') and
                      (not completed_only or i.get('completed', False)))

        def count_pending_items(items):
            if not items:
                return 0
            return sum(1 for i in items
                      if i.get('price') and i.get('quantity') and not i.get('completed', False))

        pending_tp = count_pending_items(position.take_profit_targets)
        pending_sl = count_pending_items(position.stop_loss_targets)
        pending_buy = count_pending_items(position.buy_plan)

        completed_tp = count_valid_items(position.take_profit_targets, completed_only=True)
        completed_sl = count_valid_items(position.stop_loss_targets, completed_only=True)

        # 케이스 1: 잔량이 0인데 포지션이 열려있음 → 종료 필요
        if current_qty <= 0:
            return {
                'status': 'needs_close',
                'alert': 'danger',
                'message': '잔량 0 - 포지션 종료 필요'
            }

        # 케이스 2: 잔량이 있는데 모든 매도 계획이 완료됨 → 계획 필요
        if pending_tp == 0 and pending_sl == 0 and (completed_tp > 0 or completed_sl > 0):
            return {
                'status': 'no_plan',
                'alert': 'warning',
                'message': '매도 계획 없음'
            }

        # 케이스 3: 잔량이 있는데 매도 계획 자체가 없음 → 계획 필요
        total_valid_tp = count_valid_items(position.take_profit_targets)
        total_valid_sl = count_valid_items(position.stop_loss_targets)
        if total_valid_tp == 0 and total_valid_sl == 0:
            return {
                'status': 'no_plan',
                'alert': 'warning',
                'message': '매도 계획 없음'
            }

        # 정상
        return {'status': 'normal', 'alert': None}

    def _normalize_plan_item(self, item: dict) -> dict:
        """계획 항목을 정규화 (비교용)"""
        return {
            'price': float(item.get('price') or 0),
            'quantity': float(item.get('quantity') or 0),
            'completed': bool(item.get('completed', False))
        }

    def _is_valid_plan_item(self, item: dict) -> bool:
        """유효한 계획 항목인지 확인 (가격과 수량이 있는지)"""
        return bool(item.get('price')) and bool(item.get('quantity'))

    def _compare_plans(self, old_list: list, new_list: list, plan_name: str) -> list:
        """두 계획 리스트를 비교하여 변경사항 설명 반환"""
        changes = []
        old_list = old_list or []
        new_list = new_list or []

        # 유효한 항목만 비교 (빈 항목 제외)
        old_valid = [self._normalize_plan_item(i) for i in old_list if self._is_valid_plan_item(i)]
        new_valid = [self._normalize_plan_item(i) for i in new_list if self._is_valid_plan_item(i)]

        # 개수 변화
        if len(new_valid) > len(old_valid):
            added_items = new_valid[len(old_valid):]
            for item in added_items:
                changes.append(f"{plan_name} 추가: {item['price']:,.0f}×{item['quantity']:.2g}")
        elif len(new_valid) < len(old_valid):
            removed_items = old_valid[len(new_valid):]
            for item in removed_items:
                changes.append(f"{plan_name} 삭제: {item['price']:,.0f}×{item['quantity']:.2g}")

        # 기존 항목 수정 확인
        for i, (old_item, new_item) in enumerate(zip(old_valid, new_valid)):
            if old_item['price'] != new_item['price'] or old_item['quantity'] != new_item['quantity']:
                changes.append(f"{plan_name} {i+1}번 수정: {old_item['price']:,.0f}×{old_item['quantity']:.2g} → {new_item['price']:,.0f}×{new_item['quantity']:.2g}")

        return changes

    def update_plans(
        self,
        position_id: int,
        buy_plan: Optional[list] = None,
        take_profit_targets: Optional[list] = None,
        stop_loss_targets: Optional[list] = None,
        user_id: int = None,
        skip_audit: bool = True  # 기본적으로 개별 수정은 감사 로그 스킵 (매매계획 저장 시 한번에 기록)
    ) -> Position:
        """매매 계획 수정 (분할매수, 익절, 손절)"""
        position = self.get_position_by_id(position_id)
        if not position:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Position not found"
            )

        change_descriptions = []

        if buy_plan is not None:
            change_descriptions.extend(self._compare_plans(position.buy_plan, buy_plan, "매수계획"))
            position.buy_plan = self._convert_targets(buy_plan) if buy_plan else None
            flag_modified(position, 'buy_plan')

        if take_profit_targets is not None:
            change_descriptions.extend(self._compare_plans(position.take_profit_targets, take_profit_targets, "익절계획"))
            position.take_profit_targets = self._convert_targets(take_profit_targets) if take_profit_targets else None
            flag_modified(position, 'take_profit_targets')

        if stop_loss_targets is not None:
            change_descriptions.extend(self._compare_plans(position.stop_loss_targets, stop_loss_targets, "손절계획"))
            position.stop_loss_targets = self._convert_targets(stop_loss_targets) if stop_loss_targets else None
            flag_modified(position, 'stop_loss_targets')

        self.db.commit()
        self.db.refresh(position)

        # Audit log - skip_audit=False이고 실제 변경사항이 있을 때만 기록
        # (개별 항목 수정은 스킵, 매매계획 저장 시 한번에 기록)
        if not skip_audit and user_id and change_descriptions:
            audit_service = AuditService(self.db)
            audit_service.log_change(
                entity_type='position',
                entity_id=position_id,
                action=', '.join(change_descriptions),
                user_id=user_id
            )

        return position

    def confirm_position_info(self, position_id: int, confirm_data: PositionConfirmInfo, user_id: int = None) -> Position:
        """팀장이 포지션 정보를 확인/수정하고 확정 (종료된 포지션도 수정 가능 - 기록 목적)"""
        position = self.get_position_by_id(position_id)
        if not position:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Position not found"
            )

        # 변경 이력을 위한 이전 값 저장
        changes = {}

        if position.average_buy_price != confirm_data.average_buy_price:
            changes['average_buy_price'] = {
                'old': position.average_buy_price,
                'new': confirm_data.average_buy_price
            }
        if position.total_quantity != confirm_data.total_quantity:
            changes['total_quantity'] = {
                'old': position.total_quantity,
                'new': confirm_data.total_quantity
            }
        if confirm_data.ticker_name and position.ticker_name != confirm_data.ticker_name:
            changes['ticker_name'] = {
                'old': position.ticker_name,
                'new': confirm_data.ticker_name
            }

        # 정보 업데이트
        position.average_buy_price = confirm_data.average_buy_price
        position.total_quantity = confirm_data.total_quantity

        # 진입 금액 계산 (제공되지 않으면 자동 계산)
        new_buy_amount = confirm_data.total_buy_amount or (confirm_data.average_buy_price * confirm_data.total_quantity)
        if position.total_buy_amount != new_buy_amount:
            changes['total_buy_amount'] = {
                'old': position.total_buy_amount,
                'new': new_buy_amount
            }
        position.total_buy_amount = new_buy_amount

        # 종목명 업데이트
        if confirm_data.ticker_name:
            position.ticker_name = confirm_data.ticker_name

        # 정보 확인 완료 표시
        if not position.is_info_confirmed:
            changes['is_info_confirmed'] = {'old': False, 'new': True}
        position.is_info_confirmed = True

        self.db.commit()
        self.db.refresh(position)

        # Audit log
        if user_id and changes:
            audit_service = AuditService(self.db)
            audit_service.log_multiple_changes(
                entity_type='position',
                entity_id=position_id,
                user_id=user_id,
                changes=changes
            )

        return position
