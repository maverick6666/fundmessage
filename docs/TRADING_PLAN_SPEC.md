# 매매계획 (Trading Plan) 시스템 명세

## 1. 데이터 구조

### 1.1 타겟 배열 형식

```javascript
// 매수 계획 (buy_plan)
[
  { price: 50000, quantity: 10, completed: false },
  { price: 49000, quantity: 10, completed: true }   // 체결됨
]

// 익절 타겟 (take_profit_targets)
[
  { price: 55000, quantity: 5, completed: false },
  { price: 57000, quantity: 10, completed: false }
]

// 손절 타겟 (stop_loss_targets)
[
  { price: 45000, quantity: 15, completed: false }
]
```

**필드 설명**:
| 필드 | 타입 | 설명 |
|------|------|------|
| `price` | number | 목표 가격 |
| `quantity` | number | 수량 |
| `completed` | boolean | 체결 완료 여부 |

---

## 2. 핵심 파일 위치

| 구분 | 파일 | 설명 |
|------|------|------|
| **모델** | `backend/app/models/position.py` | buy_plan, take_profit_targets, stop_loss_targets 필드 |
| **모델** | `backend/app/models/trading_plan.py` | 계획 이력/체결 기록 |
| **API** | `backend/app/api/trading_plans.py` | 계획 CRUD, 체결 기록 |
| **서비스** | `backend/app/services/position_service.py` | toggle_plan_item (체결 처리) |
| **프론트 서비스** | `frontend/src/services/tradingPlanService.js` | API 클라이언트 |
| **프로그레스바** | `frontend/src/components/common/ProfitProgressBar.jsx` | 진행도 계산/표시 |
| **UI** | `frontend/src/pages/PositionDetail.jsx` | 매매계획 편집/표시 |

---

## 3. 프로그레스바 동작

### 3.1 표시 조건

```
타겟이 있을 때만 표시:
- take_profit_targets에 유효한 항목(price 있고 completed=false)이 1개 이상
- 또는 stop_loss_targets에 유효한 항목이 1개 이상
```

### 3.2 진행도 계산 (calculateTargetProgress)

**위치**: `ProfitProgressBar.jsx:12-86`

```javascript
// 1. 유효한 타겟만 필터링
validTpTargets = takeProfitTargets.filter(t => t.price && !t.completed)
validSlTargets = stopLossTargets.filter(t => t.price && !t.completed)

// 2. 방향 결정
if (currentPrice > averagePrice) → 익절 방향 (profit)
if (currentPrice < averagePrice) → 손절 방향 (loss)

// 3. 진행도 계산
progressPerTarget = 100 / 타겟개수

각 타겟에 대해:
  - 현재가 >= 타겟가 → 해당 구간 100% 완료
  - 현재가 < 타겟가 → 구간 내 비율 계산
    = (현재가 - 이전가) / (타겟가 - 이전가) × progressPerTarget
```

**예시**:
```
평균매입가: 10,000원
익절1: 11,000원
익절2: 12,000원

현재가 11,500원일 때:
- 1차 구간(10,000→11,000): 100% 완료 = 50%
- 2차 구간(11,000→12,000): 50% 진행 = 25%
- 총 진행도: 75%
```

### 3.3 70% 효과

진행도 70% 이상일 때:
- 그라데이션 색상 적용
- pulse 애니메이션
- ring 효과 (테두리)

---

## 4. 체결 프로세스

### 4.1 체크박스 클릭 시

**위치**: `PositionDetail.jsx` → `position_service.py:toggle_plan_item`

```
[UI] 체크박스 클릭 (completed: false → true)
  ↓
[API] POST /positions/{id}/executions
  ↓
[Backend] 처리:
  1. Position의 해당 항목 completed = true
  2. 수량/금액 업데이트:
     - 매수: total_quantity↑, average_buy_price 재계산
     - 익절/손절: total_quantity↓, realized_profit_loss↑
  3. TradingPlan 레코드 생성 (record_type='execution')
  ↓
[UI] 포지션 새로고침 → 프로그레스바 업데이트
```

### 4.2 매수 체결

```python
# 새 평균매입가 = (기존금액 + 신규금액) / 총수량
new_total_qty = old_qty + buy_qty
new_total_amount = old_amount + (buy_price × buy_qty)
new_avg_price = new_total_amount / new_total_qty

position.total_quantity = new_total_qty
position.total_buy_amount = new_total_amount
position.average_buy_price = new_avg_price
```

### 4.3 익절/손절 체결

```python
# 실현손익 = (체결가 - 평균매입가) × 수량
realized_pnl = (sell_price - avg_buy_price) × sell_qty

position.total_quantity -= sell_qty
position.realized_profit_loss += realized_pnl  # 누적!
```

### 4.4 제약사항

- **체결 취소 불가**: completed=true → false 변경 불가
- **수량 검증**: 판매 수량 ≤ 현재 보유 수량

---

## 5. UI 표시 위치

### 5.1 PositionDetail 페이지

| 위치 | 컴포넌트 | 설명 |
|------|----------|------|
| 상단 정보 | TargetProgressBar | 목표진행 (타겟 있을 때만) |
| 매매계획 섹션 | 체크박스 리스트 | 매수/익절/손절 항목 |
| 이력 보기 | 계획 버전 목록 | 저장/체결 이력 |

### 5.2 Positions 목록

| 위치 | 컴포넌트 | 설명 |
|------|----------|------|
| 카드 우측 | MiniTargetProgressBar | 미니 진행도 바 (타겟 있을 때만) |

### 5.3 Dashboard

| 위치 | 컴포넌트 | 설명 |
|------|----------|------|
| 포지션 요약 | MiniTargetProgressBar | 미니 진행도 바 (타겟 있을 때만) |

---

## 6. 상호작용 시나리오

### 6.1 매매계획 추가

```
1. PositionDetail 진입
2. 매매계획 섹션에서 "+ 추가" 클릭
3. 가격/수량 입력
4. "현재 계획 저장" 클릭
5. TradingPlan 생성 (version 증가)
```

### 6.2 체결 기록

```
1. 계획 항목의 체크박스 클릭
2. 체결 확인 모달 (가격/수량 확인)
3. 확인 → API 호출
4. Position 업데이트
5. 프로그레스바 진행도 변경
```

### 6.3 프로그레스바 변화

| 상황 | 프로그레스바 |
|------|-------------|
| 타겟 없음 | 표시 안 함 |
| 익절 타겟만 있음 + 손실 중 | 표시 안 함 (방향 불일치) |
| 익절 타겟만 있음 + 이익 중 | 익절 진행도 표시 (빨강) |
| 손절 타겟만 있음 + 이익 중 | 표시 안 함 (방향 불일치) |
| 손절 타겟만 있음 + 손실 중 | 손절 진행도 표시 (파랑) |
| 모든 타겟 체결됨 | 표시 안 함 |

---

## 7. 알려진 특이사항

1. **버전 관리**: 계획 저장할 때마다 version 증가
2. **실현손익 누적**: Position.realized_profit_loss에 체결마다 누적
3. **ratio 필드**: legacy, 현재는 quantity 사용
4. **감사 로그**: 모든 변경사항 AuditLog에 기록

---

## 8. 🚨 현재 구현 문제점 (2026-02-09 분석)

### 8.1 핵심 버그: 즉시 저장 문제

**현재 동작 (버그):**
```
사용자가 "추가" 클릭 → 가격/수량 입력 → 체크 클릭
  ↓
handleSavePlanItem() → positionService.updatePlans() → DB에 즉시 저장!
  ↓
새로고침 해도 유지됨 (이미 DB에 저장됐으므로)
```

**기대 동작:**
```
사용자가 "추가" 클릭 → 가격/수량 입력 → 체크 클릭
  ↓
로컬 상태에만 저장 (DB 저장 X)
  ↓
새로고침하면 사라짐 (저장 안 했으므로)
  ↓
"현재계획저장" 클릭 시 비로소 DB에 저장
```

### 8.2 문제점 상세

| # | 현재 동작 | 기대 동작 | 영향도 |
|---|----------|----------|--------|
| 1 | 계획 항목 체크(✓) → 즉시 DB 저장 | 로컬 상태만 변경 | 🔴 Critical |
| 2 | "현재계획저장" → 이력만 생성 | Position + 이력 저장 | 🔴 Critical |
| 3 | X 버튼 → DB에서 삭제 | 저장 전이면 로컬에서만 제거 | 🟠 High |
| 4 | 모든 수정이 기록됨 (오타 포함) | 저장된 계획 → 재저장 시에만 기록 | 🟡 Medium |

### 8.3 원인 코드 분석

**PositionDetail.jsx:596-642 (handleSavePlanItem)**
```javascript
// 문제: 항목 수정 시 즉시 API 호출
const handleSavePlanItem = async () => {
  // ...
  const updatedPosition = await positionService.updatePlans(id, {
    buyPlan: currentPlans.buy_plan,
    // ...
  });
  setPosition(updatedPosition);  // DB에 저장된 후 상태 업데이트
};
```

**PositionDetail.jsx:237-260 (handleSaveTradingPlan)**
```javascript
// "현재계획저장" 클릭 시 - 단순히 이력만 생성
const handleSaveTradingPlan = async () => {
  const planData = {
    buy_plan: position.buy_plan || [],  // 이미 DB에 있는 값을 그대로 사용
    // ...
  };
  await tradingPlanService.createPlan(id, planData);  // TradingPlan 이력만 생성
};
```

---

## 9. 수정 방안

### 9.1 아키텍처 변경 필요

```
[현재]
Position.buy_plan ←──── 즉시 저장 ──── 사용자 입력

[수정 후]
localPlans (React state) ←── 사용자 입력
       ↓
   "현재계획저장" 클릭
       ↓
Position.buy_plan ←── DB 저장
       ↓
TradingPlan 이력 생성
```

### 9.2 수정 필요 함수

| 함수 | 현재 | 수정 후 |
|------|------|---------|
| `handleSavePlanItem` | `positionService.updatePlans` 호출 | 로컬 상태만 업데이트 |
| `handleSaveTradingPlan` | TradingPlan 이력만 생성 | Position + TradingPlan 저장 |
| `handleDeletePlanItem` | API로 DB에서 삭제 | 저장 여부에 따라 분기 |
| `addPendingChange` | 모든 변경 기록 | 저장된 항목 수정 시에만 기록 |
| `fetchPosition` | position 설정 | position + localPlans 분리 |

### 9.3 새로운 상태 구조

```javascript
// 현재 (문제)
const [position, setPosition] = useState(null);
// position.buy_plan이 바로 DB와 동기화됨

// 수정 후
const [position, setPosition] = useState(null);     // DB에서 로드한 원본
const [localPlans, setLocalPlans] = useState({      // 로컬 편집 상태
  buy_plan: [],
  take_profit_targets: [],
  stop_loss_targets: []
});
const [savedVersion, setSavedVersion] = useState(null); // 마지막 저장 버전 (수정 추적용)
```

### 9.4 "저장됨" 표시

저장된 항목과 미저장 항목을 시각적으로 구분:
- 저장됨: 일반 표시
- 미저장: 점선 테두리 또는 "NEW" 배지

### 9.5 수정 기록 로직 변경

```javascript
// 현재: 모든 변경 기록
addPendingChange('modify', planType, newPrice, newQty, oldPrice, oldQty);

// 수정 후: savedVersion과 비교해서 실제 변경된 것만 기록
const getActualChanges = () => {
  const saved = savedVersion || position;
  const changes = [];

  // savedVersion과 localPlans 비교
  localPlans.buy_plan.forEach((item, i) => {
    const savedItem = saved.buy_plan?.[i];
    if (!savedItem) {
      changes.push({ action: 'add', type: 'buy', ...item });
    } else if (savedItem.price !== item.price || savedItem.quantity !== item.quantity) {
      changes.push({ action: 'modify', type: 'buy', ...item, old_price: savedItem.price, old_quantity: savedItem.quantity });
    }
  });

  return changes;
};
```

---

## 10. 수정 완료 (2026-02-09)

### 10.1 변경된 파일
- `frontend/src/pages/PositionDetail.jsx`

### 10.2 새로운 상태 구조
```javascript
// 로컬 계획 상태 (DB 저장 전까지의 편집 상태)
const [localPlans, setLocalPlans] = useState({
  buy_plan: [],
  take_profit_targets: [],
  stop_loss_targets: []
});

// DB에 저장된 원본 계획 (수정 추적용)
const [savedPlans, setSavedPlans] = useState({...});

// pendingChanges는 useMemo로 savedPlans와 localPlans 비교하여 자동 계산
const pendingChanges = useMemo(() => {...}, [savedPlans, localPlans]);
```

### 10.3 변경된 함수들
| 함수 | 변경 내용 |
|------|----------|
| `fetchPosition` | `localPlans`와 `savedPlans` 초기화 추가 |
| `handleAddPlanItem` | `localPlans` 상태만 변경 (API 호출 X) |
| `handleSavePlanItem` | API 호출 제거, `localPlans`만 업데이트 |
| `handleRemovePlanItem` | `localPlans`에서만 제거 (API 호출 X) |
| `handleSaveTradingPlan` | Position DB 저장 + TradingPlan 이력 생성 |
| `pendingChanges` | `savedPlans`와 `localPlans` 비교로 자동 계산 |

### 10.4 테스트 결과
- [x] 계획 추가 후 저장 안하고 새로고침 → 사라짐 ✅
- [x] "현재 계획 저장" 클릭 → DB에 저장됨 ✅
- [x] 저장 후 새로고침 → 데이터 유지됨 ✅
- [x] 변경사항 있으면 (X건) 표시 ✅
- [x] 변경사항 없으면 저장 버튼 비활성화 ✅

### 10.5 추가 개선 가능 사항
- [ ] 새로고침 시 미저장 변경사항 경고 (onbeforeunload)
- [ ] 저장됨/미저장 시각적 구분 UI (점선 테두리 등)

