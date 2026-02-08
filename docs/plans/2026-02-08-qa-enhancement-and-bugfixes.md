# QA 테스트 증강 및 버그 수정 종합 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 발견된 UI 버그 수정 + 스크린샷 기반 검증 강화 + 미테스트 기능 테스트 + 새 기능(댓글) 추가

**Architecture:** React 18 + FastAPI + Playwright MCP 스크린샷 검증. 모든 프론트엔드 테스트는 스크린샷으로 실제 렌더링 검증 필수.

**Tech Stack:** React 18, Tailwind CSS, FastAPI, SQLAlchemy, Playwright MCP, TradingView lightweight-charts

---

## 핵심 원칙: 스크린샷 검증 필수

**표면적 테스트의 한계:**
- 예: 사이드뷰어가 "열리는 것 같지만" 스크린샷으로 보니 내용이 비어있음
- 예: 버튼이 "있는 것 같지만" 클릭 불가능한 상태

**따라서:** 모든 기능 테스트 후 Playwright 스크린샷 촬영 → 육안 검증

---

## 발견된 문제 목록

| # | 문제 | 심각도 | 위치 | 출처 |
|---|------|--------|------|------|
| 1 | 뉴스데스크: 뉴스/칼럼 사이드뷰어 내용 미표시 | 🔴 심각 | `NewsDesk.jsx:1076-1087`, `SidePanel.jsx` | 사용자 피드백 |
| 2 | 뉴스데스크: 키워드 히트맵 텍스트 truncation | 🟡 중간 | `NewsDesk.jsx:409` | 사용자 피드백 |
| 3 | 뉴스데스크: 키워드 클릭 시 공포/탐욕 지수 미반응 | 🟡 중간 | `NewsDesk.jsx:1071-1073` | 사용자 피드백 |
| 4 | TradingView 로고 제거 불가 | 🟢 낮음 | 라이선스 제한 | 사용자 피드백 |
| 5 | 자산 히스토리 데이터 자동 생성 없음 | 🟡 중간 | 스케줄러 누락 | 사용자 피드백 |
| 6 | 사이드 뷰어 댓글 기능 없음 | 🟡 신규 기능 | 전체 | 사용자 피드백 |
| 7 | 원화/달러 자본금 테스트 누락 | 🟢 테스트 | - | 사용자 피드백 |
| 8 | 관리자 모드 삭제 정합성 테스트 누락 | 🟢 테스트 | - | 사용자 피드백 |
| 9 | 운용보고서 작성 테스트 누락 | 🟢 테스트 | - | 사용자 피드백 |
| 10 | AI 생성 문서 품질 검수 누락 | 🟢 테스트 | - | 사용자 피드백 |

---

## Phase 1: 버그 수정 (Task 1-4)

### Task 1: 뉴스데스크 사이드뷰어 버그 수정 🔴

**문제:** `type: 'custom'`과 `render()` 함수가 SidePanel에서 지원되지 않음

**Files:**
- Modify: `frontend/src/components/layout/SidePanel.jsx:162-181`
- Modify: `frontend/src/pages/NewsDesk.jsx:1076-1087`

**Step 1: Read SidePanel.jsx**

파일 읽기: `frontend/src/components/layout/SidePanel.jsx`

**Step 2: Add custom panel type support**

SidePanel.jsx에서 panelType === 'custom' 처리 추가 (라인 181 이후):

```jsx
{panelType === 'custom' && panelData?.render && (
  <div className="h-full overflow-y-auto">
    {panelData.render()}
  </div>
)}
```

**Step 3: Playwright 스크린샷 검증**

1. 뉴스데스크 페이지 열기
2. 뉴스 카드 클릭
3. 스크린샷 촬영: `test-screenshots/2026-02-08/P_newsdesk_deep/P1_news_detail.png`
4. **내용이 표시되는지 육안 확인**

**Step 4: Commit**

```bash
git add frontend/src/components/layout/SidePanel.jsx
git commit -m "fix: Add custom panel type support for NewsDesk side viewer"
```

---

### Task 2: 키워드 히트맵 텍스트 truncation 개선

**문제:** `line-clamp-1`으로 "무주택자" → "무주..." 잘림

**Files:**
- Modify: `frontend/src/pages/NewsDesk.jsx:363-428` (KeywordTile 컴포넌트)

**Step 1: Read NewsDesk.jsx KeywordTile**

파일 읽기: `frontend/src/pages/NewsDesk.jsx` 라인 363-428

**Step 2: Modify text display style**

변경 전 (라인 409):
```jsx
<span className="text-sm font-bold text-center leading-tight line-clamp-1">
  {keyword}
</span>
```

변경 후:
```jsx
<span
  className="text-xs font-bold text-center leading-tight break-all"
  style={{ wordBreak: 'break-word', hyphens: 'auto' }}
>
  {keyword}
</span>
```

**Step 3: Increase tile minimum size**

라인 388 스타일 수정:
```jsx
className={`
  relative group cursor-pointer
  min-w-[90px] min-h-[65px]  // 최소 크기 증가
  p-2 rounded-lg border-2
  ...
`}
```

**Step 4: Playwright 스크린샷 검증**

1. 뉴스데스크 페이지 열기
2. 키워드 히트맵 확인
3. 스크린샷 촬영: `test-screenshots/2026-02-08/P_newsdesk_deep/P3_keyword_hitmap.png`
4. **4글자 이상 키워드가 잘리지 않는지 확인**

**Step 5: Commit**

```bash
git add frontend/src/pages/NewsDesk.jsx
git commit -m "fix: Improve keyword hitmap text display to prevent truncation"
```

---

### Task 3: 키워드 클릭 시 공포/탐욕 지수 연동

**문제:** 키워드 선택 시 해당 키워드의 감성 데이터로 게이지가 업데이트되지 않음

**Files:**
- Modify: `frontend/src/pages/NewsDesk.jsx:988, 1071-1073, 1227`
- Modify: `frontend/src/pages/NewsDesk.jsx:432-557` (GreedFearGauge)

**Step 1: Read NewsDesk.jsx keyword handling**

파일 읽기: `frontend/src/pages/NewsDesk.jsx` 라인 980-1100, 1220-1250

**Step 2: Create keywordSentimentMap**

라인 988 근처에 추가:

```jsx
const keywordSentimentMap = useMemo(() => {
  const map = {};
  (newsDesk?.keywords || []).forEach(k => {
    map[k.keyword] = {
      greed_ratio: k.greed_score || 0.5,
      fear_ratio: 1 - (k.greed_score || 0.5),
      overall_score: Math.round((k.greed_score || 0.5) * 100)
    };
  });
  return map;
}, [newsDesk?.keywords]);
```

**Step 3: Update GreedFearGauge props**

라인 1227 수정:
```jsx
const displaySentiment = selectedKeyword && keywordSentimentMap[selectedKeyword]
  ? keywordSentimentMap[selectedKeyword]
  : sentiment;

<GreedFearGauge
  sentiment={displaySentiment}
  selectedKeyword={selectedKeyword}
/>
```

**Step 4: Playwright 스크린샷 검증**

1. 뉴스데스크 페이지 열기
2. 키워드 하나 클릭
3. 스크린샷 촬영: `test-screenshots/2026-02-08/P_newsdesk_deep/P2_keyword_selected.png`
4. 다른 키워드 클릭
5. 스크린샷 촬영: `test-screenshots/2026-02-08/P_newsdesk_deep/P2_keyword_different.png`
6. **게이지 값이 다른지 확인**

**Step 5: Commit**

```bash
git add frontend/src/pages/NewsDesk.jsx
git commit -m "feat: Connect keyword selection to greed/fear gauge update"
```

---

### Task 4: 자산 히스토리 스냅샷 자동 생성

**문제:** AssetSnapshot 테이블은 있지만 자동 생성 스케줄러가 없음

**Files:**
- Create: `backend/app/services/asset_service.py`
- Modify: `backend/app/services/scheduler.py`
- Modify: `backend/app/api/stats.py`

**Step 1: Create asset_service.py**

파일 생성: `backend/app/services/asset_service.py`

```python
from datetime import datetime
from zoneinfo import ZoneInfo
from sqlalchemy.orm import Session
from app.models.asset_snapshot import AssetSnapshot
from app.models.team_settings import TeamSettings
from app.models.position import Position

KST = ZoneInfo("Asia/Seoul")

def create_daily_snapshot(db: Session):
    """일별 자산 스냅샷 생성"""
    today = datetime.now(KST).date()

    existing = db.query(AssetSnapshot).filter(
        AssetSnapshot.snapshot_date == today
    ).first()
    if existing:
        return existing

    settings = db.query(TeamSettings).first()
    krw_cash = float(settings.initial_capital_krw or 0) if settings else 0
    usd_cash = float(settings.initial_capital_usd or 0) if settings else 0

    open_positions = db.query(Position).filter(
        Position.status == 'open'
    ).all()

    krw_eval = sum(
        float(p.current_value or 0)
        for p in open_positions
        if p.market in ['KRX', 'KOSPI', 'KOSDAQ']
    )
    usd_eval = sum(
        float(p.current_value or 0)
        for p in open_positions
        if p.market in ['NASDAQ', 'NYSE', 'CRYPTO']
    )

    exchange_rate = 1350.0

    total_krw = krw_cash + krw_eval + (usd_cash + usd_eval) * exchange_rate

    snapshot = AssetSnapshot(
        snapshot_date=today,
        krw_cash=krw_cash,
        krw_evaluation=krw_eval,
        usd_cash=usd_cash,
        usd_evaluation=usd_eval,
        total_krw=total_krw,
        exchange_rate=exchange_rate
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return snapshot
```

**Step 2: Update scheduler.py**

`backend/app/services/scheduler.py` 수정:

```python
from app.services.asset_service import create_daily_snapshot

def create_asset_snapshot_job():
    db = SessionLocal()
    try:
        snapshot = create_daily_snapshot(db)
        print(f"[Scheduler] Asset snapshot created for {snapshot.snapshot_date}")
    except Exception as e:
        print(f"[Scheduler] Failed to create asset snapshot: {e}")
    finally:
        db.close()

def init_scheduler():
    scheduler = BackgroundScheduler()
    # ... 기존 작업들 ...

    scheduler.add_job(
        create_asset_snapshot_job,
        'cron',
        hour=9,
        minute=0,
        timezone='Asia/Seoul',
        id='daily_asset_snapshot'
    )
    scheduler.start()
```

**Step 3: Add manual snapshot API (optional)**

`backend/app/api/stats.py`에 추가:

```python
@router.post("/asset-snapshot", response_model=APIResponse)
async def create_snapshot_manually(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_manager)
):
    from app.services.asset_service import create_daily_snapshot
    snapshot = create_daily_snapshot(db)
    return APIResponse(success=True, message=f"Snapshot created for {snapshot.snapshot_date}")
```

**Step 4: Test**

Run: `curl -X POST http://localhost:8000/api/v1/stats/asset-snapshot -H "Authorization: Bearer {token}"`
Expected: `{"success": true, "message": "Snapshot created for 2026-02-08"}`

**Step 5: Commit**

```bash
git add backend/app/services/asset_service.py backend/app/services/scheduler.py backend/app/api/stats.py
git commit -m "feat: Add daily asset snapshot scheduler"
```

---

## Phase 2: 신규 기능 추가 (Task 5)

### Task 5: 문서 댓글 기능 추가

**신규 기능:** 사이드 뷰어에서 문서(칼럼, 의사결정서)에 댓글 작성

**Files:**
- Create: `backend/app/models/comment.py`
- Create: `backend/app/api/comments.py`
- Create: `backend/app/schemas/comment.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/app/api/__init__.py`
- Create: `frontend/src/components/comments/CommentSection.jsx`
- Modify: `frontend/src/components/documents/DocumentPanel.jsx`
- Create: `frontend/src/services/commentService.js`

**Step 1: Create backend Comment model**

파일 생성: `backend/app/models/comment.py`

```python
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    entity_type = Column(String(50), nullable=False)  # 'column' or 'decision_note'
    entity_id = Column(Integer, nullable=False)
    author_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    author = relationship("User", foreign_keys=[author_id])
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

**Step 2: Create Comment schema**

파일 생성: `backend/app/schemas/comment.py`

```python
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class CommentCreate(BaseModel):
    content: str
    entity_type: str
    entity_id: int

class CommentResponse(BaseModel):
    id: int
    content: str
    entity_type: str
    entity_id: int
    author_id: int
    author_name: str
    created_at: datetime

    class Config:
        from_attributes = True
```

**Step 3: Create Comments API router**

파일 생성: `backend/app/api/comments.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user
from app.models.comment import Comment
from app.models.user import User
from app.schemas.comment import CommentCreate, CommentResponse
from app.schemas.common import APIResponse

router = APIRouter()

@router.get("/{entity_type}/{entity_id}", response_model=APIResponse)
async def get_comments(
    entity_type: str,
    entity_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    comments = db.query(Comment).filter(
        Comment.entity_type == entity_type,
        Comment.entity_id == entity_id
    ).order_by(Comment.created_at.asc()).all()
    return APIResponse(
        success=True,
        data=[{
            **CommentResponse.model_validate(c).model_dump(),
            "author_name": c.author.full_name
        } for c in comments]
    )

@router.post("", response_model=APIResponse)
async def create_comment(
    comment_data: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    comment = Comment(
        content=comment_data.content,
        entity_type=comment_data.entity_type,
        entity_id=comment_data.entity_id,
        author_id=current_user.id
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return APIResponse(
        success=True,
        data={
            **CommentResponse.model_validate(comment).model_dump(),
            "author_name": current_user.full_name
        }
    )

@router.delete("/{comment_id}", response_model=APIResponse)
async def delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다")
    if comment.author_id != current_user.id and current_user.role not in ['manager', 'admin']:
        raise HTTPException(status_code=403, detail="삭제 권한이 없습니다")
    db.delete(comment)
    db.commit()
    return APIResponse(success=True, message="댓글이 삭제되었습니다")
```

**Step 4: Alembic migration**

```bash
cd backend
alembic revision --autogenerate -m "add_comments_table"
alembic upgrade head
```

**Step 5: Register router in __init__.py**

`backend/app/api/__init__.py`에 추가:
```python
from app.api.comments import router as comments_router
api_router.include_router(comments_router, prefix="/comments", tags=["comments"])
```

**Step 6: Create frontend CommentSection component**

파일 생성: `frontend/src/components/comments/CommentSection.jsx`

(내용은 이전 계획 참조)

**Step 7: Create frontend commentService**

파일 생성: `frontend/src/services/commentService.js`

```javascript
import api from './api';

export const commentService = {
  async getComments(entityType, entityId) {
    const response = await api.get(`/comments/${entityType}/${entityId}`);
    return response.data.data;
  },
  async createComment(data) {
    const response = await api.post('/comments', data);
    return response.data.data;
  },
  async deleteComment(commentId) {
    const response = await api.delete(`/comments/${commentId}`);
    return response.data;
  }
};
```

**Step 8: Update DocumentPanel**

`frontend/src/components/documents/DocumentPanel.jsx` 하단에 추가:

```jsx
import { CommentSection } from '../comments/CommentSection';

// 렌더링 하단에 추가
<CommentSection entityType={type} entityId={doc.id} />
```

**Step 9: Playwright 스크린샷 검증**

1. 문서 탭 → 칼럼 탭
2. 칼럼 클릭 → 사이드 뷰어 열기
3. 스크린샷 촬영: `test-screenshots/2026-02-08/S_comments/S1_comment_section.png`
4. 댓글 작성 및 제출
5. 스크린샷 촬영: `test-screenshots/2026-02-08/S_comments/S1_comment_added.png`

**Step 10: Commit**

```bash
git add backend/app/models/comment.py backend/app/api/comments.py backend/app/schemas/comment.py
git add frontend/src/components/comments/CommentSection.jsx frontend/src/services/commentService.js
git add frontend/src/components/documents/DocumentPanel.jsx
git commit -m "feat: Add comment feature for documents (columns, decision notes)"
```

---

## Phase 3: 미테스트 기능 테스트 (Task 6-9)

### Task 6: 원화/달러 자본금 테스트

**테스트 시나리오 (TEST_SCENARIOS.md B3, B4 기반)**

**Step 1: 팀장 로그인**

Playwright MCP:
1. `http://localhost:3000/login` → 팀장 로그인
2. 대시보드 이동

**Step 2: 원화 자본금 설정 테스트**

1. "팀 설정" 버튼 클릭
2. 원화 자본금 입력: `100000000`
3. 저장 클릭
4. 스크린샷: `test-screenshots/2026-02-08/Q_capital/Q1_krw_settings.png`
5. 대시보드에서 `₩100,000,000` 표시 확인

**Step 3: 달러 자본금 설정 테스트**

1. "팀 설정" 다시 열기
2. 달러 자본금 입력: `10000`
3. 저장 클릭
4. 스크린샷: `test-screenshots/2026-02-08/Q_capital/Q2_usd_settings.png`
5. 대시보드에서 `$10,000` 표시 확인

**Step 4: 환전 기능 테스트**

1. "환전" 버튼 클릭
2. 원화→달러 방향 선택
3. 금액 입력: `1350000` (환율 1350 기준 $1000)
4. 환율 입력: `1350`
5. 환전 실행
6. 스크린샷: `test-screenshots/2026-02-08/Q_capital/Q3_exchange_done.png`
7. 원화 잔액 감소, 달러 잔액 증가 확인
8. 환전 이력 표시 확인

---

### Task 7: 관리자 모드 삭제 정합성 테스트

**테스트 시나리오**

**Step 1: 테스트 데이터 준비**

- 포지션 + 관련 의사결정노트 + 매매계획 존재 확인

**Step 2: 관리자 모드 활성화**

Playwright MCP:
1. 팀장 로그인
2. 사이드바 "관리자 모드" 클릭 → ON
3. 스크린샷: `test-screenshots/2026-02-08/R_admin/R1_admin_mode_on.png`

**Step 3: 포지션 삭제 정합성 테스트**

1. `/positions` 이동
2. 삭제 버튼이 표시되는지 확인
3. 포지션 삭제 클릭
4. 확인 모달에서 확인
5. 스크린샷: `test-screenshots/2026-02-08/R_admin/R1_position_deleted.png`
6. 에러 없이 처리되는지 확인 (콘솔 오류 없음)

**Step 4: 요청 삭제 정합성 테스트**

1. `/requests` 이동
2. 요청 삭제 클릭
3. 확인
4. 스크린샷: `test-screenshots/2026-02-08/R_admin/R2_request_deleted.png`
5. 에러 없이 처리되는지 확인

**Step 5: 관리자 모드 OFF**

1. "관리자 모드" 클릭 → OFF
2. 삭제 버튼 숨김 확인

---

### Task 8: 운용보고서 작성 테스트

**테스트 시나리오 (TEST_SCENARIOS.md K2, N7 기반)**

**Step 1: 진행중 포지션에서 AI 보고서 생성**

Playwright MCP:
1. 팀장 로그인
2. `/positions` → 진행중 포지션 클릭
3. "AI 보고서" 버튼 클릭
4. 생성 모달 확인
5. "생성" 클릭
6. 로딩 대기 (최대 30초)
7. 스크린샷: `test-screenshots/2026-02-08/T_ai/T2_report_generated.png`

**Step 2: 보고서 저장**

1. "저장" 버튼 클릭
2. 의사결정노트 목록에 추가 확인
3. 스크린샷: `test-screenshots/2026-02-08/T_ai/T2_report_saved.png`

**Step 3: 종료된 포지션에서도 테스트**

1. 종료 필터 선택
2. 종료된 포지션 클릭
3. "AI 보고서" 버튼 존재 확인
4. 스크린샷: `test-screenshots/2026-02-08/T_ai/T2_closed_position_report.png`

---

### Task 9: AI 생성 문서 품질 검수

**검증 항목**

**Step 1: AI 의사결정서 품질 확인**

1. 기존 AI 생성 의사결정서 열기
2. 스크린샷 촬영
3. **수동 확인**:
   - [ ] 구조화된 섹션 (배경, 분석, 결론 등)
   - [ ] 적절한 길이 (500자 이상)
   - [ ] 문법 오류 없음
   - [ ] 관련 종목 정보 포함

**Step 2: AI 뉴스 칼럼 품질 확인**

1. 뉴스데스크 → AI 칼럼 클릭
2. 스크린샷 촬영
3. **수동 확인**:
   - [ ] 뉴스 출처 명시
   - [ ] 종목 연관성 분석
   - [ ] 객관적인 톤
   - [ ] 투자 제안의 근거 제시

**Step 3: 결과 기록**

`docs/TEST_RESULTS.md`에 품질 검수 결과 추가

---

## Phase 4: 확장 테스트 시나리오 (Task 10)

### Task 10: TEST_SCENARIOS.md 업데이트

**Files:**
- Modify: `docs/TEST_SCENARIOS.md`

**추가할 시나리오:**

```markdown
### P. 뉴스데스크 심층 테스트 (스크린샷 검증 필수)

#### P1. 뉴스/칼럼 사이드뷰어
**스크린샷 검증:** 내용이 실제로 표시되는지 확인

#### P2. 키워드-게이지 연동
**스크린샷 검증:** 키워드 클릭 시 게이지 값 변화

#### P3. 키워드 텍스트 표시
**스크린샷 검증:** 4글자 이상 키워드 잘림 없음

### Q. 자본금/환전 테스트

#### Q1-Q3. 원화/달러/환전 테스트

### R. 관리자 모드 정합성 테스트

#### R1. 포지션 삭제 정합성
#### R2. 요청 삭제 정합성

### S. 문서 댓글 테스트

#### S1-S3. 댓글 CRUD 테스트

### T. AI 문서 품질 검수

#### T1. AI 의사결정서 품질
#### T2. AI 운용보고서 품질
#### T3. AI 뉴스 칼럼 품질
```

**Commit:**

```bash
git add docs/TEST_SCENARIOS.md
git commit -m "docs: Add extended test scenarios for QA enhancement"
```

---

## 스크린샷 저장 구조

```
test-screenshots/2026-02-08/
├── A_auth/
├── B_dashboard/
├── ... (기존)
├── P_newsdesk_deep/
│   ├── P1_news_detail.png
│   ├── P2_keyword_selected.png
│   ├── P2_keyword_different.png
│   └── P3_keyword_hitmap.png
├── Q_capital/
│   ├── Q1_krw_settings.png
│   ├── Q2_usd_settings.png
│   └── Q3_exchange_done.png
├── R_admin/
│   ├── R1_admin_mode_on.png
│   ├── R1_position_deleted.png
│   └── R2_request_deleted.png
├── S_comments/
│   ├── S1_comment_section.png
│   └── S1_comment_added.png
└── T_ai/
    ├── T1_decision_note.png
    ├── T2_report_generated.png
    └── T2_report_saved.png
```

---

## 실행 순서

1. **Task 1**: 뉴스데스크 사이드뷰어 버그 수정 (🔴 가장 심각)
2. **Task 3**: 키워드-게이지 연동 (사용자 기대 기능)
3. **Task 2**: 키워드 텍스트 표시 개선
4. **Task 4**: 자산 히스토리 스냅샷 (백그라운드)
5. **Task 5**: 댓글 기능 추가 (신규 기능)
6. **Task 6-9**: 미테스트 기능 테스트 + AI 품질 검수
7. **Task 10**: 테스트 시나리오 문서 업데이트

---

## 참고: TradingView 로고

**TradingView lightweight-charts**는 오픈소스이지만 워터마크 제거는 라이선스 위반:
- 무료 버전: 워터마크 필수
- 유료 라이선스 필요

**권장:** 워터마크 유지 (법적 문제 방지)

---

## 완료 조건

- [ ] Task 1-4: 모든 버그 수정 + 스크린샷 검증 완료
- [ ] Task 5: 댓글 기능 작동 + 스크린샷 검증
- [ ] Task 6-9: 모든 미테스트 기능 테스트 완료
- [ ] Task 10: TEST_SCENARIOS.md 업데이트
- [ ] 모든 스크린샷 저장됨
- [ ] git commit 완료
