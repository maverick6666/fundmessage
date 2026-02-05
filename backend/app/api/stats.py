from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.common import APIResponse
from app.services.stats_service import StatsService
from app.services.price_service import PriceService
from app.models.position import Position, PositionStatus
from app.dependencies import get_current_user
from app.models.user import User

router = APIRouter()


@router.get("/users/{user_id}", response_model=APIResponse)
async def get_user_stats(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get user statistics"""
    stats_service = StatsService(db)
    stats = stats_service.get_user_stats(user_id)

    if not stats:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return APIResponse(
        success=True,
        data=stats
    )


@router.get("/team", response_model=APIResponse)
async def get_team_stats(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get team statistics with real-time price data"""
    # 열린 포지션 시세 조회
    open_positions = db.query(Position).filter(
        Position.status == PositionStatus.OPEN.value
    ).all()

    price_data = {}
    if open_positions:
        price_service = PriceService()
        price_data = await price_service.get_multiple_prices(open_positions)

    stats_service = StatsService(db)
    stats = stats_service.get_team_stats(start_date, end_date, price_data=price_data)

    return APIResponse(
        success=True,
        data=stats
    )


@router.get("/exchange-rate", response_model=APIResponse)
async def get_exchange_rate(
    current_user: User = Depends(get_current_user)
):
    """Get USD/KRW exchange rate"""
    try:
        import yfinance as yf
        ticker = yf.Ticker("USDKRW=X")
        hist = ticker.history(period="1d")
        if not hist.empty:
            rate = float(hist['Close'].iloc[-1])
        else:
            rate = None
    except Exception:
        rate = None

    return APIResponse(
        success=True,
        data={"usd_krw": rate}
    )
