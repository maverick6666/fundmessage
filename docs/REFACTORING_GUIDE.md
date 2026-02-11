# 펀드메신저 리팩토링 가이드

## 프로젝트 개요

**펀드팀 메신저** - 펀드팀의 매매 의사결정 관리 웹 애플리케이션
- 매수/매도 요청 → 승인 → 포지션 관리 → 성과 추적
- 실시간 시세 기반 수익률/프로그레스 표시
- 팀원 간 토론, AI 분석 기능

### 기술 스택
- **Backend**: FastAPI + SQLAlchemy + PostgreSQL
- **Frontend**: React 18 + Vite + Tailwind CSS + Zustand
- **실시간**: python-socketio / socket.io-client
- **시세**: 한국투자증권 API, Yahoo Finance, Binance

---

## 현재 아키텍처 특성

### 계산 로직 분포

| 계산 | 위치 | 이유 |
|------|------|------|
| 포지션 종료 시 수익률 | Backend | DB 저장 필요 |
| 실시간 수익률 | Frontend | 현재가 기반 즉시 반응 |
| 프로그레스바 진행도 | Frontend | 현재가 기반 실시간 |
| 타겟 도달 여부 | Frontend | UI 즉시 반영 |

**중요**: 실시간 표시 항목은 프론트엔드 계산이 적합함. 무조건 백엔드로 옮기지 말 것.

### 파일 구조

```
frontend/src/
├── pages/           # 12개 페이지 (Dashboard, Positions, PositionDetail 등)
├── components/
│   ├── common/      # Button, Modal, Card, ProfitProgressBar 등
│   ├── charts/      # StockChart, ChartModal, MiniChart
│   ├── forms/       # BuyRequestForm, SellRequestForm
│   └── ...
├── services/        # API 클라이언트 (18개)
├── hooks/           # useAuth, useWebSocket, usePositions
├── stores/          # Zustand 스토어
└── context/         # Auth, WebSocket, Toast, Theme

backend/app/
├── api/             # REST 라우터 (15개)
├── services/        # 비즈니스 로직 (16개)
├── models/          # SQLAlchemy 모델 (13개)
└── schemas/         # Pydantic 스키마
```

---

## 알려진 문제점

### 1. 코드 중복 (같은 로직이 여러 곳에)

**프로그레스바 예시**:
```
- ProfitProgressBar.jsx: TargetProgressBar 컴포넌트 정의
- Positions.jsx:1134-1168: 인라인으로 동일 로직 재구현
- Dashboard.jsx:557-596: 인라인으로 동일 로직 재구현
```

**문제**: 수정 시 3곳 모두 변경해야 하고, 놓치기 쉬움

### 2. 사용되지 않는 코드 잔존

과거 수정 시 제거하지 않은 코드들:
- 사용 안 하는 import
- 주석 처리된 옛날 로직
- 더 이상 호출되지 않는 함수

### 3. 일관성 없는 구현

같은 기능인데 다르게 구현된 것들:
- 프로그레스바: 컴포넌트 vs 인라인
- 수익률 계산: 일부는 `profit_rate / 100`, 일부는 그냥 `profit_rate`
- 에러 처리: 일부는 toast, 일부는 console.error만

### 4. 거대한 페이지 컴포넌트

- `Positions.jsx`: ~1200줄
- `PositionDetail.jsx`: ~1600줄
- `Dashboard.jsx`: ~900줄

한 파일에 너무 많은 로직이 있어 유지보수 어려움

---

## 리팩토링 목표

### 필수 목표
1. **코드 중복 제거**: 같은 로직은 한 곳에만
2. **사용 안 하는 코드 정리**: import, 함수, 변수
3. **일관성 확보**: 같은 패턴은 같은 방식으로

### 선택 목표 (신중하게)
4. 거대 컴포넌트 분리 (필요 시에만)
5. 타입 안정성 개선 (점진적으로)

---

## ⚠️ 주의사항 (절대 하지 말 것)

### 1. 대규모 구조 변경 금지
```
❌ 폴더 구조 전면 재편
❌ 상태 관리 라이브러리 교체
❌ 스타일링 방식 변경
```

### 2. 작동하는 코드 함부로 건드리지 말 것
```
❌ "더 좋아 보여서" 리팩토링
❌ 요청하지 않은 최적화
❌ 스타일만 다른 코드 통일
```

### 3. 한 번에 많이 바꾸지 말 것
```
❌ 여러 파일 동시 대규모 수정
❌ "ついでに" (ついでに = 김에) 수정
❌ 관련 없는 코드 같이 수정
```

### 4. 실시간 기능 백엔드로 옮기지 말 것
```
❌ 현재가 기반 수익률 계산을 백엔드로
❌ 프로그레스바 진행도를 API로
❌ 매번 서버 호출하는 구조로 변경
```

### 5. 기존 API 인터페이스 변경 금지
```
❌ API 응답 구조 변경
❌ 엔드포인트 URL 변경
❌ 필수 파라미터 추가
```

---

## ✅ 권장사항

### 1. 작은 단위로 수정
```
✅ 한 번에 1개 이슈만 해결
✅ 수정 후 즉시 테스트
✅ 커밋 단위 작게 유지
```

### 2. 수정 전 현재 동작 확인
```
✅ 수정 전 스크린샷/동작 기록
✅ 수정 후 동일하게 작동하는지 확인
✅ 의도치 않은 변경 없는지 체크
```

### 3. 제거 시 철저히
```
✅ 코드 제거 시 관련 import도 제거
✅ 사용처 모두 확인 후 제거
✅ 제거한 것 커밋 메시지에 명시
```

### 4. 새 코드보다 기존 코드 활용
```
✅ 이미 있는 컴포넌트 사용
✅ 이미 있는 유틸 함수 사용
✅ 새로 만들기 전에 기존 것 검색
```

---

## 우선순위별 리팩토링 대상

### P1: 즉시 해결 (코드 중복)

#### 프로그레스바 통일
```
현재:
- ProfitProgressBar.jsx에 TargetProgressBar 컴포넌트 있음
- Positions.jsx, Dashboard.jsx에서 인라인으로 재구현

목표:
- 인라인 코드 제거
- TargetProgressBar 컴포넌트만 사용
- 70% 효과 등 특수 기능은 컴포넌트에 옵션으로 추가
```

### P2: 점진적 개선

#### 거대 컴포넌트 분리 (필요 시)
```
Positions.jsx 분리 후보:
- PositionCard (포지션 카드 1개)
- PositionFilters (필터 UI)
- InlineChart (인라인 차트 영역)

PositionDetail.jsx 분리 후보:
- PositionHeader (상단 정보)
- TradingPlanSection (매매 계획)
- DecisionNoteSection (의사결정 노트)
```

### P3: 나중에 (급하지 않음)

- TypeScript 마이그레이션
- 테스트 코드 추가
- 성능 최적화

---

## 리팩토링 체크리스트

수정 완료 후 확인:

```
[ ] 기존 기능 동일하게 작동하는가?
[ ] 사용 안 하는 import 제거했는가?
[ ] 사용 안 하는 변수/함수 제거했는가?
[ ] 새로 만든 것 없이 기존 것 활용했는가?
[ ] 커밋 메시지에 변경 내용 명확히 기술했는가?
[ ] 관련 없는 파일 건드리지 않았는가?
```

---

## 파일별 메모

### ProfitProgressBar.jsx
- `TargetProgressBar`: 타겟 기반 프로그레스 (사용 권장)
- `ProfitProgressBar`: 단순 수익률 바
- `calculateTargetProgress`: 계산 함수 (인라인용, 컴포넌트 사용 권장)

### Positions.jsx (~1200줄)
- 1017-1030: calculateTargetProgress 인라인 사용 → TargetProgressBar로 교체 가능
- 1134-1168: 프로그레스바 인라인 구현 → TargetProgressBar로 교체 가능

### Dashboard.jsx (~900줄)
- 557-596: 프로그레스바 인라인 구현 → TargetProgressBar로 교체 가능

### PositionDetail.jsx (~1600줄)
- 1122-1129: TargetProgressBar 정상 사용 중 (참고용)

---

## 질문 시 포함할 정보

리팩토링 요청 시 다음 정보 제공:

1. **대상 파일**: 어떤 파일을 수정할 것인지
2. **현재 문제**: 무엇이 문제인지 구체적으로
3. **원하는 결과**: 수정 후 어떻게 되어야 하는지
4. **범위 제한**: 건드리지 말아야 할 것

예시:
```
"Positions.jsx의 인라인 프로그레스바(1134-1168줄)를
TargetProgressBar 컴포넌트로 교체해줘.
70% 근접 시 애니메이션 효과는 유지해야 함.
다른 파일은 건드리지 마."
```
