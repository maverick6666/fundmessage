"""
자산 스냅샷 서비스 - 일별 자산 히스토리 자동 생성
"""
from datetime import datetime
from zoneinfo import ZoneInfo
from sqlalchemy.orm import Session
from decimal import Decimal

from app.models.asset_snapshot import AssetSnapshot
from app.models.team_settings import TeamSettings
from app.models.position import Position

KST = ZoneInfo("Asia/Seoul")


def create_daily_snapshot(db: Session) -> AssetSnapshot:
    """일별 자산 스냅샷 생성 (KST 기준)"""
    today = datetime.now(KST).date()

    # 이미 오늘 스냅샷이 있으면 반환
    existing = db.query(AssetSnapshot).filter(
        AssetSnapshot.snapshot_date == today
    ).first()
    if existing:
        return existing

    # 팀 설정에서 현금 잔액 가져오기
    settings = db.query(TeamSettings).first()
    krw_cash = Decimal(str(settings.initial_capital_krw or 0)) if settings else Decimal("0")
    usd_cash = Decimal(str(settings.initial_capital_usd or 0)) if settings else Decimal("0")

    # 열린 포지션의 평가액 계산
    open_positions = db.query(Position).filter(
        Position.status == 'open'
    ).all()

    krw_eval = Decimal("0")
    usd_eval = Decimal("0")
    usdt_eval = Decimal("0")

    for p in open_positions:
        current_value = Decimal(str(p.current_value or 0))
        market = (p.market or "").upper()

        if market in ['KRX', 'KOSPI', 'KOSDAQ']:
            krw_eval += current_value
        elif market in ['NASDAQ', 'NYSE', 'AMEX']:
            usd_eval += current_value
        elif market in ['CRYPTO', 'BINANCE']:
            usdt_eval += current_value

    # 환율 (추후 실시간 환율 API 연동 가능)
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
        exchange_rate=exchange_rate
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return snapshot


def get_asset_history(db: Session, days: int = 30) -> list[AssetSnapshot]:
    """자산 히스토리 조회"""
    return db.query(AssetSnapshot).order_by(
        AssetSnapshot.snapshot_date.desc()
    ).limit(days).all()
