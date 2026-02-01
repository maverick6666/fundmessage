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

        request.status = RequestStatus.APPROVED.value
        request.approved_by = approved_by
        request.approved_at = datetime.utcnow()
        request.executed_price = approve_data.executed_price
        request.executed_quantity = approve_data.executed_quantity
        request.executed_at = approve_data.executed_at or datetime.utcnow()

        position = None

        if request.request_type == RequestType.BUY.value:
            # Check if open position exists for this ticker
            existing_position = self.position_service.get_open_position_by_ticker(
                request.target_ticker, request.target_market
            )

            if existing_position:
                # Add to existing position
                position = self.position_service.add_to_position(
                    existing_position,
                    approve_data.executed_quantity,
                    approve_data.executed_price,
                    request.take_profit_targets,
                    request.stop_loss_targets
                )
            else:
                # Create new position
                position_data = PositionCreate(
                    ticker=request.target_ticker,
                    ticker_name=request.ticker_name,
                    market=request.target_market,
                    average_buy_price=approve_data.executed_price,
                    total_quantity=approve_data.executed_quantity,
                    total_buy_amount=approve_data.executed_price * approve_data.executed_quantity,
                    take_profit_targets=[PriceTarget(**t) for t in request.take_profit_targets] if request.take_profit_targets else None,
                    stop_loss_targets=[PriceTarget(**t) for t in request.stop_loss_targets] if request.stop_loss_targets else None,
                    opened_by=request.requester_id
                )
                position = self.position_service.create_position(position_data)

            request.position_id = position.id

        elif request.request_type == RequestType.SELL.value:
            position = self.position_service.get_position_by_id(request.position_id)
            if position:
                # Reduce position quantity
                remaining_quantity = (position.total_quantity or Decimal(0)) - approve_data.executed_quantity

                if remaining_quantity <= 0:
                    # Close position completely
                    from app.schemas.position import PositionClose
                    close_data = PositionClose(
                        average_sell_price=approve_data.executed_price,
                        total_sell_amount=approve_data.executed_price * approve_data.executed_quantity,
                        closed_at=approve_data.executed_at
                    )
                    position = self.position_service.close_position(
                        position.id, close_data, approved_by
                    )
                else:
                    # Reduce position
                    position = self.position_service.reduce_position(
                        position, approve_data.executed_quantity
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
