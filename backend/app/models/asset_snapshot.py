# backend/app/models/asset_snapshot.py
from datetime import datetime, date
from sqlalchemy import Column, Integer, Date, Numeric, DateTime
from app.database import Base


class AssetSnapshot(Base):
    """일별 자산 스냅샷 - 팀 전체 자산 히스토리 추적용"""
    __tablename__ = "asset_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    snapshot_date = Column(Date, unique=True, index=True, nullable=False)

    # KRW 자산
    krw_cash = Column(Numeric(20, 2), default=0)  # KRW 현금
    krw_evaluation = Column(Numeric(20, 2), default=0)  # KRW 평가액

    # USD 자산
    usd_cash = Column(Numeric(20, 4), default=0)  # USD 현금
    usd_evaluation = Column(Numeric(20, 4), default=0)  # USD 평가액

    # USDT 자산
    usdt_evaluation = Column(Numeric(20, 4), default=0)  # USDT 평가액

    # 합산 (KRW 기준)
    total_krw = Column(Numeric(20, 2), default=0)  # 전체 자산 (KRW 환산)
    exchange_rate = Column(Numeric(10, 2), nullable=True)  # 스냅샷 당시 환율

    created_at = Column(DateTime, default=datetime.utcnow)
