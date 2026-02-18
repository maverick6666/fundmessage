# 펀드팀 메신저 (Fund Messenger) - 프로젝트 상세 설명서

> 최종 업데이트: 2026-02-14

---

## 1. 프로젝트 개요

### 1.1 한 줄 요약
대학 펀드팀의 매매 의사결정을 체계적으로 관리하는 웹 애플리케이션.

### 1.2 문제 정의
대학 투자 동아리(펀드팀)는 통상 카카오톡 단톡방에서 매매 관련 소통을 진행한다. 이 방식에는 다음과 같은 구조적 문제가 있다:

- **기록 유실**: 매수/매도 이유, 토론 내용이 채팅 흐름에 묻혀 추적 불가
- **의사결정 추적 불가**: "왜 이 종목을 샀는가"에 대한 체계적 기록이 없음
- **승인 프로세스 부재**: 팀장(펀드매니저) 승인 없이 의견이 난무
- **성과 측정 어려움**: 포지션별 수익률, 팀 전체 자산 추이를 수동으로 계산
- **정보 비대칭**: 팀원마다 시장 정보 접근 수준이 다름

### 1.3 해결 방안
**펀드팀 메신저**는 카카오톡 단톡방을 대체하여 다음을 제공한다:

1. **체계적 요청-승인 플로우**: 팀원이 매수/매도 요청 → 팀장이 승인/거부/토론 개시
2. **포지션 추적**: 매수부터 종료까지 전 과정을 추적하고 수익률 자동 계산
3. **실시간 토론**: WebSocket 기반 종목별 토론 채널
4. **AI 분석**: GPT-5-mini가 의사결정 기록, 운용보고서, 일일 뉴스 브리핑을 자동 생성
5. **팀 관리**: 출석, 팀 칼럼, 통계, 리더보드로 팀 운영을 체계화

### 1.4 대상 사용자
- **팀장(펀드매니저)**: 요청 승인/거부, 실제 거래 체결, 포지션 관리
- **팀원**: 매수/매도 요청 제출, 토론 참여, 칼럼 작성
- **관리자**: 사용자 관리, 팀 설정

---

## 2. 핵심 비즈니스 플로우

### 2.1 매수 플로우
```
팀원: 매수 요청 제출 (종목, 수량/금액, 매수가, 매매계획)
  ↓
팀장: 요청 검토
  ├─ 승인 → 포지션 자동 생성 (미확인 상태)
  │         → 팀장이 실제 체결 내역 확인 후 정보 확인 완료
  ├─ 거부 → 사유 기록, 요청자에게 알림
  └─ 토론 개시 → 실시간 토론 채널 생성
```

### 2.2 매도 플로우
```
팀원: 매도 요청 제출 (포지션, 수량, 매도가, 사유)
  ↓
팀장: 승인 → 포지션에 매도 정보 기록
  ↓
포지션 종료: 팀장이 실제 청산 금액 입력 → 수익률 자동 계산
```

### 2.3 포지션 생명주기
```
요청 승인 → 포지션 생성 (미확인)
  → 팀장 정보 확인 (체결가/수량 수정)
  → 매매계획 수립 (분할 매수 / 익절 / 손절 목표)
  → 계획 체결 기록 (실제 가격/수량)
  → 의사결정 기록 (AI 또는 수동)
  → 포지션 종료 → 수익률/손익 확정
```

### 2.4 뉴스데스크 자동 생성
```
매일 KST 05:30 스케줄러 실행
  → 네이버 뉴스 API (14카테고리 키워드, 어제+오늘새벽)
  → yfinance (8개 해외 티커)
  → 100-150개 원본 뉴스 수집
  → GPT-5-mini AI 분석
  → 칼럼 2개 + 뉴스카드 6개 + 키워드 8-12개 + 감성지표 + 주목종목 3개
  → 사용자는 매일 아침 시장 브리핑을 확인
```

---

## 3. 기술 스택

| 영역 | 기술 | 버전/비고 |
|------|------|-----------|
| **백엔드 프레임워크** | FastAPI | Python 3.11+ |
| **ORM** | SQLAlchemy 2.0 | Alembic 마이그레이션 |
| **데이터베이스** | PostgreSQL | JSON 컬럼 활용 |
| **실시간 통신** | python-socketio | WebSocket |
| **프론트엔드** | React 18 | Vite 빌드 |
| **스타일링** | Tailwind CSS | 다크모드 지원 |
| **상태관리** | Zustand + Context API | 혼합 사용 |
| **차트** | lightweight-charts (TradingView) | 캔들/라인 차트 |
| **인증** | JWT (PyJWT) | Access 60분 + Refresh 30일 |
| **AI** | OpenAI GPT-5-mini | Responses API + verbosity |
| **시세** | 한국투자증권 API, Yahoo Finance, Binance API | 국내/해외/암호화폐 |
| **뉴스** | 네이버 검색 API, yfinance news | 국내/해외 |
| **푸시 알림** | Web Push (VAPID) + PWA | Service Worker |
| **스케줄러** | APScheduler | 뉴스데스크 05:30, 스냅샷 09:00 |
| **배포** | CloudType (백엔드) + Vercel (프론트) | Docker 로컬 개발 |

---

## 4. 시스템 아키텍처

### 4.1 전체 구조
```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)               │
│  ┌──────────┬──────────┬──────────┬──────────┬────────┐ │
│  │ NewsDesk │ Position │ Request  │Discussion│ Stats  │ │
│  │  Page    │  Pages   │  Page    │  Page    │  Page  │ │
│  └────┬─────┴────┬─────┴────┬─────┴────┬─────┴───┬────┘ │
│       │          │          │          │         │       │
│  ┌────▼──────────▼──────────▼──────────▼─────────▼────┐ │
│  │           API Services (axios)                     │ │
│  │    WebSocket Client (socket.io-client)              │ │
│  └────────────────────┬───────────────────────────────┘ │
└───────────────────────┼─────────────────────────────────┘
                        │ HTTPS / WSS
┌───────────────────────▼─────────────────────────────────┐
│                   Backend (FastAPI)                       │
│  ┌─────────────────────────────────────────────────────┐ │
│  │                 API Routers (17개)                   │ │
│  │  auth │ positions │ requests │ discussions │ ...     │ │
│  └──────────────────────┬──────────────────────────────┘ │
│  ┌──────────────────────▼──────────────────────────────┐ │
│  │              Service Layer (11개)                    │ │
│  │  position │ price │ ai │ newsdesk_ai │ crawler │ ...│ │
│  └──────────────────────┬──────────────────────────────┘ │
│  ┌──────────────────────▼──────────────────────────────┐ │
│  │            Models (18개) + PostgreSQL                │ │
│  └─────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────┐ │
│  │    External APIs: OpenAI │ KIS │ yfinance │ Naver   │ │
│  └─────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────┐ │
│  │    Scheduler: 뉴스데스크(05:30) │ 스냅샷(09:00)     │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 4.2 데이터 흐름
```
사용자 요청 → JWT 인증 → API Router → Service Layer → SQLAlchemy ORM → PostgreSQL
                                           ↓
                                     외부 API 호출 (시세/AI/뉴스)
                                           ↓
                                     WebSocket 알림 + Web Push
```

---

## 5. 데이터베이스 모델 (18개 테이블)

### 5.1 핵심 모델

#### User (사용자)
| 필드 | 타입 | 설명 |
|------|------|------|
| email | String(255) | 로그인 이메일 (unique) |
| username | String(50) | 표시 이름 (unique) |
| password_hash | String(255) | bcrypt 해시 |
| full_name | String(100) | 실명 |
| role | String(20) | manager / admin / member / viewer |
| is_active | Boolean | 활성 여부 (팀장 승인 필요) |
| attendance_shields | Integer | 출석 방패 잔여 수 |

#### Position (포지션)
| 필드 | 타입 | 설명 |
|------|------|------|
| ticker | String(20) | 종목코드 (005930, AAPL 등) |
| ticker_name | String(100) | 종목명 |
| market | String(20) | KRX / NASDAQ / NYSE / CRYPTO |
| status | String(20) | open / closed |
| is_info_confirmed | Boolean | 팀장 확인 완료 여부 |
| average_buy_price | Numeric(20,4) | 평균 매입가 |
| total_quantity | Numeric(20,8) | 총 보유 수량 |
| total_buy_amount | Numeric(20,2) | 총 매입 금액 |
| buy_plan | JSON | 분할 매수 계획 |
| take_profit_targets | JSON | 익절 목표 |
| stop_loss_targets | JSON | 손절 목표 |
| profit_loss | Numeric(20,2) | 최종 손익 (종료 시) |
| profit_rate | Numeric(10,4) | 최종 수익률 (종료 시) |
| realized_profit_loss | Numeric(20,2) | 진행 중 실현 손익 누적 |

#### Request (매수/매도 요청)
| 필드 | 타입 | 설명 |
|------|------|------|
| request_type | String(20) | buy / sell |
| status | String(20) | pending / approved / rejected / discussion |
| target_ticker | String(20) | 요청 종목 |
| order_type | String(20) | amount(금액) / quantity(수량) |
| order_amount / order_quantity | Numeric | 주문 금액/수량 |
| buy_price | Numeric(20,4) | 희망 매수가 (null=시장가) |
| executed_price / executed_quantity | Numeric | 실제 체결 내역 |
| rejection_reason | Text | 거부 사유 |

#### Discussion (토론)
| 필드 | 타입 | 설명 |
|------|------|------|
| request_id | FK | 연결된 요청 (nullable) |
| position_id | FK | 연결된 포지션 (nullable) |
| title | String(200) | 토론 제목 |
| status | String(20) | open / closed |
| session_count | Integer | 세션 수 (재개 시 증가) |
| current_agenda | Text | 현재 세션 의제 |

#### Message (채팅 메시지)
| 필드 | 타입 | 설명 |
|------|------|------|
| discussion_id | FK | 소속 토론 |
| content | Text | 메시지 내용 |
| message_type | String(20) | text / system / chart |
| chart_data | JSON | 차트 캔들 데이터 (차트 공유 시) |
| session_number | Integer | 소속 세션 번호 |

### 5.2 AI/뉴스 모델

#### NewsDesk (일일 뉴스 브리핑)
| 필드 | 타입 | 설명 |
|------|------|------|
| publish_date | Date | 발행일 (unique) |
| columns | JSON | AI 칼럼 2개 (국내+해외) |
| news_cards | JSON | 뉴스 카드 6개 (국내3+해외3) |
| keywords | JSON | 키워드 버블 8-12개 (감성 점수 포함) |
| sentiment | JSON | 전체 탐욕/공포 지수 |
| top_stocks | JSON | 주목 종목 3개 (상세 분석) |
| status | String(20) | pending / generating / ready / failed |
| generation_count | Integer | 생성 횟수 |

#### RawNews (수집 원본 뉴스)
| 필드 | 타입 | 설명 |
|------|------|------|
| source | String(50) | naver / yfinance |
| title | String(500) | 기사 제목 |
| description | Text | 요약 |
| link | String(1000) | 원문 URL |
| newsdesk_date | Date | 귀속 뉴스데스크 날짜 |

#### DecisionNote (의사결정 기록)
| 필드 | 타입 | 설명 |
|------|------|------|
| position_id | FK | 연결 포지션 |
| blocks | JSON | Editor.js 블록 에디터 데이터 |
| note_type | String(20) | decision(의사결정서) / report(운용보고서) |

### 5.3 팀 관리 모델

#### TeamSettings (팀 설정)
- initial_capital_krw/usd: 초기 자본금
- exchange_history: 환전 이력 (JSON)
- ai_daily_limit / ai_usage_count: AI 일일 사용 제한

#### Attendance (출석)
- user_id + date (unique): 일별 출석 기록
- status: present / absent / recovered
- 칼럼 검증 시 출석 회복 또는 방패 적립

#### TeamColumn (팀 칼럼)
- blocks: Editor.js 블록 형식
- is_verified: 팀장 검증 여부 (파란 체크)
- 검증 시 → 출석 회복 또는 방패 적립

#### AssetSnapshot (자산 스냅샷)
- 매일 09:00 KST 자동 생성
- KRW/USD/USDT 현금 + 평가액
- realized_pnl / unrealized_pnl
- position_details: 포지션별 상세 (JSON)

### 5.4 기타 모델
- **TradingPlan**: 매매계획 버전 히스토리 + 체결 기록
- **PriceAlert**: 목표가 도달 알림
- **Notification**: 인앱 알림 (요청 승인/거부/토론 등)
- **PushSubscription**: Web Push 구독 (VAPID)
- **AuditLog**: 포지션/계획 변경 이력
- **Comment**: 문서별 댓글 (의사결정서/칼럼/뉴스)

---

## 6. API 엔드포인트 (100+개)

### 6.1 인증 (`/api/v1/auth`)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | /signup | 회원가입 (첫 유저 = 팀장) |
| POST | /login | 로그인 + 자동 출석 |
| POST | /refresh | Access Token 갱신 |
| POST | /send-verification | 이메일 인증 코드 발송 |
| POST | /verify-code | 이메일 인증 코드 확인 |

### 6.2 포지션 (`/api/v1/positions`)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | / | 포지션 목록 (페이징, 필터) |
| GET | /{id} | 포지션 상세 |
| PATCH | /{id} | 포지션 수정 (팀장) |
| POST | /{id}/confirm | 정보 확인 (팀장) |
| POST | /{id}/close | 포지션 종료 (팀장) |
| POST | /{id}/toggle-plan | 매매계획 항목 체결 토글 (팀장) |
| PATCH | /{id}/plans | 매매계획 수정 (전원) |
| GET | /settings/team | 팀 설정 조회 |
| PUT | /settings/team | 팀 설정 수정 (팀장) |
| POST | /settings/team/exchange | 환전 (팀장) |

### 6.3 요청 (`/api/v1/requests`)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | /buy | 매수 요청 |
| POST | /sell | 매도 요청 |
| GET | / | 요청 목록 |
| POST | /{id}/approve | 승인 (팀장) |
| POST | /{id}/reject | 거부 (팀장) |
| POST | /{id}/discuss | 토론 개시 (팀장) |

### 6.4 토론 (`/api/v1/discussions`)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | / | 토론 목록 |
| POST | / | 토론 생성 (팀장) |
| GET | /{id}/messages | 메시지 조회 |
| POST | /{id}/messages | 메시지 전송 (WebSocket 브로드캐스트) |
| POST | /{id}/close | 토론 종료 + 요약 (팀장) |
| POST | /{id}/reopen | 토론 재개 (팀장) |
| GET | /{id}/export-txt | 세션별 텍스트 내보내기 |

### 6.5 시세 (`/api/v1/prices`)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /search | 종목 검색 |
| GET | /quote | 현재가 조회 |
| GET | /candles | 캔들 차트 데이터 |
| GET | /positions | 포지션 + 실시간 시세 |

### 6.6 AI (`/api/v1/ai`)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /status | AI 사용 가능 여부 + 잔여 횟수 |
| POST | /generate-decision-note | 토론 기반 의사결정서 AI 생성 |
| POST | /generate-operation-report | 포지션 기반 운용보고서 AI 생성 |

### 6.7 뉴스데스크 (`/api/v1/newsdesk`)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /today | 오늘의 뉴스데스크 |
| GET | /{date} | 특정 날짜 뉴스데스크 |
| GET | /history | 최근 N일 이력 |
| GET | /benchmarks | 벤치마크 차트 데이터 |

### 6.8 기타
- **통계** (`/stats`): 팀/개인 통계, 자산 히스토리, 스냅샷
- **알림** (`/notifications`): 조회, 읽음 처리, Web Push 구독
- **출석** (`/attendance`): 체크인, 회복 요청, 승인
- **칼럼** (`/columns`): CRUD, 팀장 검증
- **보고서** (`/reports`): 의사결정서/운용보고서 목록
- **댓글** (`/comments`): 문서별 댓글 CRUD
- **업로드** (`/uploads`): 이미지 업로드
- **WebSocket** (`/ws`): 실시간 토론 메시지

---

## 7. 프론트엔드 페이지 (12개)

### 7.1 뉴스데스크 (`/` - 메인 페이지)
- **일일 시장 브리핑 대시보드** (1,691줄)
- 미니 달력으로 날짜 선택 (7일 범위)
- 벤치마크 차트 (KOSPI, NASDAQ, S&P500, 팀 펀드 비교)
- 키워드 감성 버블 (탐욕/공포 색상 그라디언트)
- AI 칼럼 2개 (국내/해외 심층 분석)
- 뉴스 카드 6개 (마크다운 렌더링)
- 주목 종목 3개 (상세 분석)
- 댓글 기능

### 7.2 대시보드 (`/dashboard`)
- 팀 자산 현황 (KRW/USD/총자산)
- 최근 요청/포지션
- 팀원 목록 + 역할
- 공지사항

### 7.3 포지션 목록 (`/positions`)
- 보유/종료 포지션 필터
- 미확인 포지션 표시 (노란 느낌표)
- 수익률/손익 표시
- 정렬/검색

### 7.4 포지션 상세 (`/positions/:id`)
- 캔들 차트 (TradingView lightweight-charts)
- 매매계획 (분할 매수/익절/손절 목표 + 진행률 바)
- 의사결정서/운용보고서 탭
- 토론 이력
- 감사 로그

### 7.5 요청 목록 (`/requests`)
- 상태별 필터 (대기/승인/거부/토론중)
- 매수/매도 요청 카드

### 7.6 토론 목록/상세 (`/discussions`, `/discussions/:id`)
- 실시간 채팅 (WebSocket)
- 세션 구분 (재개 시 새 세션)
- 차트 공유 기능
- 사이드 패널 뷰어

### 7.7 통계 (`/stats`)
- 3탭 차트 (총 자산 / 실현손익 / 미실현손익)
- 날짜 클릭 → 스냅샷 상세
- 수익률, 승률, 거래 수
- 팀 랭킹 (출석률 + 수익률)

### 7.8 보고서 (`/reports`)
- 포지션별 의사결정서/운용보고서 목록
- 블록 에디터 뷰어

### 7.9 기타 페이지
- **팀 관리** (`/team`): 팀장/관리자 전용, 유저 승인/역할 변경
- **알림** (`/notifications`): 알림 목록, 읽음 처리
- **설정** (`/settings`): 푸시 알림 구독/해제
- **칼럼 에디터** (`/columns/new`, `/columns/:id/edit`): 블록 에디터

---

## 8. AI 시스템

### 8.1 뉴스데스크 AI
- **모델**: GPT-5-mini (Responses API + verbosity=high)
- **입력**: 100-150개 원본 뉴스 (네이버+yfinance)
- **출력**: 구조화된 JSON (칼럼/뉴스카드/키워드/감성/주목종목)
- **프롬프트**: 200줄+ 시스템 프롬프트, XML 구조 (`<ROLE>`, `<COLUMN_SPEC>` 등)
- **품질 관리**: QUALITY_CHECKLIST, 중복 방지 (어제 제목 조회), 참고 예시 포함
- **Fallback**: Responses API 실패 시 Chat Completions API로 전환
- **JSON 추출**: 3단계 (직접 파싱 → 코드블록 추출 → 중괄호 추출)
- **최적화 이력**: 5회 이터레이션 (Iter 0~4), 칼럼 67%→83%, 카드 71%→82%

### 8.2 의사결정서 AI
- **입력**: 토론 세션 메시지 + 포지션 정보 + 매매계획
- **출력**: Editor.js 호환 블록 형식
- **설정**: verbosity=medium, max_tokens=16384

### 8.3 운용보고서 AI
- **입력**: 포지션 전체 데이터 (요청, 계획, 체결, 토론, 기존 노트)
- **출력**: 종합 분석 보고서
- **설정**: verbosity=high, max_tokens=16384
- **핵심 원칙**: 데이터 전처리 > 프롬프트 지시 (KST 변환, 가격 포맷, 보유기간 계산을 코드에서 처리)

### 8.4 AI 사용 제한
- 팀 전체 일일 3회 (의사결정서 + 운용보고서 합산)
- 뉴스데스크는 스케줄러 자동 생성 (제한 미적용)

---

## 9. 시세 시스템

### 9.1 데이터 소스
| 시장 | 소스 | 데이터 |
|------|------|--------|
| 국내 (KOSPI/KOSDAQ) | 한국투자증권 API | 현재가, 캔들 |
| 해외 (NASDAQ/NYSE) | Yahoo Finance | 현재가, 캔들, 뉴스 |
| 암호화폐 | Binance API | 현재가, 캔들 |

### 9.2 시세 활용
- 포지션 목록에서 실시간 평가금액/수익률 표시
- 캔들 차트 (1h/1d/1w/1M 타임프레임)
- 자산 스냅샷 생성 시 평가금액 계산
- 벤치마크 차트 (KOSPI/NASDAQ/S&P500 지수)

---

## 10. 알림 시스템

### 10.1 알림 유형 (9종)
| 유형 | 트리거 | 수신자 |
|------|--------|--------|
| request_submitted | 매수/매도 요청 제출 | 팀장 |
| request_approved | 요청 승인 | 요청자 |
| request_rejected | 요청 거부 | 요청자 |
| discussion_opened | 토론 시작 | 전체 팀원 |
| discussion_message | 토론 메시지 | 토론 참여자 |
| discussion_closed | 토론 종료 | 토론 참여자 |
| discussion_requested | 토론 요청 (팀원→팀장) | 팀장 |
| position_discussion_requested | 포지션 토론 요청 | 팀장 |
| early_close_requested | 조기 청산 요청 | 팀장 |

### 10.2 전달 경로
- **인앱 알림**: Notification DB 저장 + WebSocket 실시간 전달
- **Web Push**: PWA 앱 아이콘 뱃지 + 시스템 알림 (백그라운드 지원)

---

## 11. PWA (Progressive Web App)

- **manifest.json**: standalone 모드, 테마 색상, 앱 아이콘
- **Service Worker**: push 이벤트 처리, notificationclick 네비게이션
- **Web Push**: VAPID 키 기반, pywebpush 서버 발송
- **App Badge**: navigator.setAppBadge()로 읽지 않은 알림 수 표시
- **홈 화면 추가**: 네이티브 앱처럼 사용 가능

---

## 12. 출석 시스템

### 12.1 플로우
1. 로그인 시 자동 출석 체크인 (KST 기준)
2. 전날 미출석 시 방패 자동 사용 (방패 잔여 시)
3. 미출석일은 `absent`로 기록

### 12.2 출석 회복
1. 팀원이 **팀 칼럼** 작성
2. 팀장이 칼럼 **검증** (파란 체크)
3. 검증 시:
   - 미출석일이 있으면 → 가장 최근 미출석일 **회복**
   - 미출석일이 없으면 → 방패 +1 **적립**

### 12.3 통계
- 주간/월간/전체 출석률
- 연속 출석 기록 (streak)
- 방패 잔여 수

---

## 13. 배포 환경

### 13.1 프로덕션
- **Backend**: CloudType (Docker, Dockerfile CMD로 Alembic 자동 실행)
- **Frontend**: Vercel (git push 시 자동 배포)
- **Database**: CloudType PostgreSQL

### 13.2 로컬 개발
```bash
docker-compose up -d --build
# Frontend: localhost:80 (nginx)
# Backend: localhost:8000 (FastAPI)
# DB: localhost:5432 (PostgreSQL)
```

### 13.3 환경변수
| 변수 | 용도 |
|------|------|
| DATABASE_URL | PostgreSQL 연결 |
| SECRET_KEY | JWT 서명 |
| OPENAI_API_KEY | AI 서비스 |
| NAVER_CLIENT_ID/SECRET | 네이버 뉴스 API |
| KIS_APP_KEY/SECRET | 한국투자증권 API |
| SMTP_HOST/USER/PASSWORD | 이메일 인증 |
| VAPID_PUBLIC_KEY/PRIVATE_KEY | Web Push |

---

## 14. 프로젝트 파일 구조

```
fundmessage/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI 앱, WebSocket, 시작 이벤트
│   │   ├── config.py            # 환경 설정
│   │   ├── database.py          # SQLAlchemy 엔진/세션
│   │   ├── dependencies.py      # 인증 의존성
│   │   ├── models/              # ORM 모델 18개
│   │   ├── schemas/             # Pydantic 스키마
│   │   ├── api/                 # REST API 라우터 17개
│   │   ├── services/            # 비즈니스 로직 11개
│   │   ├── websocket/           # WebSocket 매니저
│   │   └── utils/               # JWT, 암호화
│   ├── alembic/                 # DB 마이그레이션
│   ├── seed_data/               # 초기 데이터 (뉴스데스크)
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/               # 페이지 컴포넌트 12개
│   │   ├── components/          # 공통/레이아웃/폼/차트 컴포넌트
│   │   ├── context/             # Auth, WebSocket, Toast, Theme
│   │   ├── services/            # API 클라이언트 20개
│   │   ├── stores/              # Zustand (layout, sidePanel)
│   │   ├── hooks/               # useAuth, useWebSocket, usePositions
│   │   └── utils/               # 포맷팅 유틸
│   ├── public/                  # PWA 에셋 (manifest, sw.js, icons)
│   └── index.html
├── docker-compose.yml
├── docs/                        # 프로젝트 문서
└── memory/                      # AI 세션 메모리
```

---

## 15. 사용자 역할 및 권한

| 기능 | 팀장(manager) | 관리자(admin) | 팀원(member) | 뷰어(viewer) |
|------|:---:|:---:|:---:|:---:|
| 매수/매도 요청 제출 | O | O | O | X |
| 요청 승인/거부 | O | X | X | X |
| 토론 시작/종료 | O | O | X | X |
| 메시지 전송 | O | O | O | X |
| 포지션 정보 확인 | O | X | X | X |
| 포지션 종료 | O | O | X | X |
| 매매계획 체결 기록 | O | X | X | X |
| AI 문서 생성 | O | O | X | X |
| 팀원 승인/관리 | O | O | X | X |
| 역할 변경 | O | X | X | X |
| 팀 설정 수정 | O | X | X | X |
| 칼럼 검증 | O | O | X | X |
| 출석 회복 승인 | O | X | X | X |
| 칼럼 작성 | O | O | O | X |
| 데이터 조회 | O | O | O | O |

---

## 16. 구현 완료 기능 요약

- [x] JWT 인증 + 이메일 인증 + Refresh Token 회전
- [x] 매수/매도 요청-승인 플로우
- [x] 포지션 CRUD + 정보 확인 + 종료 + 수익률 계산
- [x] 분할 매수/익절/손절 매매계획 + 체결 기록
- [x] WebSocket 실시간 토론 (다중 세션, 차트 공유)
- [x] AI 의사결정서/운용보고서 자동 생성 (GPT-5-mini)
- [x] 뉴스데스크 (자동 크롤링 + AI 분석 + 감성 버블)
- [x] 벤치마크 차트 (KOSPI/NASDAQ/S&P500/팀펀드 비교)
- [x] 캔들 차트 (한투/yfinance/Binance)
- [x] 출석 시스템 (자동 체크인, 방패, 칼럼 검증 회복)
- [x] 팀 칼럼 (블록 에디터, 검증, 댓글)
- [x] 자산 스냅샷 (일일 자동, 실시간 시세 기반)
- [x] 통계 (3탭 차트, 팀 랭킹, 스냅샷 상세)
- [x] 알림 (인앱 + Web Push + PWA 뱃지)
- [x] 다크모드
- [x] 모바일 반응형 (사이드뷰어 풀스크린 등)
- [x] 감사 로그 (포지션/계획 변경 이력)
