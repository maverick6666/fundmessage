# 펀드메신저 코드베이스 종합 분석 리포트

> 분석 일시: 2026-02-09
> 분석 범위: frontend/src/ (83파일, 20,054줄) + backend/app/ (51파일, 11,791줄)

---

## 목차

1. [P0: 즉시 수정 (버그/보안)](#p0-즉시-수정-버그보안)
2. [P1: 코드 중복 제거](#p1-코드-중복-제거)
3. [P2: 일관성 개선](#p2-일관성-개선)
4. [P3: 구조 개선](#p3-구조-개선)
5. [P4: 성능 개선](#p4-성능-개선)
6. [참고: 현재 잘 되어있는 부분](#참고-현재-잘-되어있는-부분)

---

## P0: 즉시 수정 (버그/보안) ✅ 모두 완료

### 0-1. 수익률 표시 버그 (formatPercent 오용) ✅ 완료

**심각도**: 🔴 사용자에게 잘못된 숫자가 보임

백엔드에서 `profit_rate = -2.5`는 이미 **-2.5%** 의미인데,
`formatPercent()`가 `value * 100`을 해서 **-250%**로 표시됨.

| 위치 | 코드 | 결과 |
|------|------|------|
| `Stats.jsx:422` | `formatPercent(teamStats.avg_profit_rate)` | 3.2% → **"320.00%"** |
| `Stats.jsx:629` | `formatPercent(ticker.profit_rate)` | -2.5% → **"-250.00%"** |
| `PositionDetail.jsx:1113` | `ProfitProgressBar value={position.profit_rate / 100}` | 혼란 유발 |

```javascript
// utils/formatters.js:82-85 - 문제의 함수
export function formatPercent(value, decimals = 2) {
  return `${(value * 100).toFixed(decimals)}%`;  // ← 이미 %인 값에 100을 곱함
}
```

**수정 방향**:
- 이미 %인 값 전용 함수 `formatProfitRate()` 추가
- 또는 `formatPercent` 호출부에서 `/ 100` 처리
- 전체 코드베이스에서 profit_rate 표시 방식 통일

---

### 0-2. 인증 없는 임시 엔드포인트 잔존 ✅ 완료

**심각도**: 🔴 보안 취약점

```python
# backend/app/api/auth.py
@router.post("/activate-first-user")  # 인증 없음 - 누구든 호출 가능
@router.get("/check-users")           # 인증 없음 - 전체 사용자 정보 노출
```

**수정 방향**: 제거 또는 `get_manager` 의존성 추가

---

### 0-3. Secret Key 기본값 ✅ 완료

**심각도**: 🔴

```python
# backend/app/config.py:10
secret_key: str = "your-super-secret-key-change-this-in-production"
```

환경변수 미설정 시 기본값으로 동작 → JWT 토큰 위조 가능.

**수정 방향**: 기본값 제거, 환경변수 필수화

---

## P1: 코드 중복 제거 ✅ 모두 완료

### 1-1. 프로그레스바 인라인 구현 (3곳) ✅ 완료

`TargetProgressBar` 컴포넌트가 있는데 인라인으로 재구현한 곳이 2곳.

| 위치 | 형태 | 크기 |
|------|------|------|
| `ProfitProgressBar.jsx` | ✅ 컴포넌트 (정의) | sm/md/lg |
| `PositionDetail.jsx:1122` | ✅ 컴포넌트 사용 | md |
| `Positions.jsx:1134-1173` | ❌ 인라인 재구현 | w-20, h-2 |
| `Dashboard.jsx:550-598` | ❌ 인라인 재구현 | w-16, h-1.5 |

인라인 구현에는 70% 근접 시 `animate-pulse` + 그라데이션 효과가 포함되어 있음.

**수정 방향**:
- `TargetProgressBar`에 `xs` 사이즈 옵션 + 70% 근접 효과 내장
- 인라인 코드 제거, 컴포넌트 호출로 대체
- `Positions.jsx`의 미사용 `ProfitProgressBar` import 제거

---

### 1-2. 포맷팅 함수 로컬 중복 정의 ✅ 완료

`utils/formatters.js`에 이미 `formatNumber`, `getCurrencyUnit` 등이 있는데, 여러 파일에서 로컬로 재정의.

| 함수 | 로컬 정의 위치 | 이미 존재하는 곳 |
|------|---------------|----------------|
| `formatNumber` | `StockSearch.jsx`, `Positions.jsx`, `BuyRequestForm.jsx` | `utils/formatters.js` |
| `getCurrencyUnit` | `StockSearch.jsx`, `Positions.jsx`, `BuyRequestForm.jsx` | `utils/formatters.js` |

**수정 방향**: 로컬 정의 삭제, `utils/formatters.js`에서 import

---

### 1-3. 상수 중복 정의 (TIMEFRAMES, MARKETS) ✅ 완료

```javascript
// 동일한 배열이 2곳에 정의됨

// pages/PositionDetail.jsx:36-40
const TIMEFRAMES = [{ value: '1d', label: '일봉' }, ...];

// pages/StockSearch.jsx:19-23
const TIMEFRAMES = [{ value: '1d', label: '일봉' }, ...];  // 복사

// pages/Positions.jsx:27-33
const MARKETS = [{ value: 'KOSPI', label: '코스피' }, ...];

// pages/StockSearch.jsx:11-17
const MARKETS = [{ value: 'KOSPI', label: '코스피' }, ...];  // 복사
```

**수정 방향**: `utils/constants.js`에 통합하고 import

---

### 1-4. 검색 자동완성 로직 중복 ✅ 완료

`StockSearch.jsx:51-88`과 `Positions.jsx:82-115`에서 동일한 패턴:
검색어 입력 → setTimeout 디바운싱(300ms) → API 호출 → 결과 처리

**수정 방향**: `useStockSearch(query, market)` 커스텀 훅 추출

---

### 1-5. 드롭다운 외부 클릭 감지 중복 ✅ 완료

`StockSearch.jsx:91-105`과 `Positions.jsx:118-132`에서 동일한 패턴:

```javascript
// 3곳에서 동일한 패턴 반복
useEffect(() => {
  const handleClickOutside = (e) => {
    if (ref.current && !ref.current.contains(e.target)) setOpen(false);
  };
  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, []);
```

**수정 방향**: `useClickOutside(ref, callback)` 커스텀 훅 추출

---

### 1-6. 캔들 데이터 로드 로직 중복 ✅ 완료

`StockSearch.jsx`과 `ChartModal.jsx`에서 캔들 로드 로직이 동일하게 반복.

**수정 방향**: 캔들 로드 커스텀 훅 추출

---

### 1-8. 백엔드 `_convert_targets()` 중복 ✅ 완료

```python
# 동일 함수가 2곳에 정의
# services/position_service.py:18-32
# services/request_service.py:44-56
def _convert_targets(targets_data):
    ...
```

**수정 방향**: `utils/converters.py`에 통합

---

### 1-9. 백엔드 KST 시간대 정의 반복 (3곳+) ✅ 완료

```python
# api/auth.py
KST = timezone(timedelta(hours=9))

# services/ai_service.py
KST = ZoneInfo("Asia/Seoul")

# api/stats.py
KST = timezone(timedelta(hours=9))
```

**수정 방향**: `utils/timezone.py`에 `KST = ZoneInfo("Asia/Seoul")` 한 번만 정의

---

### 1-10. 백엔드 응답 변환 함수 산재

각 라우터에서 자체 변환 함수를 정의하고 있음:

| 위치 | 함수 |
|------|------|
| `api/positions.py` | `position_to_response()` |
| `api/requests.py` | `request_to_response()` |
| `api/discussions.py` | `discussion_to_response()`, `message_to_response()` |

**수정 방향**: 각 스키마에 `from_orm()` 클래스메서드 추가하거나, `utils/serializers.py`로 통합

---

## P2: 일관성 개선

### 2-1. 에러 처리 방식 불일치

**프론트엔드** (24개 파일에서 3가지 방식 혼용):

| 방식 | 예시 | 문제 |
|------|------|------|
| toast만 | `toast.error('실패')` | ✅ 사용자에게 알림 |
| console.error만 | `console.error('Failed:', error)` | ❌ 사용자 모름 |
| 무시 | `catch(e) { return null }` | ❌ 실패 숨김 |

**백엔드** (서비스 vs 라우터):

| 방식 | 예시 | 문제 |
|------|------|------|
| 서비스에서 HTTPException | `raise HTTPException(409, ...)` | 서비스가 FastAPI에 종속 |
| 라우터에서 HTTPException | `if not x: raise HTTPException(404)` | ✅ 정상 |

**수정 방향**:
- 프론트: 모든 API 에러 → `toast.error()` + `console.error()` 통일
- 백엔드: 서비스는 커스텀 Exception, 라우터에서 HTTPException으로 변환

---

### 2-2. 로딩 상태 네이밍 불일치

```javascript
// 파일마다 다른 네이밍
loading              // 일반 로딩
actionLoading        // 액션 로딩
memberStatsLoading   // 특정 데이터 로딩
searchLoading        // 검색 로딩
```

**수정 방향**: 네이밍 컨벤션 통일 (`isLoading`, `isActionLoading` 등 또는 현재 패턴 중 하나로)

---

### 2-3. 변수 네이밍 불일치

```javascript
stock vs stockInfo          // 같은 개념인데 다른 이름
deleteConfirm              // 객체인데 boolean처럼 보이는 이름
```

**수정 방향**: 의미가 명확한 네이밍으로 통일

---

### 2-5. API 응답 데이터 접근 방식 불일치

프론트엔드 서비스에서 응답 데이터를 꺼내는 방식이 다름:

| 서비스 | 접근 방식 | 비고 |
|--------|----------|------|
| `authService`, `positionService` 등 대부분 | `response.data.data` | ✅ 정상 (APIResponse 래핑) |
| `priceService` | `response.data` | ❌ 불일치 |
| `aiService` | `response.data` | ❌ 불일치 |
| `columnService` | `response.data` | ❌ 불일치 |

**수정 방향**: 모든 서비스에서 `response.data.data` 통일 (백엔드 APIResponse 구조 맞춤)

---

### 2-6. 백엔드 상태값 비교 방식 불일치

```python
# 방식 A: Enum 사용
if request.status != RequestStatus.PENDING.value

# 방식 B: 문자열 직접 비교
if request.status != 'pending'

# 방식 C: 혼용
if position.status == 'closed'
```

**수정 방향**: 모든 상태 비교를 Enum 사용으로 통일

---

### 2-7. 백엔드 시간 처리 방식 불일치

```python
# 방식 A: timedelta (비권장)
KST = timezone(timedelta(hours=9))

# 방식 B: ZoneInfo (권장)
KST = ZoneInfo("Asia/Seoul")

# 방식 C: UTC 그대로 (KST 규칙 위반)
opened_at = datetime.utcnow()
```

**수정 방향**: 모두 `ZoneInfo("Asia/Seoul")` 통일 (MEMORY.md 규칙)

---

### 2-8. 백엔드 응답 형식 불일치

```python
# 방식 A: Pydantic Schema (권장)
return APIResponse(success=True, data=PositionListResponse(...))

# 방식 B: 수동 dict
return APIResponse(success=True, data={"discussions": result, "total": total})

# 방식 C: 원시 데이터
return APIResponse(success=True, data=stats)
```

**수정 방향**: 모든 응답에 Pydantic 스키마 사용

---

### 2-9. URL 파라미터 처리 방식 불일치 (프론트엔드)

```javascript
// 방식 A: URLSearchParams + 문자열 조합
const params = new URLSearchParams();
params.append('status', status);
const response = await api.get(`/requests?${params}`);

// 방식 B: axios params 옵션 (더 깔끔)
const response = await api.get('/prices/search', { params: { query, market } });
```

**수정 방향**: axios `params` 옵션으로 통일

---

## P3: 구조 개선

### 3-1. 거대 프론트엔드 컴포넌트

| 파일 | 줄 수 | useState 개수 | 핵심 문제 |
|------|-------|--------------|----------|
| `PositionDetail.jsx` | **2,215** | - | 차트, 매매계획, 노트 전부 한 파일 |
| `NewsDesk.jsx` | **1,363** | - | - |
| `Positions.jsx` | **~1,296** | - | 목록, 검색, 인라인 차트 혼재 |
| `Dashboard.jsx` | **1,182** | **27개** | 모달, 탭, API 전부 한 파일 |
| `StockSearch.jsx` | - | - | `BuyRequestFormWithPreset` 컴포넌트가 파일 내부에 정의됨 |

**분리 후보**:
- `PositionDetail.jsx` → PositionHeader, TradingPlanSection, DecisionNoteSection, ChartSection
- `Dashboard.jsx` → OpenPositions, TeamInfo, NoticeSection
- `Positions.jsx` → PositionCard, PositionFilters, PositionList
- `StockSearch.jsx` → `BuyRequestFormWithPreset`를 별도 파일로 추출

---

### 3-2. 거대 백엔드 파일

| 파일 | 줄 수 | 분리 후보 |
|------|-------|----------|
| `services/position_service.py` | **621** | position_crud, position_calc |
| `api/positions.py` | **592** | positions(CRUD), team_settings, position_requests |
| `services/ai_service.py` | **590** | decision_note_ai, report_ai |
| `services/price_service.py` | **509** | kis_price, yahoo_price, binance_price |
| `api/requests.py` | **404** | requests, abandon_requests |

특히 `api/positions.py`에 팀 설정 CRUD(121-170줄)와 환전 처리(173-244줄)가 섞여 있음.

---

### 3-3. 프론트엔드 중복 서비스 함수

```javascript
// 같은 엔드포인트를 호출하는 함수가 2곳에 존재
positionService.getNotes(positionId)      // 여기도 있고
decisionNoteService.getNotes(positionId)  // 여기도 있음

requestService.startDiscussion()    // 네이밍도
requestService.requestDiscussion()  // 혼란스러움
positionService.requestDiscussion() // 3곳?
```

**수정 방향**: 한 곳으로 통합, 나머지 제거

---

### 3-4. Context vs Zustand 경계 불명확

| 저장소 | 종류 | 용도 |
|--------|------|------|
| AuthContext | Context | 인증/권한 |
| ThemeContext | Context | 테마 |
| ToastContext | Context | 알림 UI |
| WebSocketContext | Context | 실시간 통신 + Discussion 메서드 + Price 구독 |
| useLayoutStore | Zustand | 레이아웃 상태 |
| useSidePanelStore | Zustand | 사이드패널 상태 |

WebSocketContext가 너무 많은 역할을 담당 (단일 책임 원칙 위반).

**수정 방향**: 급하지 않음. WebSocket 이벤트 구독 분리는 선택사항.

---

### 3-5. 사용되지 않는 코드 잔존

**프론트엔드**:
- `Positions.jsx`: `ProfitProgressBar` import (미사용)
- `tradingPlanService.createExecution()` - 호출 여부 불명확
- `discussionService.exportDiscussion()` / `exportTxt()` - 사용 여부 불명확

**백엔드**:
- `request_service.py:69`: `buy_orders=None` (Legacy field)
- `auth.py`: `/activate-first-user`, `/check-users` (임시 디버그 엔드포인트)

---

## P4: 성능 개선

### 4-1. N+1 쿼리 (백엔드)

```python
# api/discussions.py:66-67
for d in discussions:                          # N개
    message_count = get_message_count(d.id)    # +N 쿼리
    last_message = get_last_message(d.id)      # +N 쿼리
# 총 2N+1 쿼리 → JOIN으로 1개 쿼리로 감소 가능
```

---

### 4-2. joinedload 미사용

```python
# 현재: Lazy loading (비효율)
request = get_request_by_id(id)  # 1쿼리
request.requester                # +1쿼리
request.approver                 # +1쿼리
request.position                 # +1쿼리
# 총 4쿼리

# 개선: joinedload
request = db.query(Request).options(
    joinedload(Request.requester),
    joinedload(Request.position)
).get(id)
# 총 1쿼리
```

---

### 4-3. 하드코딩된 매직 넘버

**프론트엔드**:
```javascript
MAX_PRICE = 1000000000000    // 여러 파일에 흩어짐
MAX_QUANTITY = 1000000000    // 여러 파일에 흩어짐
최대 매수/익절/손절 항목 = 4  // 여러 파일에 흩어짐
debounce = 300               // ms, 여러 파일에 흩어짐
```

**백엔드**:
```python
content[:50] + "..."    # api/discussions.py:99 - 왜 50?
content[:100]           # api/discussions.py:147 - 왜 100?
timedelta(days=7)       # api/stats.py:106 - 왜 7일?
timedelta(days=30)      # api/stats.py:113 - 왜 30일?
ai_daily_limit=3        # 왜 3회?
query_limit=20          # 어떤 곳은 20
query_limit=50          # 어떤 곳은 50
```

**수정 방향**: `utils/constants.js` / `utils/constants.py`에 상수로 추출

---

### 4-4. useCallback 미사용으로 불필요한 re-render

여러 컴포넌트에서 이벤트 핸들러를 `useCallback`으로 감싸지 않아 자식 컴포넌트에 전달 시 매번 재생성됨.

**수정 방향**: 자식 컴포넌트에 콜백을 전달하는 핸들러에 `useCallback` 적용

---

### 4-5. API 응답 검증 부족

서비스 레이어에서 API 응답 구조 검증 없이 바로 사용하여, 백엔드 응답이 바뀌면 런타임 에러 발생.

---

### 4-6. useEffect 의존성 배열 누락

`ChartModal.jsx` 등에서 의존성 배열이 불완전하여 예상치 못한 동작 가능.

---

## 참고: 현재 잘 되어있는 부분

잘 되어있어서 건드릴 필요 없는 것들:

| 항목 | 상태 | 설명 |
|------|------|------|
| SQL 인젝션 방지 | ✅ | SQLAlchemy ORM 일관 사용 |
| 비밀번호 암호화 | ✅ | bcrypt 적용 |
| JWT 인증 | ✅ | Access/Refresh 토큰 구조 |
| 역할 기반 접근 제어 | ✅ | `get_manager()`, `get_writer_user()` 의존성 |
| Axios 인터셉터 | ✅ | 토큰 자동 추가, 401 갱신 처리 |
| 실시간 계산 아키텍처 | ✅ | 현재가 기반 수익률은 프론트 계산 (올바름) |
| 테마 시스템 | ✅ | 13종류 테마 Context로 관리 |
| Toast 알림 | ✅ | ToastContext 통일 |

---

## 작업 순서 및 진행 현황

| 우선순위 | 항목 | 난이도 | 효과 | 상태 |
|---------|------|-------|------|------|
| **P0** | 수익률 표시 버그 수정 | 쉬움 | 🔴 필수 | ✅ 완료 |
| **P0** | 임시 엔드포인트 보호 | 쉬움 | 🔴 필수 | ✅ 완료 |
| **P0** | Secret Key 환경변수 필수화 | 쉬움 | 🔴 필수 | ✅ 완료 |
| **P1** | 포맷팅 함수 중복 제거 | 쉬움 | 중간 | ✅ 완료 |
| **P1** | MARKETS/TIMEFRAMES 상수 통합 | 쉬움 | 중간 | ✅ 완료 |
| **P1** | 프로그레스바 컴포넌트 통일 | 중간 | 높음 | ✅ 완료 |
| **P1** | 하드코딩 매직넘버 상수화 | 쉬움 | 중간 | ✅ 완료 |
| **P1** | 검색 자동완성 훅 추출 | 중간 | 높음 | ✅ 완료 |
| **P1** | 드롭다운/캔들 로드 훅 추출 | 중간 | 중간 | ✅ 완료 |
| **P1** | KST 시간대 통합 | 쉬움 | 중간 | ✅ 완료 |
| **P1** | 백엔드 _convert_targets 통합 | 쉬움 | 중간 | ✅ 완료 |
| **P2** | 에러 처리 표준화 | 중간 | 중간 | 미착수 |
| **P2** | 백엔드 응답 변환 함수 통합 | 중간 | 중간 | 미착수 |
| **P3** | Dashboard.jsx 분리 | 어려움 | 높음 | 미착수 |
| **P3** | StockSearch.jsx 분리 | 중간 | 중간 | 미착수 |
| **P3** | PositionDetail.jsx 분리 | 어려움 | 높음 | 미착수 |
| **P4** | N+1 쿼리 최적화 | 중간 | 높음 | 미착수 |
| **P4** | useCallback 적용 | 쉬움 | 낮음 | 미착수 |
| **P4** | 의존성 배열 수정 | 쉬움 | 낮음 | 미착수 |

### 완료 기록 (2026-02-09)

**Phase 0 + Phase 1: 모두 완료**

변경 파일 22개, -397줄 / +259줄 (순 138줄 감소)

주요 변경:
- `formatProfitRate()` 신규 추가, 이미 %인 값에 `formatPercent` 오용 전부 교체
- `auth.py` 임시 엔드포인트에 `get_manager_or_admin` 인증 추가
- `config.py` secret_key 기본값 제거
- `frontend/src/utils/constants.js` 생성 (MARKETS, TIMEFRAMES, 매직넘버)
- `frontend/src/hooks/useClickOutside.js`, `useStockSearch.js` 커스텀 훅 생성
- `ProfitProgressBar.jsx`에 `MiniTargetProgressBar` 추가, 인라인 구현 교체
- `backend/app/utils/constants.py` 생성 (KST, _convert_targets)
- 로컬 `formatNumber`/`getCurrencyUnit` 중복 제거

**남은 작업: P2~P4 (선택)**

---

## 수정 시 체크리스트

```
[ ] 한 번에 1개 이슈만 해결
[ ] 수정 전 현재 동작 확인
[ ] 기존 기능 동일하게 작동하는지 검증
[ ] 사용 안 하는 import 제거
[ ] 관련 없는 파일 건드리지 않음
[ ] API 인터페이스 변경 없음
[ ] 커밋 메시지에 변경 내용 명시
```
