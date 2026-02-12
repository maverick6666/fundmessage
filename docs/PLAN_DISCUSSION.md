# 작업 항목별 세부 논의 문서

> 생성: 2026-02-12 | 코드 탐색 + 사용자 논의 결과

---

## Phase 0: 빠른 버그 수정 ✅ 논의 완료

### 0-1. 댓글 "수정됨" 표시 버그 — 확정

**원인:** `comment.py`의 `updated_at`에 `default=lambda: datetime.now(KST)` → 생성 시에도 세팅 → `created_at`과 미세초 차이 → "수정됨" 오판정

**확정 수정:**
- `updated_at`의 `default=` 제거, `nullable=True`로 변경
- 생성 시 `updated_at = NULL`, 수정 시에만 값 세팅
- 마이그레이션에서 기존 데이터 중 `created_at`과 1초 이내 차이인 `updated_at`을 NULL로 리셋
- 프론트: 현재 로직 그대로 동작 (`updated_at` falsy면 미표시)

**파일:** `backend/app/models/comment.py`, `backend/app/api/comments.py`, `frontend/src/components/documents/DocumentPanel.jsx`

### 0-2. 문서 하단 여백 부족 — 확정

**확정 수정:** 댓글 섹션 아래에 `pb-16` (64px) 추가. 모바일 키보드 대응은 별도 스코프.

**파일:** `frontend/src/components/documents/DocumentPanel.jsx`

---

## Phase 1: UI 줄바꿈/모바일 수정 ✅ 논의 완료

### 1-1. 텍스트 줄바꿈 방지 (전체) — 확정

**문제 본질:** 모바일만의 문제가 아님. 창 리사이즈/사이드뷰어 열릴 때 뱃지·레이블·헤더 등이 줄바꿈되면서 UX 붕괴.

**확정 수정:**
- 뱃지, 레이블, 상태 텍스트, 헤더 등: `whitespace-nowrap` 일괄 적용
- 문서 본문, 채팅 메시지 등 의미상 줄바꿈이 필요한 곳은 제외
- 의미적으로 판단하여 범위 결정

**대상 파일:** `Header.jsx`, `Positions.jsx`, `Requests.jsx`, `Dashboard.jsx`, `Discussion.jsx`, `Stats.jsx` 등 전체 스캔

### 1-2. 사이드뷰어 모바일 대응 — 확정 (풀스크린)

**확정 방안:** 모바일에서는 풀스크린 오버레이 (노션 참고 — 노션도 모바일에서 사이드뷰어 미제공, 풀페이지 전환)
- 데스크톱: 기존 사이드 패널 유지
- 모바일(`<768px`): `w-full h-full` 풀스크린 오버레이
- `minWidth: 400px` → 모바일에서 제거

**파일:** `frontend/src/components/layout/SidePanel.jsx`

---

## Phase 2: 자산 스냅샷 인프라 (CRITICAL PATH) ✅ 논의 완료

> Phase 2가 해결하는 것들:
> 1. 자산 스냅샷 실제 수집 (시세 API 호출)
> 2. 포지션 상세 저장 (당시 포지션 상태)
> 3. Stats 페이지 자산 그래프 정상화
> 4. **뉴스데스크 자산추이 비교 차트 정상화** (지수 대비 수익률 비교)
> 5. 날짜 클릭 → 당시 포지션 상태 조회

### 2-1. 스냅샷 서비스 수정

**문제:** `create_daily_snapshot()`이 `p.current_value` 사용 → Position 모델에 해당 필드 없음 → 항상 0

**확정 수정:**
- `price_service`로 각 포지션 현재가 조회
- 현재가 × 수량 = 평가금액
- 현금 = 초기자본 - Σ(매입금액)
- 환율: 추후 결정 (일단 하드코딩 유지 가능)

**파일:** `backend/app/services/asset_service.py`, `backend/app/services/price_service.py`

### 2-2. 포지션 상세 저장

**확정 방안:** 추후 결정 (JSON 컬럼 vs 별도 테이블). 구현 시 판단.

### 2-3. 스케줄러 시각 조정

**현재:** 09:00 KST (장 시작). 추후 결정.

### 2-4. 히스토리 시작일

**확정:** `start_date` 파라미터 추가 + 첫 포지션 진입일 자동 감지

**파일:** `backend/app/api/stats.py`

---

## Phase 3: 통계 그래프 확장

### 3-1. 실현/미실현 손익 그래프

- 3탭 뷰: 총 자산 / 실현손익 / 미실현손익
- 스냅샷에 `realized_pnl`, `unrealized_pnl` 필드 추가

**파일:** `frontend/src/pages/Stats.jsx`, `backend/app/models/asset_snapshot.py`

### 3-2. 날짜 클릭 → 스냅샷 상세

- Recharts onClick → 해당 일자 스냅샷의 포지션별 상세 표시
- 표시 방식: 모달 또는 사이드패널

**파일:** `frontend/src/pages/Stats.jsx`, `backend/app/api/stats.py`

---

## Phase 4: 기능 추가

### 4-1. 토론방 사이드뷰어

- `useSidePanelStore.js`에 `openDiscussion()` 추가
- SidePanel에 `panelType === 'discussion'` 분기
- 새 컴포넌트: `DiscussionSideView.jsx`

**파일:** `frontend/src/stores/useSidePanelStore.js`, `frontend/src/components/layout/SidePanel.jsx`

### 4-2. 뉴스데스크 댓글 기능 — 신규 추가

**배경:** 현재 뉴스데스크 페이지에 댓글 기능이 없음. 기존 댓글 시스템(DocumentPanel의 Comment) 활용 가능.

**수정 방안:**
- 기존 Comment 모델의 `entity_type`을 확장하여 뉴스데스크도 지원
- 또는 뉴스데스크 전용 댓글 구현
- 프론트: 뉴스데스크 상세 페이지에 댓글 섹션 추가

**파일:** 추후 탐색 필요

---

## Phase 5: 백엔드 에러 핸들링

12개 취약점 일괄 수정. try-except + 적절한 HTTP 에러 반환.

| # | 파일 | 문제 |
|---|------|------|
| 1 | `services/ai_service.py` | OpenAI response.content None |
| 2 | `services/price_service.py` | yfinance info None |
| 3 | `services/price_service.py` | history 빈 DataFrame |
| 4 | `services/newsdesk_ai.py` | content None |
| 5 | `services/newsdesk_ai.py` | ValueError 미처리 |
| 6 | `api/positions.py` | DB 조회 None |
| 7 | `api/discussions.py` | 토론/메시지 None |
| 8 | `services/stock_search_service.py` | 외부 API 타임아웃 |
| 9 | `api/auth.py` | SMTP 실패 |
| 10 | `api/uploads.py` | 파일 크기/타입 |
| 11 | `services/notification_service.py` | WebSocket 연결 실패 |
| 12 | `api/stats.py` | ZeroDivisionError |

---

## 삭제된 항목

### ~~현재가 차트 실시간 이동~~ — 삭제
- 야후파이낸스 사용 중이라 실시간 주가 차트 불가
- 사용자가 의도한 것은 뉴스데스크 자산추이 차트 → Phase 2 스냅샷 수정으로 해결

### ~~자동로그인~~ — 이미 구현됨
- localStorage + refresh token으로 이미 동작 중
