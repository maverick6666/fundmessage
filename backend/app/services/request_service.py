from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.request import Request, RequestType, RequestStatus
from app.models.position import Position, PositionStatus
from app.schemas.request import BuyRequestCreate, SellRequestCreate, RequestApprove
from app.schemas.position import PositionCreate, PriceTarget
from app.services.position_service import PositionService


class RequestService:
    def __init__(self, db: Session):
        self.db = db
        self.position_service = PositionService(db)

    def get_request_by_id(self, request_id: int) -> Optional[Request]:
        return self.db.query(Request).filter(Request.id == request_id).first()

    def get_requests(
        self,
        status: Optional[str] = None,
        request_type: Optional[str] = None,
        requester_id: Optional[int] = None,
        page: int = 1,
        limit: int = 20
    ) -> tuple[List[Request], int]:
        query = self.db.query(Request)

        if status:
            query = query.filter(Request.status == status)
        if request_type:
            query = query.filter(Request.request_type == request_type)
        if requester_id:
            query = query.filter(Request.requester_id == requester_id)

        total = query.count()
        requests = query.order_by(Request.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

        return requests, total

    def _convert_targets_to_json(self, targets) -> list:
        """Decimal을 float로 변환하여 JSON 직렬화 가능하게 함"""
        if not targets:
            return None
        result = []
        for t in targets:
            item = t.model_dump() if hasattr(t, 'model_dump') else t
            # Decimal을 float로 변환
            result.append({
                k: float(v) if isinstance(v, Decimal) else v
                for k, v in item.items()
            })
        return result

    def create_buy_request(self, request_data: BuyRequestCreate, requester_id: int) -> Request:
        request = Request(
            requester_id=requester_id,
            request_type=RequestType.BUY.value,
            target_ticker=request_data.target_ticker,
            ticker_name=request_data.ticker_name,
            target_market=request_data.target_market,
            order_type=request_data.order_type,
            order_amount=request_data.order_amount,
            order_quantity=request_data.order_quantity,
            buy_price=request_data.buy_price,
            buy_orders=None,  # Legacy field - not used
            target_ratio=request_data.target_ratio,
            take_profit_targets=self._convert_targets_to_json(request_data.take_profit_targets),
            stop_loss_targets=self._convert_targets_to_json(request_data.stop_loss_targets),
            memo=request_data.memo,
            status=RequestStatus.PENDING.value
        )

        self.db.add(request)
        self.db.commit()
        self.db.refresh(request)

        return request

    def create_sell_request(self, request_data: SellRequestCreate, requester_id: int) -> Request:
        # Verify position exists and is open
        position = self.position_service.get_position_by_id(request_data.position_id)
        if not position:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Position not found"
            )
        if position.status != PositionStatus.OPEN.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Position is not open"
            )

        request = Request(
            requester_id=requester_id,
            position_id=request_data.position_id,
            request_type=RequestType.SELL.value,
            target_ticker=position.ticker,
            target_market=position.market,
            sell_quantity=request_data.sell_quantity,
            sell_price=request_data.sell_price,
            sell_reason=request_data.sell_reason,
            status=RequestStatus.PENDING.value
        )

        self.db.add(request)
        self.db.commit()
        self.db.refresh(request)

        return request

    def _add_completed_flag_to_targets(self, targets: list, all_completed: bool = False) -> list:
        """타겟 리스트에 completed 플래그 추가"""
        if not targets:
            return None
        return [
            {**t, "completed": all_completed}
            for t in targets
        ]

    def _create_buy_plan(self, request) -> list:
        """요청에서 매수 계획 생성 (첫 번째만 완료 처리)"""
        buy_plan = []

        # 분할 매수 계획이 있는 경우
        if request.buy_orders and len(request.buy_orders) > 0:
            for i, order in enumerate(request.buy_orders):
                buy_plan.append({
                    "price": float(order.get("price", 0)),
                    "ratio": float(order.get("ratio", 0)),
                    "completed": (i == 0)  # 첫 번째만 완료
                })
        # 단일 매수인 경우
        elif request.buy_price and request.order_quantity:
            buy_plan.append({
                "price": float(request.buy_price),
                "quantity": float(request.order_quantity),
                "completed": True  # 단일 매수는 완료 처리
            })

        return buy_plan if buy_plan else None

    def approve_request(self, request_id: int, approve_data: RequestApprove, approved_by: int) -> tuple[Request, Optional[Position]]:
        request = self.get_request_by_id(request_id)
        if not request:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Request not found"
            )

        if request.status != RequestStatus.PENDING.value and request.status != RequestStatus.DISCUSSION.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Request cannot be approved (current status: {request.status})"
            )

        # 요청자의 희망가/수량 사용 (팀장이 별도 입력 안 하면)
        executed_price = approve_data.executed_price or request.buy_price
        executed_quantity = approve_data.executed_quantity or request.order_quantity

        # 매수 요청인데 가격/수량이 없으면 에러
        if request.request_type == RequestType.BUY.value:
            if not executed_price or not executed_quantity:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="매수 가격과 수량이 필요합니다"
                )

        request.status = RequestStatus.APPROVED.value
        request.approved_by = approved_by
        request.approved_at = datetime.utcnow()
        request.executed_price = executed_price
        request.executed_quantity = executed_quantity
        request.executed_at = approve_data.executed_at or datetime.utcnow()

        position = None

        if request.request_type == RequestType.BUY.value:
            # Check if open position exists for this ticker
            existing_position = self.position_service.get_open_position_by_ticker(
                request.target_ticker, request.target_market
            )

            # 익절/손절 타겟에 completed 플래그 추가 (모두 미완료)
            tp_targets = self._add_completed_flag_to_targets(request.take_profit_targets, False)
            sl_targets = self._add_completed_flag_to_targets(request.stop_loss_targets, False)

            # 매수 계획 생성
            buy_plan = self._create_buy_plan(request)

            if existing_position:
                # Add to existing position (기존 포지션에 추가 매수)
                position = self.position_service.add_to_position(
                    existing_position,
                    executed_quantity,
                    executed_price,
                    tp_targets,
                    sl_targets,
                    buy_plan
                )
            else:
                # Create new position (is_info_confirmed = False)
                position = self.position_service.create_position_from_request(
                    ticker=request.target_ticker,
                    ticker_name=request.ticker_name,
                    market=request.target_market,
                    buy_price=executed_price,
                    quantity=executed_quantity,
                    buy_plan=buy_plan,
                    take_profit_targets=tp_targets,
                    stop_loss_targets=sl_targets,
                    opened_by=request.requester_id
                )

            request.position_id = position.id

        elif request.request_type == RequestType.SELL.value:
            position = self.position_service.get_position_by_id(request.position_id)
            sell_price = approve_data.executed_price or request.sell_price
            sell_quantity = approve_data.executed_quantity or request.sell_quantity

            if not sell_quantity:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="매도 수량이 필요합니다"
                )

            if position:
                # Reduce position quantity
                remaining_quantity = (position.total_quantity or Decimal(0)) - sell_quantity

                if remaining_quantity <= 0:
                    # Close position completely
                    from app.schemas.position import PositionClose
                    close_data = PositionClose(
                        average_sell_price=sell_price,
                        total_sell_amount=sell_price * sell_quantity if sell_price else sell_quantity * (position.average_buy_price or Decimal(0)),
                        closed_at=approve_data.executed_at
                    )
                    position = self.position_service.close_position(
                        position.id, close_data, approved_by
                    )
                else:
                    # Reduce position
                    position = self.position_service.reduce_position(
                        position, sell_quantity
                    )

        self.db.commit()
        self.db.refresh(request)

        return request, position

    def reject_request(self, request_id: int, rejection_reason: str, rejected_by: int) -> Request:
        request = self.get_request_by_id(request_id)
        if not request:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Request not found"
            )

        if request.status != RequestStatus.PENDING.value and request.status != RequestStatus.DISCUSSION.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Request cannot be rejected (current status: {request.status})"
            )

        request.status = RequestStatus.REJECTED.value
        request.approved_by = rejected_by
        request.approved_at = datetime.utcnow()
        request.rejection_reason = rejection_reason

        self.db.commit()
        self.db.refresh(request)

        return request

    def start_discussion(self, request_id: int) -> Request:
        request = self.get_request_by_id(request_id)
        if not request:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Request not found"
            )

        if request.status != RequestStatus.PENDING.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Discussion cannot be started (current status: {request.status})"
            )

        request.status = RequestStatus.DISCUSSION.value

        self.db.commit()
        self.db.refresh(request)

        return request
