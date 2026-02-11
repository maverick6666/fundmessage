# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

**펀드팀 메신저** - 펀드팀의 매매 의사결정을 체계적으로 관리하는 웹 애플리케이션.
카카오톡 단톡방 기반의 비체계적인 운영을 대체하여 매수/매도 요청, 승인, 포지션 관리, 팀 성과 추적 기능 제공.

**핵심 비즈니스 플로우**: 팀원 요청 제출 → 팀장 승인/거부/토론 개시 → 팀장 거래 체결 → 포지션 추적 → 성과 기록

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| **백엔드** | FastAPI, Python 3.11+, SQLAlchemy 2.0, PostgreSQL, python-socketio |
| **프론트엔드** | React 18, Vite, Tailwind CSS, Socket.io-client, Zustand |
| **인증** | JWT (PyJWT) - Access Token 60분, Refresh Token 7일 |
| **배포** | Backend: CloudType, Frontend: Vercel |
| **시세** | 한국투자증권 API, Yahoo Finance, Binance API |
| **AI** | OpenAI GPT-4-mini (의사결정노트/운용보고서 자동 생성) |

---

## 주요 명령어

### 백엔드
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 마이그레이션
alembic upgrade head                    # 적용
alembic revision --autogenerate -m "설명"  # 생성
```

### 프론트엔드
```bash
cd frontend
npm install
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
```

### Docker
```bash
cp .env.example .env
docker-compose up -d --build
docker-compose logs -f
```

---

## 백엔드 구조 (backend/app/)

```
app/
├── main.py              # FastAPI 앱, WebSocket, 시작 이벤트
├── config.py            # 환경 설정 (DB, JWT, SMTP, API keys)
├── database.py          # SQLAlchemy 엔진, 세션
├── dependencies.py      # FastAPI 의존성 (인증, DB)
├── models/              # SQLAlchemy ORM 모델 (13개)
├── schemas/             # Pydantic 스키마
├── api/                 # REST API 라우터 (15개)
├── services/            # 비즈니스 로직 (11개)
├── websocket/           # WebSocket 관리
└── utils/               # JWT, 암호화 유틸
```

### 데이터베이스 모델 (13개)

| 모델 | 설명 | 주요 필드 |
|------|------|----------|
| **User** | 팀원 | email, username, role (manager/admin/member), is_active |
| **Position** | 포지션 | ticker, market, status, average_buy_price, profit_rate, buy_plan (JSON) |
| **Request** | 매수/매도 요청 | request_type, status (pending/approved/rejected/discussion) |
| **Discussion** | 토론 세션 | request_id, position_id, status (open/closed) |
| **Message** | 채팅 메시지 | discussion_id, content, message_type, chart_data (JSON) |
| **DecisionNote** | 의사결정 기록 | position_id, blocks (JSON), note_type (decision/report) |
| **TradingPlan** | 매매 계획 스냅샷 | position_id, version, changes (JSON) |
| **Attendance** | 출석 기록 | user_id, date, status |
| **TeamColumn** | 팀 칼럼 | blocks (JSON), is_verified |
| **PriceAlert** | 가격 알림 | position_id, alert_type, target_price |
| **Notification** | 알림 | user_id, notification_type, is_read |
| **AuditLog** | 수정 이력 | entity_type, action, changes (JSON) |
| **TeamSettings** | 팀 설정 | initial_capital_krw/usd, ai_daily_limit |

### API 라우터 (15개)

| 라우터 | 경로 | 주요 기능 |
|--------|------|----------|
| auth | `/auth` | 회원가입, 로그인, 이메일 인증, 토큰 |
| users | `/users` | 팀원 조회, 역할 변경, 승인 |
| positions | `/positions` | 포지션 CRUD, 확인, 종료 |
| requests | `/requests` | 매수/매도 요청, 승인/거부/토론 |
| discussions | `/discussions` | 토론 CRUD, 메시지 |
| decision_notes | `/positions/{id}/notes` | 의사결정노트 CRUD |
| trading_plans | `/positions/{id}/plans` | 매매계획 CRUD |
| stats | `/stats` | 통계, 팀 랭킹 |
| prices | `/prices` | 시세 검색/조회, 캔들 |
| notifications | `/notifications` | 알림 조회/읽음 |
| columns | `/columns` | 팀 칼럼 CRUD |
| reports | `/reports` | 운용보고서 |
| attendance | `/attendance` | 출석 체크인/통계 |
| ai | `/ai` | AI 노트/보고서 생성 |
| uploads | `/uploads` | 이미지 업로드 |

### 서비스 레이어 (11개)

`position_service`, `request_service`, `discussion_service`, `price_service`, `auth_service`, `stats_service`, `notification_service`, `ai_service`, `audit_service`, `email_service`, `stock_search_service`

---

## 프론트엔드 구조 (frontend/src/)

```
src/
├── pages/           # 페이지 (12개)
├── components/      # 컴포넌트
│   ├── common/      # Button, Modal, Card, ConfirmModal
│   ├── layout/      # Layout, Header, Sidebar, SidePanel
│   ├── forms/       # BuyRequestForm, SellRequestForm
│   ├── editor/      # BlockEditor, NoteEditorPanel
│   ├── documents/   # DocumentPanel, DocumentViewer
│   ├── charts/      # StockChart, MiniChart, ChartModal
│   ├── ai/          # AIDecisionNoteModal
│   └── attendance/  # AttendanceCalendar
├── context/         # AuthContext, WebSocketContext, ToastContext, ThemeContext
├── services/        # API 클라이언트 (20개)
├── hooks/           # useAuth, useWebSocket, usePositions
├── stores/          # Zustand (useLayoutStore, useSidePanelStore)
└── utils/           # 포맷팅 유틸
```

### 주요 페이지

| 페이지 | 경로 | 설명 |
|--------|------|------|
| Login/Signup | `/login`, `/signup` | 인증 |
| Dashboard | `/` | 대시보드 (팀 정보, 공지) |
| Positions | `/positions` | 포지션 목록 |
| PositionDetail | `/positions/:id` | 포지션 상세 (차트, 계획, 노트) |
| Requests | `/requests` | 요청 목록 |
| Discussions | `/discussions` | 토론 목록/채팅 |
| Stats | `/stats` | 통계 |
| Reports | `/reports` | 운용보고서 |
| TeamManagement | `/team` | 팀 관리 (팀장/관리자) |

---

## 구현 완료 기능

### 인증 & 사용자
- [x] 회원가입 (이메일 인증)
- [x] JWT 로그인 + Refresh Token
- [x] 역할 관리 (manager/admin/member)
- [x] 팀원 승인/비활성화

### 포지션 관리
- [x] 포지션 CRUD
- [x] 정보 확인 플로우 (팀장이 실제 체결 정보 입력)
- [x] 분할 매수 계획 (buy_plan)
- [x] 익절/손절 목표
- [x] 포지션 종료 시 손익 계산

### 요청 & 승인
- [x] 매수/매도 요청 제출
- [x] 팀장 승인/거부 (거부 사유)
- [x] 토론 개시

### 실시간 토론
- [x] WebSocket 기반 실시간 채팅
- [x] 차트 공유 (chart_data)
- [x] 토론 종료/재개

### 시세 & 차트
- [x] 한국투자증권/Yahoo Finance/Binance 시세
- [x] 캔들 차트 (lightweight-charts)

### 의사결정 기록
- [x] 블록 에디터 (Editor.js 호환)
- [x] AI 자동 생성

### 알림 & 출석
- [x] 요청 승인/거부/토론 알림
- [x] 일일 출석 체크인
- [x] 팀 칼럼으로 출석 회복

### 통계 & 리포트
- [x] 수익률, 승률, 거래 수
- [x] 팀 랭킹
- [x] AI 운용보고서

---

## UI 개발 규칙

### 시스템 알림 사용 금지
`window.alert()`, `window.confirm()`, `window.prompt()` **절대 사용 금지**

```jsx
// 확인 대화상자 → ConfirmModal 사용
import { ConfirmModal } from '../components/common/ConfirmModal';

<ConfirmModal
  isOpen={showConfirm}
  onClose={() => setShowConfirm(false)}
  onConfirm={handleDelete}
  title="삭제 확인"
  message="정말 삭제하시겠습니까?"
  confirmText="삭제"
  confirmVariant="danger"
/>

// 알림 → Toast 사용
toast.success('저장되었습니다');
toast.error('오류가 발생했습니다');
toast.warning('주의가 필요합니다');
```

---

## 사용자 역할

| 역할 | 권한 |
|------|------|
| **manager** (팀장) | 요청 승인/거부, 거래 체결, 포지션 확인, 팀 설정 |
| **admin** (관리자) | 사용자 관리 |
| **member** (팀원) | 매수/매도 요청 제출 |

---

## 포지션 정보 확인 플로우

1. 팀원이 매수 요청 제출
2. 팀장이 요청 승인 → 포지션 자동 생성 (`is_info_confirmed = false`)
3. 팀장이 실제 체결 내역 확인 후 평균 매입가/수량 수정 → **정보 확인 완료**
4. 포지션 종료 시 팀장이 실제 청산 금액 입력 필수 → 수익률 자동 계산

> 포지션이 미확인 상태면 **노란 느낌표 아이콘**으로 표시됨

---

## 시세 API 설정

### 한국투자증권
```env
KIS_APP_KEY=your_app_key
KIS_APP_SECRET=your_app_secret
```

### Yahoo Finance / Binance
- Yahoo Finance: 별도 설정 불필요
- Binance: 공개 API (키 불필요)

---

## 배포 & 환경

### 배포 URL
- **Frontend**: https://fundmessage.vercel.app
- **Backend**: CloudType

### 배포 프로세스
1. 코드 변경 → `git push`
2. Frontend: Vercel 자동 배포
3. Backend: CloudType 수동 재배포 필요
4. DB 스키마 변경 시: `alembic upgrade head`

### 테스트 계정
- **팀장**: lhhh0420@naver.com / lhh0420!
- **팀원**: test@naver.com / 12345678

---

## 워크플로우 스킬

| 작업 유형 | 스킬 | 설명 |
|----------|------|------|
| 프론트엔드 UI/스타일 | `frontend-workflow` | 스크린샷 확인 → 승인 → 작업 |
| 기능 개선/새 기능 | `improve-workflow` | 분석 → 명세 → 구현 → 테스트 |
| 버그 수정 | `bugfix-workflow` | 재현 → 분석 → 수정 → 검증 |
| 새 프로젝트 | `init-project` | `/init-project`로 명시 호출 |

### 핵심 규칙
1. 작업 전 스크린샷으로 현재 상태 확인
2. 모든 작업은 `docs/CURRENT_TASK.md`에 기록
3. 작업 완료 후 테스트 실행
4. 수동 작업 필요 시 사용자에게 안내

### 자동 로드 문서
- 세션 시작: `docs/CURRENT_TASK.md`, `docs/TEST_INFO.md`
- 세션 종료: `docs/MANUAL_STEPS.md`

---

## 메모리 시스템

이 프로젝트는 세션 간 지식 유지를 위한 **자동화된 메모리 시스템**을 사용합니다.
메모리 파일은 프로젝트 루트 `memory/` 디렉토리에 있습니다.

```
memory/
├── session-state.md    # 현재 상태 스냅샷 (진행중/완료 작업, 이슈)
├── work-log.md         # 시간순 작업 이력 (최신이 위)
├── decisions.md        # 기술적 결정 & 환경 변경 이력
├── solutions/          # 상세 해결 기록 (YYYY-MM-DD-설명.md)
└── patterns/           # 재사용 코드 패턴 (주제명.md)
```

### 세션 시작 시 (필수)
1. SessionStart 훅이 `session-state.md`와 `work-log.md`를 자동 출력
2. 사용자의 첫 요청과 관련된 키워드로 `memory/solutions/`와 `memory/patterns/`를 Grep 검색
3. 유사한 과거 작업이 있으면 해당 파일을 읽고 참조

### 사용자 메시지 파싱 규칙 (필수)

사용자가 긴 메시지에 여러 작업(버그/개선/기능)을 섞어 보낼 때, **코드 작업 전에 반드시**:

1. **작업 추출**: 메시지에서 개별 작업 단위를 분리하고 분류
   - "안됨/오류/에러/버그" → 🔴 버그 수정
   - "이렇게 표시/디자인/UI" → 🟡 UI 개선
   - "추가/넣고싶/새로운/기능" → 🟢 신규 기능
   - "개선/수정/변경/바꿔" → 🔵 개선
   - "이제부터/앞으로/~로 바꿀래/~로 전환/~안쓸래/~쓸래" → ⚙️ 설정/규칙 변경 (즉시 반영!)

2. **작업 목록 기록**: `memory/session-state.md`의 "현재 작업 목록"에 체크리스트로 기록
   ```markdown
   ## 현재 작업 목록 (YYYY-MM-DD 사용자 요청)
   - [ ] 🔴 [버그] 설명
   - [ ] 🟡 [UI] 설명
   - [ ] 🟢 [기능] 설명
   ```

3. **유사 작업 검색**: 각 작업 키워드로 `memory/solutions/`와 `memory/patterns/` Grep 검색

4. **사용자에게 파싱 결과 확인**: 추출한 작업 목록과 유사 과거 작업을 보여주고 확인

5. **설정/규칙 변경 즉시 반영**: ⚙️로 분류된 항목은 작업 완료를 기다리지 않고 **즉시**:
   - `memory/decisions.md`에 Before/After/이유 기록
   - `memory/session-state.md`의 "개발 환경" 섹션 업데이트
   - 해당 프로젝트 MEMORY.md의 "절대 규칙" 섹션도 필요하면 업데이트
   - 사용자에게 "규칙이 업데이트되었습니다: [변경 내용]" 확인

6. **순차 작업**: 각 작업을 순서대로 처리하며 체크리스트 업데이트
   - 시작 시 `[ ]` → `[진행중]`
   - 완료 시 → `[x]`

### 작업 완료 시 (필수)

1. `memory/work-log.md` 맨 위에 작업 요약 추가 (날짜, 유형, 요청, 수정, 영향 파일)
2. `memory/session-state.md` 업데이트 (체크리스트 완료, 최근 완료 작업 이동)
3. **버그 수정** → `memory/solutions/YYYY-MM-DD-설명.md` 생성 (문제, 원인, 해결, 핵심 코드, 영향 파일)
4. **재사용 패턴 발견** → `memory/patterns/주제명.md` 생성/업데이트 (표준 코드, 적용 위치, 주의사항)
5. **환경/기술 결정 변경** → `memory/decisions.md`에 추가 (Before/After/이유/영향)

### 컨텍스트 압축 시 (PreCompact 훅)
- 압축 직전 알림이 표시됨
- 압축 후 반드시 `memory/session-state.md`를 다시 읽어 맥락 복구

---

## 개발 로드맵

- **Phase 1 (MVP)**: 인증, 요청, 포지션, 대시보드 ✅
- **Phase 2**: 실시간 토론 ✅
- **Phase 3**: 한국투자증권 API 연동 (진행중)
- **Phase 4**: 고급 분석, 바이낸스 지원
- **Phase 5**: Vision LLM 연동 (거래내역 캡처 인식)
