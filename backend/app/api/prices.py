"""시세 조회 API"""
from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from decimal import Decimal

from app.database import get_db
from app.schemas.common import APIResponse
from app.services.price_service import price_service
from app.services.stock_search_service import stock_search_service
from app.services.position_service import PositionService
from app.dependencies import get_current_user
from app.models.user import User

router = APIRouter()


@router.get("/search", response_model=APIResponse)
async def search_stocks(
    q: str = Query(..., min_length=1, description="검색어 (종목명 또는 티커)"),
    market: Optional[str] = Query(None, description="KOSPI, KOSDAQ, NASDAQ, NYSE, CRYPTO"),
    limit: int = Query(20, ge=1, le=50),
    current_user: User = Depends(get_current_user)
):
    """종목 검색 (종목명 또는 티커로 검색)"""
    results = await stock_search_service.search_stocks(q, market, limit)

    return APIResponse(
        success=True,
        data={
            "query": q,
            "results": results,
            "count": len(results)
        }
    )


@router.get("/quote", response_model=APIResponse)
async def get_quote(
    ticker: str,
    market: str = Query(..., description="KOSPI, KOSDAQ, NASDAQ, NYSE, CRYPTO"),
    current_user: User = Depends(get_current_user)
):
    """단일 종목 시세 조회"""
    price = await price_service.get_price(ticker, market)

    if price is None:
        return APIResponse(
            success=False,
            message="시세를 조회할 수 없습니다"
        )

    return APIResponse(
        success=True,
        data={
            "ticker": ticker,
            "market": market,
            "price": float(price)
        }
    )


@router.get("/lookup", response_model=APIResponse)
async def lookup_ticker(
    ticker: str,
    market: str = Query(..., description="KOSPI, KOSDAQ, NASDAQ, NYSE, CRYPTO"),
    current_user: User = Depends(get_current_user)
):
    """종목 코드로 종목명과 현재가 조회"""
    result = await price_service.lookup_ticker(ticker, market)

    if result is None:
        return APIResponse(
            success=False,
            message="종목을 찾을 수 없습니다"
        )

    return APIResponse(
        success=True,
        data=result
    )


@router.get("/candles", response_model=APIResponse)
async def get_candles(
    ticker: str,
    market: str = Query(..., description="KOSPI, KOSDAQ, NASDAQ, NYSE, CRYPTO"),
    timeframe: str = Query("1d", description="1d, 1w, 1M, 1h 등"),
    limit: int = Query(300, ge=1, le=1000),
    current_user: User = Depends(get_current_user)
):
    """캔들(OHLCV) 데이터 조회

    - limit 기본값: 300 (약 1년치 일봉)
    - 최대 1000개까지 요청 가능
    """
    result = await price_service.get_candles(ticker, market, timeframe, limit)

    if result is None:
        return APIResponse(
            success=False,
            message="차트 데이터를 조회할 수 없습니다"
        )

    return APIResponse(
        success=True,
        data=result
    )


@router.get("/positions", response_model=APIResponse)
async def get_positions_with_prices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """열린 포지션들의 현재 시세 및 평가 정보"""
    position_service = PositionService(db)
    positions, _ = position_service.get_positions(status="open", limit=100)

    if not positions:
        return APIResponse(
            success=True,
            data={"positions": []}
        )

    price_info = await price_service.get_multiple_prices(positions)

    result = []
    for pos in positions:
        info = price_info.get(pos.id, {})
        result.append({
            "id": pos.id,
            "ticker": pos.ticker,
            "ticker_name": pos.ticker_name,
            "market": pos.market,
            "quantity": float(pos.total_quantity) if pos.total_quantity else 0,
            "average_buy_price": float(pos.average_buy_price) if pos.average_buy_price else 0,
            "total_buy_amount": float(pos.total_buy_amount) if pos.total_buy_amount else 0,
            "current_price": info.get("current_price"),
            "evaluation_amount": info.get("evaluation_amount"),
            "profit_loss": info.get("profit_loss"),
            "profit_rate": info.get("profit_rate"),
            "is_info_confirmed": pos.is_info_confirmed
        })

    return APIResponse(
        success=True,
        data={"positions": result}
    )
