# backend/app/api/newsdesk.py
from datetime import date, datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, get_manager_or_admin
from app.models.user import User
from app.models.newsdesk import NewsDesk
from app.schemas.newsdesk import NewsDeskResponse, NewsDeskGenerateRequest, BenchmarkResponse
from app.schemas.common import APIResponse
from app.services.newsdesk_ai import NewsDeskAI
from app.services.news_crawler import NewsCrawler

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


def get_korean_newsdesk_date() -> date:
    """한국시간 기준 뉴스데스크 날짜 계산

    - 06:00 이전: 전날 뉴스데스크 표시 (전날 장 마감 뉴스)
    - 06:00 이후: 오늘 뉴스데스크 표시 (오늘 장 관련 뉴스)
    """
    from zoneinfo import ZoneInfo

    kst = ZoneInfo("Asia/Seoul")
    now_kst = datetime.now(kst)

    # 06:00 이전이면 전날로 취급
    if now_kst.hour < 6:
        return (now_kst - timedelta(days=1)).date()
    return now_kst.date()


@router.get("/today", response_model=APIResponse)
async def get_today_newsdesk(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """오늘의 뉴스데스크 조회 (한국시간 06:00 기준)

    - 06:00 이전: 전날 뉴스데스크 표시
    - 06:00 이후: 오늘 뉴스데스크 표시
    """
    target_date = get_korean_newsdesk_date()

    newsdesk = db.query(NewsDesk).filter(
        NewsDesk.publish_date == target_date
    ).first()

    if not newsdesk:
        return APIResponse(
            success=True,
            data=None,
            message=f"{target_date.strftime('%m월 %d일')} 뉴스데스크가 아직 생성되지 않았습니다"
        )

    return APIResponse(
        success=True,
        data=newsdesk_to_response(newsdesk)
    )


@router.get("/benchmarks", response_model=APIResponse)
async def get_benchmark_data(
    period: str = Query("1M", regex="^(1W|1M|3M|6M|1Y)$"),
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

    # 팀 수익률 (포지션 기반 계산) - 추후 구현
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


@router.post("/generate", response_model=APIResponse)
async def generate_newsdesk(
    request: Optional[NewsDeskGenerateRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_manager_or_admin)
):
    """뉴스데스크 생성 (팀장/관리자만)

    1. 뉴스 크롤링 (네이버, yfinance)
    2. AI로 콘텐츠 생성
    3. DB에 저장
    """
    target_date = request.target_date if request and request.target_date else date.today()

    # 기존 뉴스데스크 확인
    existing = db.query(NewsDesk).filter(
        NewsDesk.publish_date == target_date
    ).first()

    if existing and existing.status == "generating":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="뉴스데스크가 생성 중입니다. 잠시 후 다시 시도해주세요."
        )

    # 상태 업데이트 또는 생성
    if existing:
        existing.status = "generating"
        existing.error_message = None
        db.commit()
        newsdesk = existing
    else:
        newsdesk = NewsDesk(
            publish_date=target_date,
            status="generating",
            raw_news_count=0
        )
        db.add(newsdesk)
        db.commit()
        db.refresh(newsdesk)

    try:
        # 1. 뉴스 크롤링
        crawler = NewsCrawler(db)
        collected_count = crawler.collect_all(target_date)

        # 2. 수집된 뉴스 조회
        raw_news = crawler.get_raw_news(target_date)

        if not raw_news:
            newsdesk.status = "failed"
            newsdesk.error_message = "수집된 뉴스가 없습니다"
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="수집된 뉴스가 없습니다. 나중에 다시 시도해주세요."
            )

        # 3. AI로 콘텐츠 생성
        ai_service = NewsDeskAI(db)
        content = ai_service.generate_newsdesk(target_date, raw_news)

        # 4. DB에 저장
        result = ai_service.save_newsdesk(target_date, content, len(raw_news))

        return APIResponse(
            success=True,
            data=newsdesk_to_response(result),
            message=f"뉴스데스크가 생성되었습니다 (뉴스 {len(raw_news)}건 분석)"
        )

    except HTTPException:
        raise
    except ValueError as e:
        newsdesk.status = "failed"
        newsdesk.error_message = str(e)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        newsdesk.status = "failed"
        newsdesk.error_message = str(e)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"뉴스데스크 생성 중 오류가 발생했습니다: {str(e)}"
        )
