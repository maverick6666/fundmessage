# NewsDesk & Platform Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

## ⚠️ CRITICAL: UI 작업 규칙

**모든 프론트엔드/UI 작업은 반드시 `frontend-design` 스킬을 사용할 것!**

```
Skill tool → skill: "frontend-design"
```

### UI 작업이 포함된 태스크 목록:
| Task | 내용 | frontend-design 필수 |
|------|------|---------------------|
| 1 | Stats.jsx 수정 | ✅ Step 5 |
| 3 | 키워드 트리맵 | ✅ 전체 |
| 4 | 높이 정렬 | ✅ 전체 |
| 6 | SentimentGauge | ✅ Step 3 |
| 7 | 사이드뷰어 버그 | ✅ 전체 |
| 8 | 뉴스 카드 제목 | ✅ 전체 |
| 9 | 주목 종목 디자인 | ✅ 전체 |
| 11 | 벤치마크 차트 | ✅ 전체 |
| 13 | 삭제 버튼 UI | ✅ Step 3 |
| 14 | 회원가입 UI | ✅ Step 3 |
| 15 | 관리자 토글 이동 | ✅ 전체 |

---

**Goal:** 16개의 플랫폼 개선사항 구현 - 데이터 연동, AI 프롬프트 개선, UI/UX 개선, 권한 시스템 개선

**Architecture:**
- 통계 그래프는 일별 자산 스냅샷 테이블 추가하여 실제 데이터 표시
- 뉴스데스크 사용량 제한은 TeamSettings 모델 확장
- 키워드 클라우드는 트리맵 방식으로 변경
- "일반" 권한 추가로 4단계 권한 체계 구축

**Tech Stack:** FastAPI, SQLAlchemy, PostgreSQL, React, TailwindCSS, Lightweight Charts, OpenAI GPT

---

## Task 1: 통계 전체자산 그래프 - 실제 데이터 연동

**목표:** 더미 데이터 대신 실제 일별 자산 스냅샷을 저장하고 조회

**Files:**
- Create: `backend/app/models/asset_snapshot.py`
- Create: `backend/alembic/versions/xxxx_add_asset_snapshot.py`
- Modify: `backend/app/api/stats.py` - 자산 히스토리 API 추가
- Modify: `frontend/src/pages/Stats.jsx` - 실제 API 호출

### Step 1: AssetSnapshot 모델 생성

```python
# backend/app/models/asset_snapshot.py
from datetime import datetime, date
from sqlalchemy import Column, Integer, Date, Numeric, DateTime
from app.database import Base


class AssetSnapshot(Base):
    """일별 자산 스냅샷"""
    __tablename__ = "asset_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    snapshot_date = Column(Date, unique=True, index=True, nullable=False)

    # KRW 자산
    krw_cash = Column(Numeric(20, 2), default=0)
    krw_evaluation = Column(Numeric(20, 2), default=0)

    # USD 자산
    usd_cash = Column(Numeric(20, 4), default=0)
    usd_evaluation = Column(Numeric(20, 4), default=0)

    # USDT 자산
    usdt_evaluation = Column(Numeric(20, 4), default=0)

    # 합산 (KRW 기준)
    total_krw = Column(Numeric(20, 2), default=0)
    exchange_rate = Column(Numeric(10, 2), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
```

### Step 2: Alembic 마이그레이션 생성

Run: `cd backend && alembic revision --autogenerate -m "add asset_snapshot table"`

### Step 3: 마이그레이션 적용

Run: `alembic upgrade head`

### Step 4: 자산 히스토리 API 추가

```python
# backend/app/api/stats.py에 추가

@router.get("/asset-history", response_model=APIResponse)
async def get_asset_history(
    period: str = Query("1m", regex="^(1w|1m|3m|all)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """기간별 자산 히스토리 조회"""
    from app.models.asset_snapshot import AssetSnapshot
    from datetime import timedelta

    today = datetime.now(KST).date()

    if period == "1w":
        start_date = today - timedelta(days=7)
    elif period == "1m":
        start_date = today - timedelta(days=30)
    elif period == "3m":
        start_date = today - timedelta(days=90)
    else:
        start_date = None

    query = db.query(AssetSnapshot).order_by(AssetSnapshot.snapshot_date.asc())
    if start_date:
        query = query.filter(AssetSnapshot.snapshot_date >= start_date)

    snapshots = query.all()

    return APIResponse(
        success=True,
        data=[{
            "date": s.snapshot_date.strftime("%m/%d"),
            "value": float(s.total_krw),
            "krw_cash": float(s.krw_cash),
            "usd_cash": float(s.usd_cash),
        } for s in snapshots]
    )
```

### Step 5: Frontend Stats.jsx 수정

**⚠️ Use frontend-design skill for this step**

- `chartData` useMemo를 실제 API 호출로 교체
- `statsService.getAssetHistory(period)` 호출
- 더미 데이터 생성 로직 제거

### Step 6: Commit

```bash
git add backend/app/models/asset_snapshot.py backend/app/api/stats.py frontend/src/pages/Stats.jsx
git commit -m "feat: Add real asset history data for stats chart"
```

---

## Task 2: 뉴스데스크 "우리팀" 차트 연동

**목표:** 벤치마크 차트에서 "우리팀" 선택 시 실제 팀 자산 데이터 표시

**Files:**
- Modify: `backend/app/api/newsdesk.py` - benchmarks API에 fund 데이터 추가
- Modify: `frontend/src/pages/NewsDesk.jsx` - fund 데이터 처리

### Step 1: benchmarks API 수정

```python
# backend/app/api/newsdesk.py - get_benchmark_data 함수 수정

# 팀 수익률 (자산 스냅샷 기반)
from app.models.asset_snapshot import AssetSnapshot

fund_snapshots = db.query(AssetSnapshot).filter(
    AssetSnapshot.snapshot_date >= start_date.date()
).order_by(AssetSnapshot.snapshot_date.asc()).all()

if fund_snapshots and len(fund_snapshots) > 0:
    first_value = float(fund_snapshots[0].total_krw)
    result["fund"] = [
        {
            "time": int(datetime.combine(s.snapshot_date, datetime.min.time()).timestamp()),
            "value": float(s.total_krw)
        }
        for s in fund_snapshots
    ]
else:
    result["fund"] = []
```

### Step 2: Commit

```bash
git add backend/app/api/newsdesk.py
git commit -m "feat: Add real fund data to benchmark chart"
```

---

## Task 3: 키워드 클라우드 → 트리맵 디자인 변경

**목표:** 원형 버블 → 사각형 트리맵으로 변경, 크기 차이 명확화

**Files:**
- Modify: `frontend/src/pages/NewsDesk.jsx` - KeywordBubble → KeywordTreemap

**⚠️ Use frontend-design skill for this entire task**

### Step 1: KeywordTreemap 컴포넌트 구현

- 트리맵 레이아웃 알고리즘 (Squarified)
- 크기는 count 기반으로 면적 비례
- 감성에 따른 색상 (탐욕=초록, 공포=빨강)
- 호버 시 상세 정보 표시

### Step 2: Commit

```bash
git add frontend/src/pages/NewsDesk.jsx
git commit -m "feat: Replace keyword bubble with treemap design"
```

---

## Task 4: 키워드 클라우드/AI칼럼 박스 높이 정렬

**목표:** 오른쪽 사이드바(키워드, 감성)와 AI칼럼 시작점 정렬

**Files:**
- Modify: `frontend/src/pages/NewsDesk.jsx` - 그리드 레이아웃 조정

**⚠️ Use frontend-design skill for this task**

### Step 1: 레이아웃 수정

- `lg:grid-cols-5` 그리드에서 양쪽 컨텐츠 시작점 맞춤
- AI칼럼 섹션과 키워드 클라우드가 같은 높이에서 시작하도록

### Step 2: Commit

```bash
git add frontend/src/pages/NewsDesk.jsx
git commit -m "fix: Align keyword cloud and AI column box heights"
```

---

## Task 5: 키워드별 감성 평가 프롬프트 추가

**목표:** AI가 각 키워드에 대해 탐욕/공포 수준 평가

**Files:**
- Modify: `backend/app/services/newsdesk_ai.py` - 프롬프트 수정
- Modify: `backend/app/schemas/newsdesk.py` - KeywordBubble 스키마 수정

### Step 1: 스키마 수정

```python
# backend/app/schemas/newsdesk.py
class KeywordBubble(BaseModel):
    keyword: str
    count: int
    greed_score: float  # 0.0 (극도의 공포) ~ 1.0 (극도의 탐욕)
    category: str  # 금융, 테크, 에너지 등
```

### Step 2: 프롬프트 수정

```python
# newsdesk_ai.py - _build_prompt에 추가

"keywords": [
    {{
      "keyword": "반도체",
      "count": 15,
      "greed_score": 0.75,  // 0.0=극도의 공포 ~ 1.0=극도의 탐욕
      "category": "테크"
    }}
]
```

### Step 3: Commit

```bash
git add backend/app/services/newsdesk_ai.py backend/app/schemas/newsdesk.py
git commit -m "feat: Add greed/fear score to keywords"
```

---

## Task 6: 시장 감성 호재/악재 → 탐욕/공포

**목표:** 중립 제거, 탐욕 지수와 공포 지수로 변경

**Files:**
- Modify: `backend/app/services/newsdesk_ai.py` - 프롬프트 수정
- Modify: `backend/app/schemas/newsdesk.py` - SentimentData 스키마 수정
- Modify: `frontend/src/pages/NewsDesk.jsx` - SentimentGauge UI 수정

### Step 1: 스키마 수정

```python
# backend/app/schemas/newsdesk.py
class SentimentData(BaseModel):
    greed_ratio: float  # 탐욕 비율 (0.0 ~ 1.0)
    fear_ratio: float   # 공포 비율 (0.0 ~ 1.0)
    overall_score: float  # 종합 점수 (0=극도의 공포, 100=극도의 탐욕)
    top_greed: List[str]  # 탐욕 유발 키워드
    top_fear: List[str]   # 공포 유발 키워드
```

### Step 2: 프롬프트 수정

```python
"sentiment": {{
    "greed_ratio": 0.65,
    "fear_ratio": 0.35,
    "overall_score": 65,  // 0=극도의 공포, 50=중립, 100=극도의 탐욕
    "top_greed": ["반도체 호황", "실적 개선"],
    "top_fear": ["금리 인상", "환율 불안"]
}}
```

### Step 3: Frontend SentimentGauge 수정

**⚠️ Use frontend-design skill for this step**

- 호재/중립/악재 → 탐욕/공포 2단계 게이지로 변경
- 전체 점수 시각화 (0-100 스케일)

### Step 4: Commit

```bash
git add backend/app/services/newsdesk_ai.py backend/app/schemas/newsdesk.py frontend/src/pages/NewsDesk.jsx
git commit -m "feat: Change sentiment to greed/fear index"
```

---

## Task 7: 사이드뷰어 내용물 버그 수정

**목표:** 칼럼/기사 클릭 시 사이드패널에 content가 표시되지 않는 버그 수정

**Files:**
- Modify: `frontend/src/pages/NewsDesk.jsx` - NewsDetailPanel 렌더링 수정

**⚠️ Use frontend-design skill for this task**

### Step 1: NewsDetailPanel 디버깅

- `content.content` 필드가 마크다운인데 렌더링 안됨
- `react-markdown` 또는 `dangerouslySetInnerHTML` 사용 검토
- prose 클래스 적용 확인

### Step 2: 마크다운 렌더링 구현

```jsx
import ReactMarkdown from 'react-markdown';

<div className="prose dark:prose-invert max-w-none">
  <ReactMarkdown>{content.content || content.summary}</ReactMarkdown>
</div>
```

### Step 3: Commit

```bash
git add frontend/src/pages/NewsDesk.jsx
git commit -m "fix: Render markdown content in side panel"
```

---

## Task 8: 뉴스 카드 제목 한 줄 + ellipsis

**목표:** 긴 제목이 줄바꿈되지 않고 ... 처리

**Files:**
- Modify: `frontend/src/pages/NewsDesk.jsx` - NewsCard 컴포넌트

**⚠️ Use frontend-design skill for this task**

### Step 1: CSS 수정

```jsx
<h3 className="font-bold text-base leading-tight mb-2 truncate">
  {card.title}
</h3>
```

### Step 2: Commit

```bash
git add frontend/src/pages/NewsDesk.jsx
git commit -m "fix: Truncate long news card titles to single line"
```

---

## Task 9: 주목 종목 디자인 개선

**목표:** 프로그래스바 대신 더 임팩트 있는 디자인

**Files:**
- Modify: `frontend/src/pages/NewsDesk.jsx` - TopStockCard 컴포넌트

**⚠️ Use frontend-design skill for this task**

### Step 1: 디자인 개선안

- 프로그래스바 → 불꽃/화염 아이콘 + 숫자 강조
- 언급 횟수를 크게 표시
- 순위별 색상 차별화 강화
- 호버 시 상세 정보 미리보기

### Step 2: Commit

```bash
git add frontend/src/pages/NewsDesk.jsx
git commit -m "feat: Redesign top stocks with more impactful visuals"
```

---

## Task 10: 뉴스 크롤러 키워드 섹터 균형

**목표:** 금융/부동산/소비재/노동 등 섹터 추가, 테크 편향 해소

**Files:**
- Modify: `backend/app/services/news_crawler.py` - KEYWORDS 딕셔너리 확장

### Step 1: 키워드 확장

```python
KEYWORDS = {
    # === 핵심 (매일 필수) ===
    "core": [
        "증시", "코스피", "코스닥", "나스닥", "다우지수",
        "금리", "환율", "달러", "실적", "어닝",
    ],

    # === 금융 (신규!) ===
    "finance": [
        "시중은행", "KB금융", "신한금융", "하나금융",
        "증권사", "미래에셋", "삼성증권",
        "카드사", "신용카드", "PG 수수료",
        "네이버페이", "카카오페이", "토스",
        "생명보험", "손해보험", "퇴직연금", "ETF",
    ],

    # === 부동산/건설 (신규!) ===
    "realestate": [
        "아파트", "분양", "청약", "전세", "월세",
        "GTX", "재개발", "재건축", "경매",
        "현대건설", "대림", "GS건설", "HDC현대산업개발",
    ],

    # === 소비재/유통 ===
    "consumer": [
        "이마트", "롯데마트", "CU", "GS25",
        "쿠팡", "배달의민족", "마켓컬리",
        "CJ제일제당", "농심", "오뚜기",
        "물가", "소비심리",
    ],

    # === 노동/고용 (신규!) ===
    "labor": [
        "고용", "실업률", "임금", "최저임금",
        "노조", "파업", "퇴직연금", "연금개혁",
    ],

    # === 엔터/게임/미디어 (신규!) ===
    "entertainment": [
        "HYBE", "SM", "JYP", "YG",
        "넥슨", "엔씨소프트", "크래프톤",
        "넷플릭스", "OTT",
    ],

    # === 가상화폐 (신규!) ===
    "crypto": [
        "비트코인", "이더리움", "빗썸", "업비트", "코인베이스",
        "가상화폐", "암호화폐",
    ],

    # ... 기존 ai_semi, ev_mobility, bio_health, energy_infra 유지
}
```

### Step 2: Commit

```bash
git add backend/app/services/news_crawler.py
git commit -m "feat: Expand news keywords to cover finance, real estate, consumer sectors"
```

---

## Task 11: 벤치마크 차트 개선 + TradingView 로고 제거

**목표:** 1주 차트 미감 개선, TradingView 로고 제거

**Files:**
- Modify: `frontend/src/pages/NewsDesk.jsx` - BenchmarkChart 설정 수정

**⚠️ Use frontend-design skill for this task**

### Step 1: TradingView 로고 제거

```javascript
const chart = createChart(chartContainerRef.current, {
    // ...
    attribution: { visible: false },  // 또는 브랜딩 옵션
});
```

### Step 2: 1주 차트 개선

- 축 레이블 간격 조정
- 그리드 라인 스타일 개선
- 데이터 포인트 밀도 조정

### Step 3: Commit

```bash
git add frontend/src/pages/NewsDesk.jsx
git commit -m "feat: Improve benchmark chart and remove TradingView branding"
```

---

## Task 12: 뉴스데스크 사용량 제한 (팀별 1회/일)

**목표:** 팀별로 하루 1회 뉴스데스크 생성 제한 (일반 권한 제외)

**Files:**
- Modify: `backend/app/models/team_settings.py` - newsdesk_usage 필드 추가
- Create: `backend/alembic/versions/xxxx_add_newsdesk_usage.py`
- Modify: `backend/app/api/newsdesk.py` - 사용량 체크 로직 추가

### Step 1: TeamSettings 모델 수정

```python
# 뉴스데스크 사용량
newsdesk_daily_used = Column(Integer, default=0)
newsdesk_daily_limit = Column(Integer, default=1)
newsdesk_last_reset = Column(Date, nullable=True)
```

### Step 2: generate_newsdesk API 수정

```python
# 한국시간 기준 날짜
from zoneinfo import ZoneInfo
kst = ZoneInfo("Asia/Seoul")
today_kst = datetime.now(kst).date()

# 일반 권한은 생성 불가
if current_user.role == "viewer":
    raise HTTPException(status_code=403, detail="일반 권한은 뉴스데스크를 생성할 수 없습니다")

# 사용량 체크 (매일 자동 갱신은 제외)
team_settings = db.query(TeamSettings).first()
if team_settings:
    # 날짜가 바뀌면 리셋
    if team_settings.newsdesk_last_reset != today_kst:
        team_settings.newsdesk_daily_used = 0
        team_settings.newsdesk_last_reset = today_kst

    # 오늘 날짜가 아닌 다른 날짜 생성 요청 시 사용량 체크
    if request.target_date != today_kst:
        if team_settings.newsdesk_daily_used >= team_settings.newsdesk_daily_limit:
            raise HTTPException(status_code=429, detail="오늘의 뉴스데스크 생성 횟수를 초과했습니다")
        team_settings.newsdesk_daily_used += 1
```

### Step 3: Commit

```bash
git add backend/app/models/team_settings.py backend/app/api/newsdesk.py
git commit -m "feat: Add daily limit for newsdesk generation per team"
```

---

## Task 13: 관리자 모드 삭제 기능 일관성

**목표:** 모든 엔티티에 삭제 버튼 추가, 관리자 모드에서만 표시

**Files:**
- Modify: 각 페이지 컴포넌트에 삭제 버튼 추가
- Modify: `backend/app/api/*.py` - DELETE 엔드포인트 확인/추가

**⚠️ Use frontend-design skill for frontend modifications**

### Step 1: 삭제 가능한 엔티티 목록

- Position (포지션)
- Request (요청)
- Discussion (토론)
- Message (메시지)
- DecisionNote (의사결정노트)
- TeamColumn (팀 칼럼)
- Notification (알림)
- NewsDesk (뉴스데스크)

### Step 2: 각 엔티티별 DELETE API 확인

- 없는 경우 추가

### Step 3: Frontend 삭제 버튼 추가

- 관리자 모드일 때만 빨간색 삭제 버튼 표시
- 삭제 확인 모달 사용

### Step 4: Commit

```bash
git commit -m "feat: Add consistent delete functionality across all entities"
```

---

## Task 14: "일반" 권한 추가 (보기 전용)

**목표:** viewer 역할 추가 - 모든 데이터 조회 가능, 수정/생성 불가

**Files:**
- Modify: `backend/app/models/user.py` - UserRole에 VIEWER 추가
- Create: `backend/alembic/versions/xxxx_add_viewer_role.py`
- Modify: `backend/app/api/auth.py` - 회원가입 시 역할 선택
- Modify: `frontend/src/pages/Signup.jsx` - 역할 선택 UI

### Step 1: UserRole 수정

```python
class UserRole(str, enum.Enum):
    MANAGER = "manager"
    ADMIN = "admin"
    MEMBER = "member"
    VIEWER = "viewer"  # 신규: 보기 전용
```

### Step 2: 회원가입 API 수정

```python
# 회원가입 시 역할 선택 가능 (기본값: member)
role: Optional[str] = "member"  # member 또는 viewer만 선택 가능
```

### Step 3: Frontend 회원가입 수정

**⚠️ Use frontend-design skill for this step**

- 역할 선택 라디오 버튼 추가
- "팀원" (기본) / "일반 (보기 전용)" 선택

### Step 4: 권한 체크 로직 업데이트

- `is_manager_or_admin()` 유지
- viewer는 GET 요청만 허용하도록 각 API 검토

### Step 5: Commit

```bash
git add backend/app/models/user.py backend/app/api/auth.py frontend/src/pages/Signup.jsx
git commit -m "feat: Add viewer role for read-only access"
```

---

## Task 15: 관리자 모드 토글 → 설정 페이지로 이동

**목표:** 사이드바의 관리자 모드 토글을 설정 페이지로 이동

**Files:**
- Modify: `frontend/src/components/layout/Sidebar.jsx` - 토글 제거
- Modify: `frontend/src/pages/Settings.jsx` - 토글 추가

**⚠️ Use frontend-design skill for this task**

### Step 1: Sidebar에서 토글 제거

- "관리자 모드" 버튼 제거

### Step 2: Settings 페이지에 추가

- "관리자 모드" 섹션 추가
- 토글 스위치로 on/off

### Step 3: Commit

```bash
git add frontend/src/components/layout/Sidebar.jsx frontend/src/pages/Settings.jsx
git commit -m "feat: Move admin mode toggle to settings page"
```

---

## Additional: MEMORY.md 업데이트

**Files:**
- Modify: `C:\Users\lhhh0\.claude\projects\F--fundmessage\memory\MEMORY.md`

### Step 1: 한국시간 기준 원칙 추가

```markdown
## 행동 원칙
- **⏰ 모든 시간은 한국시간(KST) 기준**: 날짜 계산, 일일 제한, 출석 등 모든 시간 관련 로직은 한국시간 기준으로 개발
```

---

## Execution Order Summary

1. **Task 1-2**: 데이터 연동 (통계 그래프, 벤치마크 "우리팀")
2. **Task 10**: 크롤러 키워드 확장 (AI 품질 향상)
3. **Task 5-6**: AI 프롬프트 개선 (탐욕/공포)
4. **Task 7**: 버그 수정 (사이드뷰어)
5. **Task 3-4, 8-9, 11**: UI 개선 (frontend-design 스킬 사용)
6. **Task 12-15**: 기능 추가 (사용량 제한, 권한, 관리자 모드)

---

## Dependencies

- Task 2 depends on Task 1 (AssetSnapshot 모델 필요)
- Task 6 depends on Task 5 (키워드 감성 스키마 필요)
- Task 14 should be done before Task 12 (viewer 역할이 사용량 제한에 영향)

---

## Testing Checklist

각 태스크 완료 후:
1. Playwright로 해당 기능 테스트
2. 팀장/팀원 계정으로 권한 테스트
3. 스크린샷 촬영하여 변경사항 확인
4. `docs/TEST_SCENARIOS.md`에 시나리오 추가
