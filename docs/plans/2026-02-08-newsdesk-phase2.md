# NewsDesk Phase 2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> **UI 작업 필수**: 모든 프론트엔드 UI 작업은 반드시 `frontend-design` 플러그인을 사용해야 합니다.

**Goal:** 뉴스데스크에 벤치마크 차트, 스케줄러, 폴백 UI, 날짜 선택기를 추가하여 완전한 기능 구현

**Architecture:**
- 벤치마크 차트는 lightweight-charts를 사용하여 라인 차트로 구현 (여러 지수 비교 가능)
- 스케줄러는 APScheduler를 사용하여 하루 2회 (05:30, 17:30) 자동 실행
- 폴백 UI는 크롤링/AI 실패 시 이전 데이터 표시 또는 안내 메시지
- 날짜 선택기로 과거 뉴스데스크 조회 가능

**Tech Stack:**
- Backend: FastAPI, APScheduler, yfinance
- Frontend: React, lightweight-charts, Tailwind CSS

---

## Task 1: 벤치마크 데이터 API 엔드포인트

**Files:**
- Modify: `backend/app/api/newsdesk.py`
- Modify: `backend/app/schemas/newsdesk.py`

**목표:** 코스피, 나스닥, S&P500, 팀 수익률 데이터를 제공하는 API 추가

**Step 1: 스키마 추가**

`backend/app/schemas/newsdesk.py`에 추가:

```python
class BenchmarkDataPoint(BaseModel):
    time: int  # Unix timestamp
    value: float

class BenchmarkResponse(BaseModel):
    kospi: List[BenchmarkDataPoint]
    nasdaq: List[BenchmarkDataPoint]
    sp500: List[BenchmarkDataPoint]
    fund: Optional[List[BenchmarkDataPoint]] = None  # 팀 수익률
```

**Step 2: API 엔드포인트 추가**

`backend/app/api/newsdesk.py`에 추가:

```python
@router.get("/benchmarks", response_model=APIResponse)
async def get_benchmark_data(
    period: str = Query("1M", regex="^(1W|1M|3M|6M|1Y)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """벤치마크 데이터 조회 (코스피, 나스닥, S&P500, 팀 수익률)"""
    import yfinance as yf
    from datetime import datetime, timedelta

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
                {"time": int(idx.timestamp()), "value": row["Close"]}
                for idx, row in data.iterrows()
            ]
        except:
            result[name] = []

    # 팀 수익률 (포지션 기반 계산) - 추후 구현
    result["fund"] = []

    return APIResponse(success=True, data=result)
```

**Step 3: 커밋**

```bash
git add backend/app/api/newsdesk.py backend/app/schemas/newsdesk.py
git commit -m "feat(newsdesk): add benchmark data API endpoint"
```

---

## Task 2: APScheduler 스케줄러 설정

**Files:**
- Create: `backend/app/services/scheduler.py`
- Modify: `backend/app/main.py`

**목표:** 매일 05:30, 17:30에 뉴스데스크 자동 생성

**Step 1: 스케줄러 서비스 생성**

`backend/app/services/scheduler.py`:

```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import date
import logging

from app.database import SessionLocal
from app.services.news_crawler import NewsCrawler
from app.services.newsdesk_ai import NewsDeskAI
from app.models.newsdesk import NewsDesk

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def generate_newsdesk_job():
    """뉴스데스크 자동 생성 작업"""
    logger.info("Starting scheduled newsdesk generation...")

    db = SessionLocal()
    try:
        target_date = date.today()

        # 이미 생성된 경우 스킵
        existing = db.query(NewsDesk).filter(
            NewsDesk.publish_date == target_date,
            NewsDesk.status == "ready"
        ).first()

        if existing:
            logger.info(f"NewsDesk for {target_date} already exists, skipping")
            return

        # 상태 업데이트
        newsdesk = db.query(NewsDesk).filter(
            NewsDesk.publish_date == target_date
        ).first()

        if not newsdesk:
            newsdesk = NewsDesk(
                publish_date=target_date,
                status="generating"
            )
            db.add(newsdesk)
            db.commit()
            db.refresh(newsdesk)
        else:
            newsdesk.status = "generating"
            db.commit()

        # 1. 뉴스 크롤링
        crawler = NewsCrawler(db)
        collected = crawler.collect_all(target_date)
        logger.info(f"Collected {collected} news articles")

        # 2. AI 분석
        raw_news = crawler.get_raw_news(target_date)
        if raw_news:
            ai_service = NewsDeskAI(db)
            content = ai_service.generate_newsdesk(target_date, raw_news)
            ai_service.save_newsdesk(target_date, content, len(raw_news))
            logger.info(f"NewsDesk generated successfully for {target_date}")
        else:
            newsdesk.status = "failed"
            newsdesk.error_message = "No news collected"
            db.commit()
            logger.warning("No news collected for newsdesk")

    except Exception as e:
        logger.error(f"Scheduled newsdesk generation failed: {e}")
        if newsdesk:
            newsdesk.status = "failed"
            newsdesk.error_message = str(e)
            db.commit()
    finally:
        db.close()


def init_scheduler():
    """스케줄러 초기화"""
    # 오전 5시 30분
    scheduler.add_job(
        generate_newsdesk_job,
        CronTrigger(hour=5, minute=30),
        id="newsdesk_morning",
        replace_existing=True
    )

    # 오후 5시 30분
    scheduler.add_job(
        generate_newsdesk_job,
        CronTrigger(hour=17, minute=30),
        id="newsdesk_afternoon",
        replace_existing=True
    )

    scheduler.start()
    logger.info("NewsDesk scheduler initialized (05:30, 17:30)")


def shutdown_scheduler():
    """스케줄러 종료"""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("NewsDesk scheduler shutdown")
```

**Step 2: main.py에 스케줄러 등록**

`backend/app/main.py`에 추가:

```python
from app.services.scheduler import init_scheduler, shutdown_scheduler

@app.on_event("startup")
async def startup_event():
    # 기존 코드...
    init_scheduler()

@app.on_event("shutdown")
async def shutdown_event():
    shutdown_scheduler()
```

**Step 3: requirements.txt에 APScheduler 추가**

```bash
echo "apscheduler>=3.10.0" >> backend/requirements.txt
```

**Step 4: 커밋**

```bash
git add backend/app/services/scheduler.py backend/app/main.py backend/requirements.txt
git commit -m "feat(newsdesk): add APScheduler for automatic generation (05:30, 17:30)"
```

---

## Task 3: 프론트엔드 날짜 선택기 추가

**Files:**
- Modify: `frontend/src/pages/NewsDesk.jsx`

**목표:** 날짜 선택기로 과거 뉴스데스크 조회 가능

> **⚠️ 이 Task는 반드시 `frontend-design` 플러그인을 사용해야 합니다.**

**요구사항:**
1. 헤더 영역에 날짜 선택기 (달력 아이콘 + 날짜 표시)
2. 이전/다음 날짜 네비게이션 버튼
3. 날짜 변경 시 해당 날짜의 뉴스데스크 로드
4. 해당 날짜에 데이터가 없으면 "데이터 없음" 상태 표시
5. 과거 날짜 목록 드롭다운 (최근 7일)

**디자인 참조:**
- 브루탈리스트 스타일 (border-2 border-black)
- 현재 날짜 강조 표시
- 다크모드 지원

---

## Task 4: 벤치마크 차트 컴포넌트

**Files:**
- Create: `frontend/src/components/charts/BenchmarkChart.jsx`
- Modify: `frontend/src/pages/NewsDesk.jsx`
- Modify: `frontend/src/services/newsdeskService.js`

**목표:** 코스피, 나스닥, S&P500, 팀 수익률을 비교하는 라인 차트

> **⚠️ 이 Task는 반드시 `frontend-design` 플러그인을 사용해야 합니다.**

**Step 1: API 서비스 함수 추가**

`frontend/src/services/newsdeskService.js`에 추가:

```javascript
/**
 * 벤치마크 데이터 조회
 * @param {string} period - 기간 (1W, 1M, 3M, 6M, 1Y)
 */
async getBenchmarkData(period = '1M') {
  const response = await api.get('/newsdesk/benchmarks', {
    params: { period }
  });
  return response.data.data;
}
```

**Step 2: BenchmarkChart 컴포넌트 생성**

`frontend/src/components/charts/BenchmarkChart.jsx`:

**요구사항:**
1. lightweight-charts 라인 시리즈 사용
2. 여러 지수를 겹쳐서 표시 (수익률 스케일)
3. 토글 버튼으로 각 지수 표시/숨김
4. 1개만 선택 시 가격 표시, 2개 이상 시 수익률 비교
5. 기간 선택 (1주, 1개월, 3개월, 6개월, 1년)
6. 다크모드 지원
7. 툴팁에 날짜, 가격/수익률 표시

**디자인:**
- 차트 높이: 200px
- 색상: 코스피(빨강), 나스닥(파랑), S&P500(초록), 팀(보라)
- 브루탈리스트 컨테이너 (border-2 border-black)

---

## Task 5: 폴백 UI 구현

**Files:**
- Modify: `frontend/src/pages/NewsDesk.jsx`

**목표:** 크롤링/AI 실패 시 적절한 안내 메시지 및 이전 데이터 표시

> **⚠️ 이 Task는 반드시 `frontend-design` 플러그인을 사용해야 합니다.**

**요구사항:**

1. **상태별 UI:**
   - `pending`: "뉴스데스크 준비 중..." + 로딩 스피너
   - `generating`: "AI가 뉴스를 분석하고 있습니다..." + 진행률 표시
   - `failed`: 에러 메시지 + 재시도 버튼 + 이전 뉴스데스크 링크
   - `ready`: 정상 콘텐츠

2. **이전 데이터 폴백:**
   - 오늘 데이터가 없거나 실패 시 "가장 최근 뉴스데스크 보기" 버튼
   - history API로 가장 최근 데이터 조회

3. **에러 상태 UI:**
   - 빨간색 경고 배너
   - 에러 메시지 표시
   - "다시 시도" 버튼 (팀장/관리자만)
   - "이전 뉴스데스크 보기" 링크

---

## Task 6: NewsDesk 페이지 통합

**Files:**
- Modify: `frontend/src/pages/NewsDesk.jsx`

**목표:** 모든 컴포넌트 통합 및 최종 레이아웃 완성

> **⚠️ 이 Task는 반드시 `frontend-design` 플러그인을 사용해야 합니다.**

**최종 레이아웃:**

```
┌─────────────────────────────────────────────────────────┐
│  뉴스데스크 제목  │  < 2026.02.07 >  │  [새로고침]     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│              📊 벤치마크 차트 (고정)                      │
│  [코스피] [나스닥] [S&P500] [우리팀] │ [1W][1M][3M]    │
│  ─────────────────────────────────────────────────────  │
│  (lightweight-charts 라인 차트)                          │
└─────────────────────────────────────────────────────────┘

┌──────────────────────────┬──────────────────────────────┐
│    📰 카드 뉴스 (3-6개)   │     📈 시각화 영역           │
│  ┌────────────────────┐  │  ┌────────────────────────┐  │
│  │ [AI 칼럼]          │  │  │ 🔵 키워드 버블          │  │
│  └────────────────────┘  │  └────────────────────────┘  │
│  ┌────────────────────┐  │  ┌────────────────────────┐  │
│  │ [뉴스 카드들]      │  │  │ 🌡️ 호재/악재 게이지     │  │
│  └────────────────────┘  │  └────────────────────────┘  │
└──────────────────────────┴──────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                 🔥 오늘의 주목 종목 TOP 3                 │
└─────────────────────────────────────────────────────────┘
```

---

## Task 7: 테스트 및 문서화

**Files:**
- Modify: `docs/TEST_SCENARIOS.md`

**테스트 시나리오:**

1. **날짜 선택 테스트**
   - 과거 날짜 선택 시 해당 데이터 로드
   - 데이터 없는 날짜 선택 시 폴백 UI 표시

2. **벤치마크 차트 테스트**
   - 토글 클릭 시 라인 표시/숨김
   - 기간 변경 시 데이터 리로드
   - 1개 선택 시 가격, 2개+ 선택 시 수익률

3. **폴백 테스트**
   - 네트워크 오류 시 에러 UI 표시
   - 이전 데이터 보기 클릭 시 최근 데이터 로드

4. **스케줄러 테스트 (백엔드)**
   - 05:30, 17:30 작업 실행 확인 (로그)

---

## 실행 순서

1. Task 1: 벤치마크 API (백엔드)
2. Task 2: 스케줄러 (백엔드)
3. Task 3: 날짜 선택기 (프론트엔드, frontend-design 필수)
4. Task 4: 벤치마크 차트 (프론트엔드, frontend-design 필수)
5. Task 5: 폴백 UI (프론트엔드, frontend-design 필수)
6. Task 6: 최종 통합 (프론트엔드, frontend-design 필수)
7. Task 7: 테스트 시나리오 추가

---

## 배포 체크리스트

- [ ] CloudType 백엔드 재배포
- [ ] `pip install apscheduler` (또는 requirements.txt 반영)
- [ ] `alembic upgrade head` (필요한 경우)
- [ ] 환경변수 확인: `OPENAI_API_KEY`, `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`
- [ ] Vercel 프론트엔드 자동 배포 확인
