# backend/app/api/newsdesk.py
from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.newsdesk import NewsDesk
from app.schemas.newsdesk import NewsDeskResponse, BenchmarkResponse
from app.schemas.common import APIResponse

router = APIRouter()


def newsdesk_to_response(newsdesk: NewsDesk) -> NewsDeskResponse:
    """NewsDesk 모델을 응답 스키마로 변환"""
    return NewsDeskResponse(
        id=newsdesk.id,
        publish_date=newsdesk.publish_date,
        status=newsdesk.status,
        columns=newsdesk.columns,
        news_cards=newsdesk.news_cards,
        keywords=newsdesk.keywords,
        sentiment=newsdesk.sentiment,
        top_stocks=newsdesk.top_stocks,
        raw_news_count=newsdesk.raw_news_count or 0,
        created_at=newsdesk.created_at,
        updated_at=newsdesk.updated_at,
    )


def get_korean_today() -> date:
    """한국시간 기준 오늘 날짜"""
    from zoneinfo import ZoneInfo
    kst = ZoneInfo("Asia/Seoul")
    return datetime.now(kst).date()


@router.get("/today", response_model=APIResponse)
async def get_today_newsdesk(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """오늘의 뉴스데스크 조회

    - 2월 8일 뉴스데스크 = 2월 7일 24시간 + 2월 8일 새벽 뉴스
    - 언제 접속하든 오늘 날짜의 뉴스데스크 표시
    """
    today = get_korean_today()

    newsdesk = db.query(NewsDesk).filter(
        NewsDesk.publish_date == today
    ).first()

    if not newsdesk:
        return APIResponse(
            success=True,
            data=None,
            message=f"{today.strftime('%m월 %d일')} 뉴스데스크가 아직 생성되지 않았습니다"
        )

    return APIResponse(
        success=True,
        data=newsdesk_to_response(newsdesk)
    )


@router.get("/benchmarks", response_model=APIResponse)
async def get_benchmark_data(
    period: str = Query("1M", pattern="^(1W|1M|3M|6M|1Y)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """벤치마크 데이터 조회 (코스피, 나스닥, S&P500, 팀 수익률)"""
    import yfinance as yf

    # 기간 설정
    period_map = {"1W": 7, "1M": 30, "3M": 90, "6M": 180, "1Y": 365}
    days = period_map.get(period, 30)
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)

    benchmarks = {
        "kospi": "^KS11",
        "nasdaq": "^IXIC",
        "sp500": "^GSPC"
    }

    result = {}
    for name, ticker in benchmarks.items():
        try:
            data = yf.download(ticker, start=start_date, end=end_date, progress=False)
            result[name] = [
                {"time": int(idx.timestamp()), "value": float(row["Close"])}
                for idx, row in data.iterrows()
            ]
        except Exception:
            result[name] = []

    # 팀 수익률 (AssetSnapshot 기반)
    from app.models.asset_snapshot import AssetSnapshot

    fund_snapshots = db.query(AssetSnapshot).filter(
        AssetSnapshot.snapshot_date >= start_date.date()
    ).order_by(AssetSnapshot.snapshot_date.asc()).all()

    if fund_snapshots and len(fund_snapshots) > 0:
        result["fund"] = [
            {
                "time": int(datetime.combine(s.snapshot_date, datetime.min.time()).timestamp()),
                "value": float(s.total_krw) if s.total_krw else 0
            }
            for s in fund_snapshots
        ]
    else:
        result["fund"] = []

    return APIResponse(success=True, data=result)


@router.get("/history", response_model=APIResponse)
async def get_newsdesk_history(
    days: int = Query(7, ge=1, le=30, description="조회할 일수 (최대 30일)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """최근 N일간 뉴스데스크 목록 조회"""
    newsdesks = db.query(NewsDesk).filter(
        NewsDesk.status == "ready"
    ).order_by(NewsDesk.publish_date.desc()).limit(days).all()

    return APIResponse(
        success=True,
        data={
            "items": [newsdesk_to_response(nd) for nd in newsdesks],
            "total": len(newsdesks)
        }
    )


@router.get("/{target_date}", response_model=APIResponse)
async def get_newsdesk_by_date(
    target_date: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """특정 날짜의 뉴스데스크 조회 (YYYY-MM-DD 형식)"""
    newsdesk = db.query(NewsDesk).filter(
        NewsDesk.publish_date == target_date
    ).first()

    if not newsdesk:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{target_date.strftime('%Y-%m-%d')} 날짜의 뉴스데스크가 없습니다"
        )

    return APIResponse(
        success=True,
        data=newsdesk_to_response(newsdesk)
    )



# 수동 생성 엔드포인트 제거됨 (2026-02-10)
# 뉴스데스크는 스케줄러(KST 05:30)로만 자동 생성
# 스케줄러: backend/app/services/scheduler.py → generate_newsdesk_job()
