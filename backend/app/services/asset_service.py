"""
자산 스냅샷 서비스 - 일별 자산 히스토리 자동 생성
"""
import asyncio
import logging
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
from decimal import Decimal

from app.models.asset_snapshot import AssetSnapshot
from app.models.team_settings import TeamSettings
from app.models.position import Position
from app.services.price_service import PriceService
from app.utils.constants import KST

logger = logging.getLogger(__name__)


async def create_daily_snapshot_async(db: Session) -> AssetSnapshot:
    """일별 자산 스냅샷 생성 (KST 기준, async)"""
    today = datetime.now(KST).date()

    # 이미 오늘 스냅샷이 있으면 반환
    existing = db.query(AssetSnapshot).filter(
        AssetSnapshot.snapshot_date == today
    ).first()
    if existing:
        return existing

    # 팀 설정에서 초기 자본 가져오기
    settings = db.query(TeamSettings).first()
    initial_krw = Decimal(str(settings.initial_capital_krw or 0)) if settings else Decimal("0")
    initial_usd = Decimal(str(settings.initial_capital_usd or 0)) if settings else Decimal("0")

    # 열린 포지션 조회
    open_positions = db.query(Position).filter(
        Position.status == 'open'
    ).all()

    # 시세 서비스로 현재가 조회
    price_service = PriceService()
    krw_eval = Decimal("0")
    usd_eval = Decimal("0")
    usdt_eval = Decimal("0")
    krw_invested = Decimal("0")
    usd_invested = Decimal("0")
    usdt_invested = Decimal("0")
    position_details = []

    for p in open_positions:
        market = (p.market or "").upper()
        quantity = Decimal(str(p.total_quantity or 0))
        avg_price = Decimal(str(p.average_buy_price or 0))
        buy_amount = Decimal(str(p.total_buy_amount or 0))

        # 현재가 조회
        try:
            current_price = await price_service.get_price(p.ticker, market)
        except Exception as e:
            logger.warning(f"Failed to get price for {p.ticker} ({market}): {e}")
            current_price = None

        if current_price is None:
            # 시세 조회 실패 시 매입가로 대체
            current_price = avg_price
            logger.warning(f"Using avg buy price for {p.ticker}: {avg_price}")

        eval_amount = current_price * quantity
        pnl = eval_amount - buy_amount

        # 마켓별 합산
        if market in ['KRX', 'KOSPI', 'KOSDAQ']:
            krw_eval += eval_amount
            krw_invested += buy_amount
        elif market in ['NASDAQ', 'NYSE', 'AMEX']:
            usd_eval += eval_amount
            usd_invested += buy_amount
        elif market in ['CRYPTO', 'BINANCE']:
            usdt_eval += eval_amount
            usdt_invested += buy_amount

        # 포지션별 상세
        position_details.append({
            "position_id": p.id,
            "ticker": p.ticker,
            "ticker_name": p.ticker_name,
            "market": market,
            "quantity": float(quantity),
            "avg_price": float(avg_price),
            "current_price": float(current_price),
            "eval_amount": float(eval_amount),
            "buy_amount": float(buy_amount),
            "pnl": float(pnl),
            "pnl_rate": float((pnl / buy_amount * 100) if buy_amount else 0),
        })

    # 현금 = 초기자본 - 투자금액
    krw_cash = initial_krw - krw_invested
    usd_cash = initial_usd - usd_invested

    # 종료 포지션 실현손익
    realized_pnl_row = db.query(
        func.coalesce(func.sum(Position.realized_profit_loss), 0)
    ).filter(
        Position.status == 'closed',
        Position.realized_profit_loss.isnot(None)
    ).scalar()
    realized_pnl = Decimal(str(realized_pnl_row or 0))

    # 미실현손익 = 평가액 - 투자금액
    unrealized_pnl = (krw_eval - krw_invested) + (usd_eval - usd_invested) + (usdt_eval - usdt_invested)

    # 환율 (하드코딩, 추후 실시간 API 연동)
    exchange_rate = Decimal("1350.0")

    # 전체 KRW 환산
    total_krw = (
        krw_cash + krw_eval +
        (usd_cash + usd_eval) * exchange_rate +
        usdt_eval * exchange_rate
    )

    # 스냅샷 생성
    snapshot = AssetSnapshot(
        snapshot_date=today,
        krw_cash=krw_cash,
        krw_evaluation=krw_eval,
        usd_cash=usd_cash,
        usd_evaluation=usd_eval,
        usdt_evaluation=usdt_eval,
        total_krw=total_krw,
        exchange_rate=exchange_rate,
        realized_pnl=realized_pnl,
        unrealized_pnl=unrealized_pnl,
        position_details=position_details,
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)

    logger.info(
        f"Snapshot created: {today}, total={float(total_krw):.0f} KRW, "
        f"{len(open_positions)} positions, realized={float(realized_pnl):.0f}, unrealized={float(unrealized_pnl):.0f}"
    )
    return snapshot


def create_daily_snapshot(db: Session) -> AssetSnapshot:
    """동기 래퍼 (스케줄러 호환)"""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(create_daily_snapshot_async(db))
    finally:
        loop.close()


def get_asset_history(db: Session, days: int = 30) -> list[AssetSnapshot]:
    """자산 히스토리 조회"""
    return db.query(AssetSnapshot).order_by(
        AssetSnapshot.snapshot_date.desc()
    ).limit(days).all()
