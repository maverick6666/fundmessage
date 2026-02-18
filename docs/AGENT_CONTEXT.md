# Agent Context Document — 펀드팀 메신저 (Fund Messenger)

> 이 문서는 AI 에이전트에게 프로젝트 맥락을 제공하기 위한 브리핑 문서입니다.
> 코드를 수정하거나 기능을 추가하기 전에 반드시 읽어야 합니다.

---

## 프로젝트 정체성

**펀드팀 메신저** — 대학 펀드팀의 매매 의사결정을 관리하는 웹앱. 카카오톡 단톡방을 대체한다.

**핵심 플로우**: 팀원이 매수/매도 요청 → 팀장(펀드매니저)이 승인/거부/토론 → 팀장이 실제 거래 체결 → 포지션 추적 → 수익률 계산 → AI가 의사결정 기록 자동 생성

---

## 기술 스택

```
Backend:  FastAPI + SQLAlchemy 2.0 + PostgreSQL + python-socketio
Frontend: React 18 + Vite + Tailwind CSS + Zustand + socket.io-client
AI:       OpenAI GPT-5-mini (Responses API + verbosity)
시세:     한국투자증권 API (국내) + Yahoo Finance (해외) + Binance (암호화폐)
뉴스:     네이버 검색 API + yfinance news
인증:     JWT (Access 60분 + Refresh 30일, 회전)
푸시:     Web Push (VAPID) + PWA (Service Worker)
배포:     CloudType (백엔드) + Vercel (프론트) / Docker (로컬)
```

---

## 디렉토리 구조

```
fundmessage/
├── backend/
│   └── app/
│       ├── main.py           # FastAPI 앱 진입점, WebSocket, 시작 이벤트
│       ├── config.py         # 환경변수 (Settings, pydantic-settings)
│       ├── database.py       # SQLAlchemy 엔진, SessionLocal
│       ├── dependencies.py   # get_current_user, get_manager 등 인증 의존성
│       ├── models/           # 18개 ORM 모델
│       ├── schemas/          # Pydantic 요청/응답 스키마
│       ├── api/              # 17개 REST 라우터 (100+ 엔드포인트)
│       ├── services/         # 비즈니스 로직 (11개 서비스)
│       ├── websocket/        # WebSocket 매니저
│       └── utils/            # JWT, bcrypt
├── frontend/
│   └── src/
│       ├── pages/            # 12개 페이지 컴포넌트
│       ├── components/       # common/ layout/ forms/ editor/ charts/ documents/
│       ├── context/          # AuthContext, WebSocketContext, ToastContext, ThemeContext
│       ├── services/         # 20개 API 클라이언트 (axios 기반)
│       ├── stores/           # Zustand (useLayoutStore, useSidePanelStore)
│       ├── hooks/            # useAuth, useWebSocket, usePositions
│       └── utils/            # formatters.js (formatNumber, KST 유틸 등)
├── docker-compose.yml
├── docs/                     # 프로젝트 문서
└── memory/                   # AI 세션 간 메모리 시스템
```

---

## 데이터 모델 요약 (18개)

### 핵심 비즈니스
| 모델 | 테이블 | 핵심 필드 | 역할 |
|------|--------|-----------|------|
| **User** | users | email, role(manager/admin/member/viewer), is_active | 사용자 |
| **Position** | positions | ticker, market, status(open/closed), average_buy_price, total_quantity, buy_plan(JSON), take_profit_targets(JSON), profit_rate | 포지션 |
| **Request** | requests | request_type(buy/sell), status(pending/approved/rejected/discussion), target_ticker | 매수/매도 요청 |
| **Discussion** | discussions | request_id?, position_id?, status(open/closed), session_count | 토론 채널 |
| **Message** | messages | discussion_id, content, message_type(text/system/chart), chart_data(JSON) | 채팅 메시지 |

### AI/뉴스
| 모델 | 테이블 | 역할 |
|------|--------|------|
| **NewsDesk** | news_desks | 일일 뉴스 브리핑 (columns, news_cards, keywords, sentiment, top_stocks — 모두 JSON) |
| **RawNews** | raw_news | 수집 원본 뉴스 (source, title, description, link) |
| **DecisionNote** | decision_notes | 의사결정서/운용보고서 (blocks=Editor.js JSON, note_type) |

### 팀 관리
| 모델 | 테이블 | 역할 |
|------|--------|------|
| **TeamSettings** | team_settings | 초기 자본금(KRW/USD), AI 일일 제한 |
| **Attendance** | attendances | 출석 기록 (user_id+date unique, status) |
| **TeamColumn** | team_columns | 팀 칼럼 (blocks=Editor.js, is_verified) |
| **AssetSnapshot** | asset_snapshots | 일일 자산 스냅샷 (KRW/USD 현금+평가, 손익) |

### 기타
| 모델 | 역할 |
|------|------|
| **TradingPlan** | 매매계획 버전 히스토리 + 체결 기록 |
| **Comment** | 문서별 댓글 (document_type으로 구분) |
| **Notification** | 인앱 알림 |
| **PushSubscription** | Web Push 구독 (VAPID) |
| **AuditLog** | 변경 이력 |
| **PriceAlert** | 목표가 알림 |

---

## 사용자 역할

| 역할 | 핵심 권한 |
|------|-----------|
| **manager** (팀장, 1명) | 요청 승인/거부, 거래 체결, 포지션 확인/종료, 팀 설정, 역할 변경 |
| **admin** (관리자) | 대부분 팀장과 동일하나 역할 변경 불가 |
| **member** (팀원) | 요청 제출, 토론 참여, 칼럼 작성 |
| **viewer** (뷰어) | 읽기 전용 |

인증 의존성: `get_current_user` → `get_writer_user` → `get_manager_or_admin` → `get_manager`

---

## 주요 API 엔드포인트 (prefix: `/api/v1`)

```
POST /auth/login                    → 로그인 (자동 출석)
POST /auth/refresh                  → 토큰 갱신
GET  /positions                     → 포지션 목록
POST /positions/{id}/confirm        → 정보 확인 (팀장)
POST /positions/{id}/close          → 종료 (팀장)
POST /requests/buy                  → 매수 요청
POST /requests/sell                 → 매도 요청
POST /requests/{id}/approve         → 승인 (팀장)
GET  /discussions/{id}/messages     → 토론 메시지
POST /discussions/{id}/messages     → 메시지 전송
GET  /newsdesk/today                → 오늘 뉴스데스크
GET  /newsdesk/benchmarks           → 벤치마크 차트
POST /ai/generate-decision-note     → AI 의사결정서
POST /ai/generate-operation-report  → AI 운용보고서
GET  /prices/candles                → 캔들 데이터
GET  /stats/asset-history           → 자산 추이
WS   /ws?token={jwt}               → 실시간 토론
```

---

## 프론트엔드 페이지

| 경로 | 컴포넌트 | 설명 |
|------|----------|------|
| `/` | NewsDesk | 메인. 일일 뉴스 브리핑 대시보드 (1,691줄) |
| `/dashboard` | Dashboard | 팀 자산 현황, 최근 활동 |
| `/positions` | Positions | 포지션 목록 (보유/종료 필터) |
| `/positions/:id` | PositionDetail | 캔들차트, 매매계획, 의사결정서 |
| `/requests` | Requests | 매수/매도 요청 목록 |
| `/discussions` | Discussions | 토론 목록 |
| `/discussions/:id` | Discussion | 실시간 채팅 |
| `/stats` | Stats | 통계 (3탭 차트, 랭킹) |
| `/reports` | Reports | 의사결정서/운용보고서 목록 |
| `/team` | TeamManagement | 팀 관리 (팀장 전용) |
| `/settings` | Settings | 푸시 알림 설정 |
| `/columns/new` | ColumnEditor | 칼럼 작성 |

---

## 주요 서비스 레이어

### 백엔드 서비스

| 서비스 | 파일 | 핵심 기능 |
|--------|------|-----------|
| **PriceService** | price_service.py | get_price(), get_candles() — 한투/yfinance/Binance 분기 |
| **NewsDeskAI** | newsdesk_ai.py | generate_newsdesk() — 200줄 시스템 프롬프트, Responses API |
| **NewsCrawler** | news_crawler.py | collect_for_morning_briefing() — 네이버+yfinance |
| **AIService** | ai_service.py | generate_decision_note(), generate_operation_report() |
| **NotificationService** | notification_service.py | create_notification() — DB + WebSocket + Web Push |
| **AssetService** | asset_service.py | create_daily_snapshot() — 실시간 시세 기반 |

### 프론트엔드 서비스 (axios 기반)
```
positionService, requestService, discussionService, priceService,
authService, statsService, notificationService, aiService,
attendanceService, columnService, reportService, newsdeskService, commentService, ...
```

### Zustand 스토어
- `useLayoutStore` — 사이드바 접힘, 사이드패널 너비
- `useSidePanelStore` — 사이드패널 열기/닫기, 패널 타입/데이터

---

## 스케줄러 (APScheduler)

| 작업 | 시간 (KST) | 로직 |
|------|------------|------|
| 뉴스데스크 생성 | 05:30 | 크롤링 → AI 분석 → NewsDesk 저장 |
| 자산 스냅샷 | 09:00 | 실시간 시세 조회 → AssetSnapshot 저장 |

---

## 절대 규칙 (반드시 준수)

### 개발 환경
- **로컬 개발 중** (Docker) — 클라우드타입/Vercel 배포 언급하지 말 것
- 빌드/테스트: `docker-compose up -d --build`
- 프론트엔드 빌드 확인: `npm run build`

### 시간
- 모든 시간 로직은 **KST (UTC+9)** 기준
- `from zoneinfo import ZoneInfo; kst = ZoneInfo("Asia/Seoul")`
- 일일 리셋/출석: KST 자정 기준

### UI
- `window.alert()` / `window.confirm()` / `window.prompt()` **절대 금지**
- 확인 대화상자: `<ConfirmModal>` 컴포넌트 사용
- 알림: `toast.success()` / `toast.error()` / `toast.warning()` 사용
- 프론트엔드 UI 작업: **frontend-design 스킬**로만 작업 (직접 코드 수정 금지)

### AI 모델
- 프로덕션: `gpt-5-mini`
- 테스트: `gpt-5-nano`
- 설정: `backend/app/config.py`의 `openai_model`

### 테스트 계정
- 팀장: `lhhh0420@naver.com` / `lhh0420!`
- 팀원: `test@naver.com` / `12345678`

---

## 코드 패턴

### 백엔드 API 패턴
```python
@router.post("/{id}/approve")
async def approve_request(
    id: int,
    data: RequestApprove,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_manager),  # 팀장 전용
):
    request = db.query(Request).filter(Request.id == id).first()
    if not request:
        raise HTTPException(status_code=404, detail="요청을 찾을 수 없습니다")
    # ... 비즈니스 로직
    db.commit()
    # 알림 발송
    notification_service.create_notification(db, ...)
    return {"success": True, "data": {...}}
```

### 프론트엔드 API 호출 패턴
```javascript
import api from './api';  // axios 인스턴스 (JWT 자동 첨부, 401 자동 갱신)

export const positionService = {
  getPositions: (params) => api.get('/positions', { params }),
  closePosition: (id, data) => api.post(`/positions/${id}/close`, data),
};
```

### WebSocket 패턴
```javascript
// context/WebSocketContext.jsx — socket.io-client
const { connect, isConnected, socket } = useWebSocket();
// Layout.jsx에서 인증 시 자동 connect
// Discussion.jsx에서 socket.on('new_message', ...) 리스닝
```

### Toast 패턴
```javascript
import { useToast } from '../context/ToastContext';
const toast = useToast();
toast.success('저장되었습니다');
toast.error('오류가 발생했습니다');
```

---

## 알림 체계 (9종)

| 이벤트 | 수신자 | 전달 |
|--------|--------|------|
| 요청 제출 | 팀장 | DB + WebSocket + Push |
| 요청 승인/거부 | 요청자 | DB + WebSocket + Push |
| 토론 시작 | 전체 | DB + WebSocket + Push |
| 토론 메시지 | 참여자 | DB + WebSocket + Push |
| 토론 종료 | 참여자 | DB + WebSocket + Push |
| 토론 요청 (팀원→팀장) | 팀장 | DB + WebSocket + Push |
| 포지션 토론 요청 | 팀장 | DB + WebSocket + Push |
| 조기 청산 요청 | 팀장 | DB + WebSocket + Push |

---

## 뉴스데스크 AI 상세

### 프롬프트 구조 (newsdesk_ai.py, 200줄+)
```
<ROLE> 증권사 리서치센터 수석 편집자
<OUTPUT_RULES> JSON, 한국어, 이모지 금지, 마크다운
<NEWS_CARD_SPEC> 4파트 12-16문장 (핵심수치/배경맥락/시장영향/투자시사점)
<COLUMN_SPEC> 4파트 30-40문장 (도입/현황분석/리스크기회/결론)
<TOP_STOCKS_SPEC> 4파트 15-20문장
<SENTIMENT_SPEC> 탐욕/공포 0-100 (CNN Fear & Greed 스타일)
<QUALITY_CHECKLIST> 수치 3개+, 교차참조 4개+, 볼드, 소제목
<COLUMN_EXAMPLE> 참고 예시 (반도체 칼럼)
<OUTPUT_FORMAT> JSON 스키마
<REQUIREMENTS> 칼럼2, 카드6, 키워드8-12, 종목3
<TIME_CONTEXT> 어제+오늘새벽 시간 흐름 연결
```

### API 전략
1. **1차**: Responses API + verbosity=high + reasoning=medium
2. **Fallback**: Chat Completions + response_format=json_object
3. **JSON 추출**: 직접 파싱 → 코드블록 → 중괄호 추출 (3단계)

### 뉴스 수집 (news_crawler.py)
- 14 키워드 카테고리 (core, finance, realestate, consumer, labor, entertainment, crypto, ai_semi, ev_mobility, bio_health, energy_infra, macro_policy, bigtech, events)
- 네이버: 키워드당 10개, 날짜 필터, 링크 중복 제거
- yfinance: 8개 티커 (^GSPC, ^IXIC, AAPL, NVDA, TSLA, MSFT, GOOGL, AMZN)

---

## 포지션 정보 확인 플로우 (중요)

1. 팀원이 매수 요청 → 팀장 승인 → 포지션 자동 생성 (`is_info_confirmed = false`)
2. 실제 체결과 요청 내용은 다를 수 있음 (시장가 체결, 부분 체결 등)
3. 팀장이 실제 체결 내역으로 평균 매입가/수량을 수정 → `is_info_confirmed = true`
4. 미확인 포지션은 UI에서 **노란 느낌표**로 표시
5. 포지션 종료 시 팀장이 실제 청산 금액 입력 필수

---

## 매매계획 구조 (JSON)

```json
{
  "buy_plan": [
    {"price": 50000, "quantity": 10, "completed": false},
    {"price": 48000, "quantity": 15, "completed": true}
  ],
  "take_profit_targets": [
    {"price": 60000, "ratio": 0.5, "completed": false}
  ],
  "stop_loss_targets": [
    {"price": 45000, "ratio": 1.0, "completed": false}
  ]
}
```
- `completed` 토글 시 TradingPlan에 체결 기록 생성 (version 히스토리)
- 실제 체결가/수량은 팀장이 별도 입력

---

## 환경변수

```env
DATABASE_URL=postgresql://...
SECRET_KEY=...
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5-mini
NAVER_CLIENT_ID=...
NAVER_CLIENT_SECRET=...
KIS_APP_KEY=...
KIS_APP_SECRET=...
SMTP_HOST=smtp.gmail.com
SMTP_USER=...
SMTP_PASSWORD=...
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
```

---

## 빌드 & 실행

```bash
# 로컬 개발 (Docker)
docker-compose up -d --build

# 프론트엔드만
cd frontend && npm run dev

# 백엔드만
cd backend && uvicorn app.main:app --reload --port 8000

# DB 마이그레이션
cd backend && alembic upgrade head
cd backend && alembic revision --autogenerate -m "설명"

# 프론트엔드 빌드 검증
cd frontend && npm run build
```

---

## 알려진 이슈 및 주의사항

1. **해외 칼럼 깊이 부족**: yfinance 뉴스 30건으로는 분석 깊이 한계
2. **iOS 푸시**: PushManager.subscribe()는 반드시 사용자 제스처(클릭) 내에서 호출해야 함
3. **ErrorBoundary**: `key={location.pathname}` 필수 (라우트 변경 시 리셋)
4. **시세 API 불안정**: yfinance info/fast_info가 None 반환 가능 → null check 필수
5. **AI 일일 제한**: 팀 전체 3회/일 (의사결정서 + 운용보고서 합산)
6. **KST 기준**: `datetime.utcnow()` 쓰지 말 것. `datetime.now(ZoneInfo("Asia/Seoul"))` 사용

---

## 미래 계획

- **뉴스데스크 센터**: 뉴스데스크를 독립 프로젝트로 추출. 4단계 AI 에이전트 파이프라인 (크롤링→클러스터링→인사이트→시각화). React Flow 마인드맵. → `docs/NEWSDESK_CENTER_PROPOSAL.md` 참조
- **세션/기수 관리**: 펀드팀 기수 교체 (32기→33기) 관리
- **멀티테넌시**: 여러 대학 펀드팀이 사용할 수 있는 SaaS
- **뉴스데스크 공유 캐시**: 멀티테넌시 환경에서 AI 비용 절감
- → `docs/plans/FUTURE_FEATURES.md` 참조
