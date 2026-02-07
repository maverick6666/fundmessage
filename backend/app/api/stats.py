from datetime import date, datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from app.database import get_db
from app.schemas.common import APIResponse
from app.services.stats_service import StatsService
from app.services.price_service import PriceService
from app.models.position import Position, PositionStatus
from app.models.attendance import Attendance
from app.models.request import Request
from app.dependencies import get_current_user
from app.models.user import User

# 한국 시간대
KST = timezone(timedelta(hours=9))

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


@router.get("/team-ranking", response_model=APIResponse)
async def get_team_ranking(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """팀원 랭킹 (대시보드용)

    반환 데이터:
    - 평균 수익률 (미실현 포함)
    - 총 수익금 (미실현 포함)
    - 주간 출석률
    - 정렬: 팀장 → 관리자 → 팀원
    """
    # 모든 팀원 조회
    users = db.query(User).filter(User.is_active == True).all()

    # 열린 포지션 시세 조회
    open_positions = db.query(Position).filter(
        Position.status == PositionStatus.OPEN.value
    ).all()

    price_data = {}
    if open_positions:
        price_service = PriceService()
        price_data = await price_service.get_multiple_prices(open_positions)

    # 이번 주 시작일 (월요일)
    today = datetime.now(KST).date()
    week_start = today - timedelta(days=today.weekday())

    # 전체 평균 주간 출석률 계산용
    total_week_rate = 0
    user_count = 0

    result = []
    for user in users:
        # 해당 유저가 관련된 포지션 ID 조회 (요청자 또는 개설자)
        position_ids_query = db.query(Position.id).join(
            Request, Position.id == Request.position_id, isouter=True
        ).filter(
            (Position.opened_by == user.id) | (Request.requester_id == user.id)
        ).distinct().all()

        position_ids = [p[0] for p in position_ids_query]
        user_positions = db.query(Position).filter(Position.id.in_(position_ids)).all() if position_ids else []

        # 수익률/수익금 계산
        total_profit = 0
        total_investment = 0
        position_count = 0
        open_positions = 0
        closed_positions = 0
        winning_trades = 0
        losing_trades = 0

        for pos in user_positions:
            avg_price = float(pos.average_buy_price) if pos.average_buy_price else 0
            quantity = float(pos.total_quantity) if pos.total_quantity else 0

            # 포지션 평가액 계산
            if pos.status == PositionStatus.OPEN.value:
                open_positions += 1
                # 열린 포지션: 실시간 시세 사용
                current_price = price_data.get(pos.id, {}).get('current_price', avg_price)
                if current_price and avg_price and quantity:
                    unrealized = (float(current_price) - avg_price) * quantity
                    investment = avg_price * quantity
                    total_profit += unrealized
                    total_investment += investment
                    position_count += 1
            else:
                closed_positions += 1
                # 종료된 포지션: 확정 수익 사용
                if pos.profit_loss is not None:
                    total_profit += float(pos.profit_loss)
                    if avg_price and quantity:
                        total_investment += avg_price * quantity
                    position_count += 1
                    # 승/패 계산
                    if pos.profit_loss > 0:
                        winning_trades += 1
                    elif pos.profit_loss < 0:
                        losing_trades += 1

        # 평균 수익률 계산
        avg_profit_rate = (total_profit / total_investment * 100) if total_investment > 0 else 0

        # 승률 계산
        total_trades = winning_trades + losing_trades
        win_rate = (winning_trades / total_trades * 100) if total_trades > 0 else 0

        # 주간 출석률 계산
        week_attendances = db.query(Attendance).filter(
            Attendance.user_id == user.id,
            Attendance.date >= week_start,
            Attendance.date <= today
        ).all()

        week_total = len(week_attendances)
        week_present = len([a for a in week_attendances if a.status in ['present', 'recovered']])
        week_rate = (week_present / week_total * 100) if week_total > 0 else 0

        # 이번달 출석률 계산
        month_start = today.replace(day=1)
        month_attendances = db.query(Attendance).filter(
            Attendance.user_id == user.id,
            Attendance.date >= month_start,
            Attendance.date <= today
        ).all()
        month_total = len(month_attendances)
        month_present = len([a for a in month_attendances if a.status in ['present', 'recovered']])
        month_rate = (month_present / month_total * 100) if month_total > 0 else 0

        # 전체 출석률 계산
        all_attendances = db.query(Attendance).filter(
            Attendance.user_id == user.id
        ).all()
        all_total = len(all_attendances)
        all_present = len([a for a in all_attendances if a.status in ['present', 'recovered']])
        total_rate = (all_present / all_total * 100) if all_total > 0 else 0

        if week_total > 0:
            total_week_rate += week_rate
            user_count += 1

        # 역할 정렬 우선순위
        role_priority = {'manager': 0, 'admin': 1, 'member': 2}

        result.append({
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role,
            "role_priority": role_priority.get(user.role, 3),
            "avg_profit_rate": round(avg_profit_rate, 2),
            "total_profit": round(total_profit, 0),
            "position_count": position_count,
            "total_trades": total_trades,
            "win_rate": round(win_rate, 1),
            "winning_trades": winning_trades,
            "losing_trades": losing_trades,
            "open_positions": open_positions,
            "closed_positions": closed_positions,
            "week_attendance_rate": round(week_rate, 1),
            "month_attendance_rate": round(month_rate, 1),
            "total_attendance_rate": round(total_rate, 1),
            "week_present": week_present,
            "week_total": week_total
        })

    # 정렬: 역할 우선순위 → 이름
    result.sort(key=lambda x: (x['role_priority'], x['full_name']))

    # 평균 주간 출석률
    avg_week_rate = (total_week_rate / user_count) if user_count > 0 else 0

    return APIResponse(
        success=True,
        data={
            "members": result,
            "avg_week_attendance_rate": round(avg_week_rate, 1),
            "total_members": len(result)
        }
    )
