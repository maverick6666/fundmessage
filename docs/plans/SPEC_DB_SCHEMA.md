# 펀드메신저 DB 스키마 명세서
> Spring Boot 리팩토링 참조 문서 | 작성일: 2026-02-18
> 원본: FastAPI + SQLAlchemy (Python 3.14) | 대상: Spring Boot + JPA/Hibernate

---

## Part 1: 현재 구현된 스키마

### 1.1 테이블 목록 요약표

| # | 테이블명 | 설명 | 행 수 추정 | 주요 FK |
|---|---------|------|-----------|---------|
| 1 | `users` | 사용자 (팀원/팀장/관리자/뷰어) | 10~30 | - |
| 2 | `positions` | 보유 포지션 (매매 종목) | 50~200 | `users.id` x2 |
| 3 | `requests` | 매수/매도 요청 | 200~1000 | `positions.id`, `users.id` x2 |
| 4 | `discussions` | 토론 스레드 | 50~300 | `requests.id`, `positions.id`, `users.id` x2 |
| 5 | `messages` | 토론 메시지 | 500~5000 | `discussions.id`, `users.id` |
| 6 | `price_alerts` | 가격 알림 (익절/손절) | 100~500 | `positions.id` |
| 7 | `email_verifications` | 이메일 인증 코드 | 50~200 | - |
| 8 | `team_settings` | 팀 설정 (자본금, AI 사용량) | 1 | - |
| 9 | `audit_logs` | 수정 이력 로그 | 1000~10000 | `users.id` |
| 10 | `notifications` | 알림 | 500~5000 | `users.id` |
| 11 | `decision_notes` | 의사결정 노트 / 운용보고서 | 50~300 | `positions.id`, `users.id` |
| 12 | `team_columns` | 팀 칼럼 (자유 작성 글) | 50~200 | `users.id` x2 |
| 13 | `attendances` | 출석 기록 | 300~3000 | `users.id` x2, `team_columns.id` |
| 14 | `trading_plans` | 매매계획 이력 + 체결 기록 | 200~2000 | `positions.id`, `users.id` |
| 15 | `news_desks` | 일별 뉴스데스크 AI 콘텐츠 | 30~365 | - |
| 16 | `raw_news` | 수집된 원본 뉴스 | 1000~10000 | - |
| 17 | `asset_snapshots` | 일별 자산 스냅샷 | 30~365 | - |
| 18 | `comments` | 문서 댓글 (다형성) | 100~1000 | `users.id` |
| 19 | `push_subscriptions` | Web Push 구독 정보 | 10~50 | `users.id` |

> **참고**: `push_subscriptions`는 `__init__.py`에 미등록 상태 (모델은 존재)

---

### 1.2 Enum 정의

| # | Enum 이름 | 값 목록 | 사용처 | 비고 |
|---|----------|---------|--------|------|
| 1 | `UserRole` | `manager`, `admin`, `member`, `viewer` | `users.role` | `str, enum.Enum` 상속. DB에는 String(20)으로 저장 |
| 2 | `PositionStatus` | `open`, `closed` | `positions.status` | String(20) 저장 |
| 3 | `RequestType` | `buy`, `sell` | `requests.request_type` | String(20) 저장 |
| 4 | `RequestStatus` | `pending`, `approved`, `rejected`, `discussion` | `requests.status` | String(20) 저장. 상태머신: PENDING -> DISCUSSION -> APPROVED/REJECTED |
| 5 | `DiscussionStatus` | `open`, `closed` | `discussions.status` | String(20) 저장 |
| 6 | `MessageType` | `text`, `system`, `chart` | `messages.message_type` | String(20) 저장. `chart`는 차트 캔들 데이터 공유용 |
| 7 | `AlertType` | `take_profit`, `stop_loss` | `price_alerts.alert_type` | String(20) 저장 |

> **Spring Boot 참고**: 모든 Enum이 DB에는 문자열로 저장됨. JPA `@Enumerated(EnumType.STRING)` 사용 권장.

---

### 1.3 각 테이블 상세

---

#### 1.3.1 `users` - 사용자

**목적**: 팀원 계정 관리. 역할 기반 접근 제어 (RBAC).

| 컬럼명 | 타입 | Nullable | Default | 비고 |
|--------|------|----------|---------|------|
| `id` | `Integer` | NO | auto | PK, indexed |
| `email` | `String(255)` | NO | - | UNIQUE, indexed |
| `username` | `String(50)` | NO | - | UNIQUE |
| `password_hash` | `String(255)` | NO | - | bcrypt 해시 |
| `full_name` | `String(100)` | NO | - | 실명 |
| `role` | `String(20)` | NO | `'member'` | UserRole enum 값 |
| `is_active` | `Boolean` | YES | `true` | 계정 활성 여부 |
| `attendance_shields` | `Integer` | NO | `0` | 출석 방패 (칼럼 검증 시 적립, 미출석 시 소모) |
| `created_at` | `DateTime(tz)` | YES | `func.now()` | server_default |
| `updated_at` | `DateTime(tz)` | YES | `func.now()` | server_default + onupdate |

**제약조건**:
- PK: `id`
- UNIQUE: `email`, `username`
- INDEX: `id`, `email`

**관계**:
- `users` 1:N `requests` (requester_id)
- `users` 1:N `requests` (approved_by)
- `users` 1:N `positions` (opened_by)
- `users` 1:N `positions` (closed_by)
- `users` 1:N `messages` (user_id)
- `users` 1:N `discussions` (opened_by)
- `users` 1:N `discussions` (closed_by)
- `users` 1:N `notifications` (user_id)
- `users` 1:N `decision_notes` (created_by)
- `users` 1:N `team_columns` (author_id)
- `users` 1:N `attendances` (user_id)
- `users` 1:N `trading_plans` (user_id)
- `users` 1:N `comments` (user_id)
- `users` 1:N `push_subscriptions` (user_id) [cascade: all, delete-orphan]
- `users` 1:N `audit_logs` (user_id) [backref 방식]

**비즈니스 로직 메서드**:
- `is_manager_or_admin()` -> role이 manager 또는 admin인지 확인

---

#### 1.3.2 `positions` - 보유 포지션

**목적**: 팀의 매매 종목 추적. 매수/매도 정보, 수익률, 분할매매 계획 관리.

| 컬럼명 | 타입 | Nullable | Default | 비고 |
|--------|------|----------|---------|------|
| `id` | `Integer` | NO | auto | PK, indexed |
| `ticker` | `String(20)` | NO | - | 종목 코드, indexed |
| `ticker_name` | `String(100)` | YES | - | 종목명 |
| `market` | `String(20)` | NO | - | 'KRX', 'BINANCE' 등 |
| `status` | `String(20)` | NO | `'open'` | PositionStatus enum |
| `is_info_confirmed` | `Boolean` | YES | `false` | 팀장 정보 확인 완료 여부 |
| `average_buy_price` | `Numeric(20,4)` | YES | - | 평균 매수가 |
| `total_quantity` | `Numeric(20,8)` | YES | `0` | 총 보유 수량 |
| `total_buy_amount` | `Numeric(20,2)` | YES | `0` | 총 매수 금액 |
| `buy_plan` | `JSON` | YES | - | 분할매수 계획 `[{price, quantity, completed}]` |
| `take_profit_targets` | `JSON` | YES | - | 익절 목표 `[{price, ratio, completed}]` |
| `stop_loss_targets` | `JSON` | YES | - | 손절 목표 `[{price, ratio, completed}]` |
| `average_sell_price` | `Numeric(20,4)` | YES | - | 평균 매도가 |
| `total_sell_amount` | `Numeric(20,2)` | YES | - | 총 매도 금액 |
| `profit_loss` | `Numeric(20,2)` | YES | - | 최종 손익 (종료 시) |
| `profit_rate` | `Numeric(10,4)` | YES | - | 최종 수익률 (종료 시) |
| `holding_period_hours` | `Integer` | YES | - | 보유 기간 (시간) |
| `realized_profit_loss` | `Numeric(20,2)` | YES | `0` | 실현손익 (진행 중 체결 누적) |
| `opened_at` | `DateTime(tz)` | YES | - | 포지션 오픈 시각 |
| `closed_at` | `DateTime(tz)` | YES | - | 포지션 종료 시각 |
| `opened_by` | `Integer` | YES | - | FK -> users.id |
| `closed_by` | `Integer` | YES | - | FK -> users.id |
| `created_at` | `DateTime(tz)` | YES | `func.now()` | server_default |
| `updated_at` | `DateTime(tz)` | YES | `func.now()` | server_default + onupdate |

**제약조건**:
- PK: `id`
- FK: `opened_by` -> `users.id`, `closed_by` -> `users.id`
- INDEX: `id`, `ticker`

**관계**:
- `positions` N:1 `users` (opener - opened_by)
- `positions` N:1 `users` (closer - closed_by)
- `positions` 1:N `requests`
- `positions` 1:N `price_alerts`
- `positions` 1:N `discussions`
- `positions` 1:N `decision_notes` (order_by: created_at DESC)
- `positions` 1:N `trading_plans` (order_by: created_at DESC)

**JSON 필드 상세**:
```json
// buy_plan
[{"price": 50000, "quantity": 10, "completed": true}, ...]

// take_profit_targets / stop_loss_targets
[{"price": 55000, "ratio": 0.5, "completed": false}, ...]
```

---

#### 1.3.3 `requests` - 매수/매도 요청

**목적**: 팀원이 매수/매도 요청을 제출하고, 팀장이 승인/거절/토론 전환하는 워크플로우.

| 컬럼명 | 타입 | Nullable | Default | 비고 |
|--------|------|----------|---------|------|
| `id` | `Integer` | NO | auto | PK, indexed |
| `position_id` | `Integer` | YES | - | FK -> positions.id (CASCADE) |
| `requester_id` | `Integer` | YES | - | FK -> users.id |
| `request_type` | `String(20)` | NO | - | RequestType: 'buy' / 'sell' |
| `target_ticker` | `String(20)` | YES | - | 매수 종목 코드 |
| `ticker_name` | `String(100)` | YES | - | 종목명 |
| `target_market` | `String(20)` | YES | - | KOSPI/KOSDAQ/NASDAQ/NYSE/CRYPTO |
| `order_type` | `String(20)` | YES | - | 'amount' 또는 'quantity' |
| `order_amount` | `Numeric(20,4)` | YES | - | 매수 금액 |
| `order_quantity` | `Numeric(20,8)` | YES | - | 매수 수량 |
| `buy_price` | `Numeric(20,4)` | YES | - | 매수 희망가 (null=시장가) |
| `buy_orders` | `JSON` | YES | - | legacy: `[{price, ratio}]` |
| `target_ratio` | `Numeric(5,4)` | YES | - | legacy: 포트폴리오 비율 |
| `take_profit_targets` | `JSON` | YES | - | 익절 목표 |
| `stop_loss_targets` | `JSON` | YES | - | 손절 목표 |
| `memo` | `Text` | YES | - | 메모 |
| `sell_quantity` | `Numeric(20,8)` | YES | - | 매도 수량 |
| `sell_price` | `Numeric(20,4)` | YES | - | 매도 가격 |
| `sell_reason` | `Text` | YES | - | 매도 사유 |
| `status` | `String(20)` | NO | `'pending'` | RequestStatus enum, indexed |
| `approved_by` | `Integer` | YES | - | FK -> users.id |
| `approved_at` | `DateTime(tz)` | YES | - | 승인/거절 시각 |
| `rejection_reason` | `Text` | YES | - | 거절 사유 |
| `executed_price` | `Numeric(20,4)` | YES | - | 실제 체결 가격 |
| `executed_quantity` | `Numeric(20,8)` | YES | - | 실제 체결 수량 |
| `executed_at` | `DateTime(tz)` | YES | - | 체결 시각 |
| `created_at` | `DateTime(tz)` | YES | `func.now()` | server_default |
| `updated_at` | `DateTime(tz)` | YES | `func.now()` | server_default + onupdate |

**제약조건**:
- PK: `id`
- FK: `position_id` -> `positions.id` (ON DELETE CASCADE), `requester_id` -> `users.id`, `approved_by` -> `users.id`
- INDEX: `id`, `status`

**관계**:
- `requests` N:1 `positions`
- `requests` N:1 `users` (requester - requester_id)
- `requests` N:1 `users` (approver - approved_by)
- `requests` 1:N `discussions`

**상태머신**:
```
PENDING ──┬──> APPROVED (팀장 승인)
          ├──> REJECTED (팀장 거절)
          └──> DISCUSSION (토론 전환) ──┬──> APPROVED
                                       └──> REJECTED
```

---

#### 1.3.4 `discussions` - 토론 스레드

**목적**: 매매 요청에 대한 팀 토론. 세션 단위로 운영되며, 의제와 참가자별 요약 관리.

| 컬럼명 | 타입 | Nullable | Default | 비고 |
|--------|------|----------|---------|------|
| `id` | `Integer` | NO | auto | PK, indexed |
| `request_id` | `Integer` | YES | - | FK -> requests.id (CASCADE) |
| `position_id` | `Integer` | YES | - | FK -> positions.id (CASCADE) |
| `title` | `String(200)` | NO | - | 토론 제목 |
| `status` | `String(20)` | NO | `'open'` | DiscussionStatus, indexed |
| `session_count` | `Integer` | YES | `1` | 세션 수 |
| `current_agenda` | `Text` | YES | - | 현재 세션 의제 |
| `summary` | `Text` | YES | - | 토론 요약 |
| `summary_by_participant` | `JSON` | YES | - | `{user_id: "summary"}` |
| `opened_by` | `Integer` | YES | - | FK -> users.id |
| `closed_by` | `Integer` | YES | - | FK -> users.id |
| `opened_at` | `DateTime(tz)` | YES | `func.now()` | server_default |
| `closed_at` | `DateTime(tz)` | YES | - | 종료 시각 |
| `created_at` | `DateTime(tz)` | YES | `func.now()` | server_default |
| `updated_at` | `DateTime(tz)` | YES | `func.now()` | server_default + onupdate |

**제약조건**:
- PK: `id`
- FK: `request_id` -> `requests.id` (CASCADE), `position_id` -> `positions.id` (CASCADE), `opened_by` -> `users.id`, `closed_by` -> `users.id`
- INDEX: `id`, `status`

**관계**:
- `discussions` N:1 `requests`
- `discussions` N:1 `positions`
- `discussions` N:1 `users` (opener - opened_by)
- `discussions` N:1 `users` (closer - closed_by)
- `discussions` 1:N `messages` (order_by: created_at ASC)

---

#### 1.3.5 `messages` - 토론 메시지

**목적**: 토론 내 개별 메시지. 텍스트, 시스템 메시지, 차트 공유 지원.

| 컬럼명 | 타입 | Nullable | Default | 비고 |
|--------|------|----------|---------|------|
| `id` | `Integer` | NO | auto | PK, indexed |
| `discussion_id` | `Integer` | NO | - | FK -> discussions.id (CASCADE), indexed |
| `user_id` | `Integer` | YES | - | FK -> users.id (system 메시지는 null) |
| `content` | `Text` | NO | - | 메시지 본문 |
| `message_type` | `String(20)` | YES | `'text'` | MessageType enum |
| `chart_data` | `JSON` | YES | - | 차트 캔들 데이터 (type='chart' 시) |
| `session_number` | `Integer` | YES | `1` | 소속 세션 번호 |
| `created_at` | `DateTime(tz)` | YES | `func.now()` | server_default, indexed |

**제약조건**:
- PK: `id`
- FK: `discussion_id` -> `discussions.id` (CASCADE), `user_id` -> `users.id`
- INDEX: `id`, `discussion_id`, `created_at`

**관계**:
- `messages` N:1 `discussions`
- `messages` N:1 `users`

---

#### 1.3.6 `price_alerts` - 가격 알림

**목적**: 포지션의 익절/손절 목표 가격 도달 시 발생하는 알림 기록.

| 컬럼명 | 타입 | Nullable | Default | 비고 |
|--------|------|----------|---------|------|
| `id` | `Integer` | NO | auto | PK, indexed |
| `position_id` | `Integer` | NO | - | FK -> positions.id (CASCADE), indexed |
| `alert_type` | `String(20)` | NO | - | AlertType: 'take_profit' / 'stop_loss' |
| `target_price` | `Numeric(20,4)` | NO | - | 목표 가격 |
| `current_price` | `Numeric(20,4)` | NO | - | 트리거 당시 현재가 |
| `notified_users` | `JSON` | YES | - | `[user_id, ...]` |
| `is_read` | `Boolean` | YES | `false` | 읽음 여부, indexed |
| `created_at` | `DateTime(tz)` | YES | `func.now()` | server_default |

**제약조건**:
- PK: `id`
- FK: `position_id` -> `positions.id` (CASCADE)
- INDEX: `id`, `position_id`, `is_read`

**관계**:
- `price_alerts` N:1 `positions`

---

#### 1.3.7 `email_verifications` - 이메일 인증

**목적**: 회원가입 시 이메일 인증 코드 관리. 6자리 코드, 만료 시간 포함.

| 컬럼명 | 타입 | Nullable | Default | 비고 |
|--------|------|----------|---------|------|
| `id` | `Integer` | NO | auto | PK, indexed |
| `email` | `String(255)` | NO | - | 인증 대상 이메일, indexed |
| `code` | `String(6)` | NO | - | 6자리 인증 코드 |
| `is_verified` | `Boolean` | YES | `false` | 인증 완료 여부 |
| `expires_at` | `DateTime(tz)` | NO | - | 만료 시각 |
| `created_at` | `DateTime(tz)` | YES | `func.now()` | server_default |

**제약조건**:
- PK: `id`
- INDEX: `id`, `email`

**관계**: 없음 (독립 테이블)

**비즈니스 로직 메서드**:
- `is_expired()` -> 현재 시간이 expires_at을 초과했는지 확인

---

#### 1.3.8 `team_settings` - 팀 설정

**목적**: 팀 전체 설정. 초기 자본금(KRW/USD), 환전 이력, AI 일일 사용량 관리. 싱글톤 패턴 (1행).

| 컬럼명 | 타입 | Nullable | Default | 비고 |
|--------|------|----------|---------|------|
| `id` | `Integer` | NO | auto | PK, indexed |
| `initial_capital_krw` | `Numeric(20,0)` | YES | `0` | 원화 초기 자본금 |
| `initial_capital_usd` | `Numeric(20,2)` | YES | `0` | 달러 초기 자본금 |
| `exchange_history` | `JSON` | YES | `[]` | 환전 이력 배열 |
| `ai_daily_limit` | `Integer` | YES | `3` | AI 일일 사용 제한 |
| `ai_usage_count` | `Integer` | YES | `0` | 오늘 사용량 |
| `ai_usage_reset_date` | `Date` | YES | - | 마지막 리셋 날짜 |
| `description` | `Text` | YES | - | 설명/메모 |
| `created_at` | `DateTime(tz)` | YES | `func.now()` | server_default |
| `updated_at` | `DateTime(tz)` | YES | `func.now()` | server_default + onupdate |

**제약조건**:
- PK: `id`

**관계**: 없음 (독립 테이블)

**JSON 필드 상세**:
```json
// exchange_history
[{
  "from_currency": "KRW",
  "to_currency": "USD",
  "from_amount": 1300000,
  "to_amount": 1000,
  "exchange_rate": 1300,
  "memo": "...",
  "user_id": 1,
  "user_name": "홍길동"
}, ...]
```

---

#### 1.3.9 `audit_logs` - 수정 이력 로그

**목적**: 엔티티(포지션, 요청, 토론 등) 변경 추적. 감사 로그.

| 컬럼명 | 타입 | Nullable | Default | 비고 |
|--------|------|----------|---------|------|
| `id` | `Integer` | NO | auto | PK, indexed |
| `entity_type` | `String(50)` | NO | - | 'position', 'request', 'discussion' 등 |
| `entity_id` | `Integer` | NO | - | 대상 엔티티 ID, indexed |
| `action` | `Text` | NO | - | 'create', 'update', 'delete', 'toggle' 등 |
| `field_name` | `String(100)` | YES | - | 변경된 필드명 |
| `old_value` | `Text` | YES | - | 이전 값 |
| `new_value` | `Text` | YES | - | 새 값 |
| `changes` | `JSON` | YES | - | 여러 필드 변경 시 `{field: {old, new}}` |
| `user_id` | `Integer` | NO | - | FK -> users.id (수행자) |
| `created_at` | `DateTime(tz)` | YES | `func.now()` | server_default |

**제약조건**:
- PK: `id`
- FK: `user_id` -> `users.id`
- INDEX: `id`, `entity_id`

**관계**:
- `audit_logs` N:1 `users` (**backref 방식** - 다른 모델들은 back_populates 사용)

> **Spring Boot 주의**: 이 테이블만 backref를 사용함. JPA에서는 `@ManyToOne` + `@JoinColumn`으로 일관되게 매핑.

---

#### 1.3.10 `notifications` - 알림

**목적**: 사용자별 인앱 알림. 요청 승인/거절, 토론 오픈, 가격 알림 등.

| 컬럼명 | 타입 | Nullable | Default | 비고 |
|--------|------|----------|---------|------|
| `id` | `Integer` | NO | auto | PK, indexed |
| `user_id` | `Integer` | NO | - | FK -> users.id, indexed |
| `notification_type` | `String(50)` | NO | - | 알림 유형 (아래 참고) |
| `title` | `String(200)` | NO | - | 알림 제목 |
| `message` | `Text` | YES | - | 알림 내용 |
| `related_type` | `String(50)` | YES | - | 관련 엔티티 타입: 'request', 'discussion', 'position' |
| `related_id` | `Integer` | YES | - | 관련 엔티티 ID |
| `is_read` | `Boolean` | YES | `false` | 읽음 여부, indexed |
| `created_at` | `DateTime` | YES | `datetime.utcnow` | **Python default** (server_default 아님) |

**notification_type 값 목록**:
- `request_approved`, `request_rejected`, `discussion_opened`, `discussion_requested`

**제약조건**:
- PK: `id`
- FK: `user_id` -> `users.id`
- INDEX: `id`, `user_id`, `is_read`

**관계**:
- `notifications` N:1 `users`

> **주의**: `created_at`이 `datetime.utcnow` (Python default). timezone 정보 없음. Spring Boot에서는 `@Column(columnDefinition = "TIMESTAMP")` + 서버 타임존 설정 필요.

---

#### 1.3.11 `decision_notes` - 의사결정 노트

**목적**: 포지션에 대한 의사결정 근거 기록. 블록 에디터(Editor.js) 데이터 지원. 운용보고서 타입도 포함.

| 컬럼명 | 타입 | Nullable | Default | 비고 |
|--------|------|----------|---------|------|
| `id` | `Integer` | NO | auto | PK, indexed |
| `position_id` | `Integer` | NO | - | FK -> positions.id, indexed |
| `title` | `String(200)` | NO | - | 제목 |
| `content` | `Text` | NO | - | markdown (블록 에디터 미지원 시 fallback) |
| `blocks` | `JSON` | YES | - | Editor.js 블록 데이터 (PostgreSQL JSON) |
| `note_type` | `String(20)` | YES | `'decision'` | 'decision' 또는 'report' (운용보고서) |
| `created_by` | `Integer` | NO | - | FK -> users.id |
| `updated_at` | `DateTime` | YES | `datetime.utcnow` | Python default + onupdate |
| `created_at` | `DateTime` | YES | `datetime.utcnow` | Python default |

**제약조건**:
- PK: `id`
- FK: `position_id` -> `positions.id`, `created_by` -> `users.id`
- INDEX: `id`, `position_id`

**관계**:
- `decision_notes` N:1 `positions`
- `decision_notes` N:1 `users` (author)

> **주의**: `blocks` 컬럼은 `sqlalchemy.dialects.postgresql.JSON` 사용 (PostgreSQL 전용). 다른 DB로 마이그레이션 시 주의.

---

#### 1.3.12 `team_columns` - 팀 칼럼

**목적**: 팀원들이 자유롭게 작성하는 글. 팀장/관리자의 검증(파란 체크) 기능. 출석 방패 적립 연동.

| 컬럼명 | 타입 | Nullable | Default | 비고 |
|--------|------|----------|---------|------|
| `id` | `Integer` | NO | auto | PK, indexed |
| `author_id` | `Integer` | NO | - | FK -> users.id, indexed |
| `title` | `String(200)` | NO | - | 제목 |
| `content` | `Text` | YES | - | legacy markdown (하위 호환) |
| `blocks` | `JSON` | YES | - | Editor.js 블록 형식 |
| `created_at` | `DateTime` | YES | `datetime.utcnow` | Python default |
| `updated_at` | `DateTime` | YES | `datetime.utcnow` | Python default + onupdate |
| `is_verified` | `Boolean` | YES | `false` | 검증 여부 (파란 체크) |
| `verified_by` | `Integer` | YES | - | FK -> users.id (검증자) |
| `verified_at` | `DateTime` | YES | - | 검증 시각 |
| `shield_granted` | `Boolean` | NO | `false` | 방패 적립 여부, server_default='false' |

**제약조건**:
- PK: `id`
- FK: `author_id` -> `users.id`, `verified_by` -> `users.id`
- INDEX: `id`, `author_id`

**관계**:
- `team_columns` N:1 `users` (author - author_id)
- `team_columns` N:1 `users` (verifier - verified_by, 단방향)

---

#### 1.3.13 `attendances` - 출석 기록

**목적**: 일별 출석 기록. 미출석 시 칼럼 작성으로 복구 가능. 사용자+날짜 유니크.

| 컬럼명 | 타입 | Nullable | Default | 비고 |
|--------|------|----------|---------|------|
| `id` | `Integer` | NO | auto | PK, indexed |
| `user_id` | `Integer` | NO | - | FK -> users.id, indexed |
| `date` | `Date` | NO | - | 출석 날짜, indexed |
| `status` | `String(20)` | YES | `'present'` | 'present', 'absent', 'recovered' |
| `recovered_by_column_id` | `Integer` | YES | - | FK -> team_columns.id (복구 칼럼) |
| `approved_by` | `Integer` | YES | - | FK -> users.id (승인자) |
| `created_at` | `DateTime` | YES | `datetime.utcnow` | Python default |

**제약조건**:
- PK: `id`
- FK: `user_id` -> `users.id`, `recovered_by_column_id` -> `team_columns.id`, `approved_by` -> `users.id`
- UNIQUE: `(user_id, date)` [constraint name: `uq_user_date`]
- INDEX: `id`, `user_id`, `date`

**관계**:
- `attendances` N:1 `users` (user - user_id)
- `attendances` N:1 `users` (approver - approved_by, 단방향)
- `attendances` N:1 `team_columns` (recovery_column - recovered_by_column_id, 단방향)

---

#### 1.3.14 `trading_plans` - 매매계획 이력

**목적**: 포지션의 매매계획 저장 + 체결 기록을 하나의 테이블에 `record_type`으로 구분. 버전 관리.

| 컬럼명 | 타입 | Nullable | Default | 비고 |
|--------|------|----------|---------|------|
| `id` | `Integer` | NO | auto | PK, indexed |
| `position_id` | `Integer` | NO | - | FK -> positions.id (CASCADE), indexed |
| `user_id` | `Integer` | NO | - | FK -> users.id, indexed |
| `version` | `Integer` | YES | `1` | 계획 버전 |
| `record_type` | `String(20)` | YES | `'plan_saved'` | 'plan_saved' 또는 'execution' |
| `buy_plan` | `JSON` | YES | - | 분할매수 계획 (plan_saved 시) |
| `take_profit_targets` | `JSON` | YES | - | 익절 목표 (plan_saved 시) |
| `stop_loss_targets` | `JSON` | YES | - | 손절 목표 (plan_saved 시) |
| `memo` | `Text` | YES | - | 메모 (plan_saved 시) |
| `changes` | `JSON` | YES | - | deprecated: 변경 이력 |
| `plan_type` | `String(20)` | YES | - | 체결 유형: 'buy', 'take_profit', 'stop_loss' |
| `execution_index` | `Integer` | YES | - | 체결 순서 (1차, 2차...) |
| `target_price` | `Numeric(20,8)` | YES | - | 계획 가격 |
| `target_quantity` | `Numeric(20,8)` | YES | - | 계획 수량 |
| `executed_price` | `Numeric(20,8)` | YES | - | 실제 체결 가격 |
| `executed_quantity` | `Numeric(20,8)` | YES | - | 실제 체결 수량 |
| `executed_amount` | `Numeric(20,2)` | YES | - | 체결 금액 |
| `profit_loss` | `Numeric(20,2)` | YES | - | 실현 손익 |
| `profit_rate` | `Numeric(10,6)` | YES | - | 수익률 |
| `status` | `String(20)` | YES | `'draft'` | 'draft', 'submitted' |
| `created_at` | `DateTime` | YES | `datetime.utcnow` | Python default |
| `submitted_at` | `DateTime` | YES | - | 제출 시각 |

**제약조건**:
- PK: `id`
- FK: `position_id` -> `positions.id` (CASCADE), `user_id` -> `users.id`
- INDEX: `id`, `position_id`, `user_id`

**관계**:
- `trading_plans` N:1 `positions`
- `trading_plans` N:1 `users`

> **설계 노트**: `record_type`에 따라 사용되는 컬럼군이 다름. Spring Boot에서 `@DiscriminatorColumn` + 상속 전략, 또는 단순히 하나의 Entity로 유지하되 `record_type` 필드로 구분 가능.

---

#### 1.3.15 `news_desks` - 일별 뉴스데스크

**목적**: AI가 생성한 일별 뉴스 브리핑 콘텐츠. 칼럼, 뉴스카드, 키워드, 감성분석, 주목종목 등.

| 컬럼명 | 타입 | Nullable | Default | 비고 |
|--------|------|----------|---------|------|
| `id` | `Integer` | NO | auto | PK, indexed |
| `publish_date` | `Date` | NO | - | UNIQUE, indexed |
| `columns` | `JSON` | YES | - | AI 칼럼 2개 |
| `news_cards` | `JSON` | YES | - | 뉴스 카드 6개 |
| `keywords` | `JSON` | YES | - | 키워드 버블 데이터 |
| `sentiment` | `JSON` | YES | - | 호재/악재 비율 |
| `top_stocks` | `JSON` | YES | - | 주목 종목 3개 |
| `status` | `String(20)` | YES | `'pending'` | 'pending', 'generating', 'ready', 'failed' |
| `error_message` | `Text` | YES | - | 실패 시 에러 메시지 |
| `raw_news_count` | `Integer` | YES | `0` | 수집된 원본 뉴스 수 |
| `generation_count` | `Integer` | YES | `0` | 생성 횟수 |
| `last_generated_at` | `DateTime` | YES | - | 마지막 생성 시각 (KST) |
| `created_at` | `DateTime` | YES | `datetime.utcnow` | Python default |
| `updated_at` | `DateTime` | YES | `datetime.utcnow` | Python default + onupdate |

**제약조건**:
- PK: `id`
- UNIQUE: `publish_date`
- INDEX: `id`, `publish_date`

**관계**: 없음 (독립 테이블. raw_news와 논리적 관계만 있음)

---

#### 1.3.16 `raw_news` - 수집된 원본 뉴스

**목적**: 뉴스 크롤러가 수집한 원본 뉴스 데이터. 분석 결과(키워드, 감성) 포함.

| 컬럼명 | 타입 | Nullable | Default | 비고 |
|--------|------|----------|---------|------|
| `id` | `Integer` | NO | auto | PK, indexed |
| `source` | `String(50)` | NO | - | 'naver', 'yfinance' 등 |
| `title` | `String(500)` | NO | - | 뉴스 제목 |
| `description` | `Text` | YES | - | 뉴스 요약/본문 |
| `link` | `String(1000)` | YES | - | 원문 URL |
| `pub_date` | `DateTime` | YES | - | 발행일 |
| `collected_at` | `DateTime` | YES | `datetime.utcnow` | Python default |
| `keywords` | `JSON` | YES | - | 추출된 키워드 |
| `sentiment` | `String(20)` | YES | - | 'positive', 'negative', 'neutral' |
| `newsdesk_date` | `Date` | YES | - | 대상 뉴스데스크 날짜, indexed |

**제약조건**:
- PK: `id`
- INDEX: `id`, `newsdesk_date`

**관계**: 없음 (news_desks와 논리적 관계: newsdesk_date = news_desks.publish_date)

---

#### 1.3.17 `asset_snapshots` - 일별 자산 스냅샷

**목적**: 팀 전체 자산의 일별 스냅샷. KRW/USD/USDT 별 현금+평가액, 합산, 손익 추적.

| 컬럼명 | 타입 | Nullable | Default | 비고 |
|--------|------|----------|---------|------|
| `id` | `Integer` | NO | auto | PK, indexed |
| `snapshot_date` | `Date` | NO | - | UNIQUE, indexed |
| `krw_cash` | `Numeric(20,2)` | YES | `0` | KRW 현금 |
| `krw_evaluation` | `Numeric(20,2)` | YES | `0` | KRW 평가액 |
| `usd_cash` | `Numeric(20,4)` | YES | `0` | USD 현금 |
| `usd_evaluation` | `Numeric(20,4)` | YES | `0` | USD 평가액 |
| `usdt_evaluation` | `Numeric(20,4)` | YES | `0` | USDT 평가액 |
| `total_krw` | `Numeric(20,2)` | YES | `0` | 전체 자산 (KRW 환산) |
| `exchange_rate` | `Numeric(10,2)` | YES | - | 스냅샷 당시 환율 |
| `realized_pnl` | `Numeric(20,2)` | YES | `0` | 실현 손익 |
| `unrealized_pnl` | `Numeric(20,2)` | YES | `0` | 미실현 손익 |
| `position_details` | `JSON` | YES | - | 포지션별 상세 |
| `created_at` | `DateTime` | YES | `datetime.utcnow` | Python default |

**제약조건**:
- PK: `id`
- UNIQUE: `snapshot_date`
- INDEX: `id`, `snapshot_date`

**관계**: 없음 (독립 테이블)

---

#### 1.3.18 `comments` - 문서 댓글

**목적**: 다형성 댓글. document_type + document_id로 다양한 문서 타입에 대한 댓글 지원.

| 컬럼명 | 타입 | Nullable | Default | 비고 |
|--------|------|----------|---------|------|
| `id` | `Integer` | NO | auto | PK, indexed |
| `user_id` | `Integer` | NO | - | FK -> users.id, indexed |
| `document_type` | `String(50)` | NO | - | 문서 타입, indexed (아래 참고) |
| `document_id` | `Integer` | NO | - | 문서 ID, indexed |
| `content` | `Text` | NO | - | 댓글 내용 |
| `created_at` | `DateTime` | YES | `datetime.now(KST)` | **KST** (Asia/Seoul) |
| `updated_at` | `DateTime` | YES | - | onupdate: `datetime.now(KST)` |

**document_type 값 목록**:
- `decision_note`, `report`, `column`, `ai_column`, `news`

**제약조건**:
- PK: `id`
- FK: `user_id` -> `users.id`
- INDEX: `id`, `user_id`, `document_type`, `document_id`

**관계**:
- `comments` N:1 `users`

> **주의**: 이 테이블만 KST(Asia/Seoul) 시간대를 Python default로 사용. 다른 테이블은 UTC 또는 server_default. Spring Boot에서는 `ZonedDateTime` + `@Column(columnDefinition = "TIMESTAMP")` 사용하되, 서버/DB 타임존 정책을 통일할 것.

---

#### 1.3.19 `push_subscriptions` - Web Push 구독

**목적**: Web Push 알림을 위한 브라우저 구독 정보. VAPID 프로토콜.

| 컬럼명 | 타입 | Nullable | Default | 비고 |
|--------|------|----------|---------|------|
| `id` | `Integer` | NO | auto | PK, indexed |
| `user_id` | `Integer` | NO | - | FK -> users.id, indexed |
| `endpoint` | `Text` | NO | - | Push 서비스 endpoint URL |
| `p256dh` | `String(200)` | NO | - | 공개키 |
| `auth` | `String(100)` | NO | - | 인증 시크릿 |
| `created_at` | `DateTime` | YES | `datetime.utcnow` | Python default |

**제약조건**:
- PK: `id`
- FK: `user_id` -> `users.id`
- UNIQUE: `endpoint` [constraint name: `uq_push_subscription_endpoint`]
- INDEX: `id`, `user_id`

**관계**:
- `push_subscriptions` N:1 `users` (cascade: all, delete-orphan 설정은 User 쪽)

> **참고**: `__init__.py`에 미등록. Spring Boot 마이그레이션 시 Entity 등록 누락 주의.

---

### 1.4 관계도 (ASCII 다이어그램)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CORE DOMAIN                                  │
│                                                                     │
│  ┌──────────┐     opened_by/closed_by     ┌──────────────┐         │
│  │  users   │◄────────────────────────────│  positions   │         │
│  │          │     requester/approver       │              │         │
│  │  id ─────┼──────────────────────┐      │  id ─────────┼──┐     │
│  │  email   │                      │      │  ticker      │  │     │
│  │  role    │                      ▼      │  status      │  │     │
│  │          │              ┌──────────────┐│  buy_plan    │  │     │
│  │          │              │   requests   ││              │  │     │
│  │          │              │              ││              │  │     │
│  │          │              │  id          ││              │  │     │
│  │          │              │  position_id─┼┘              │  │     │
│  │          │              │  request_type│               │  │     │
│  │          │              │  status      │               │  │     │
│  │          │              └──────┬───────┘               │  │     │
│  │          │                     │                        │  │     │
│  │          │    opened_by/       │ request_id             │  │     │
│  │          │    closed_by        ▼                        │  │     │
│  │          │◄─────────┌──────────────┐   position_id     │  │     │
│  │          │          │ discussions  │◄───────────────────┘  │     │
│  │          │          │              │                       │     │
│  │          │          │  id          │                       │     │
│  │          │          │  session_cnt │                       │     │
│  │          │          └──────┬───────┘                       │     │
│  │          │                 │                               │     │
│  │          │    user_id      │ discussion_id                │     │
│  │          │◄──────┌─────────▼──────┐                       │     │
│  │          │       │   messages     │                       │     │
│  │          │       │  content       │                       │     │
│  │          │       │  message_type  │                       │     │
│  │          │       │  chart_data    │                       │     │
│  │          │       └────────────────┘                       │     │
│  └──────┬───┘                                                │     │
│         │                                                    │     │
│         │         ┌──────────────────┐   position_id         │     │
│         │         │  trading_plans   │◄──────────────────────┘     │
│         │ user_id │  record_type     │                             │
│         ├────────►│  buy_plan        │                             │
│         │         │  executed_price  │                             │
│         │         └──────────────────┘                             │
│         │                                                          │
│         │         ┌──────────────────┐   position_id               │
│         │         │ decision_notes   │◄──────────────────────┐     │
│         ├────────►│  blocks          │                       │     │
│         │         │  note_type       │    (from positions)   │     │
│         │         └──────────────────┘                       │     │
│         │                                                    │     │
│         │         ┌──────────────────┐   position_id         │     │
│         │         │  price_alerts    │◄──────────────────────┘     │
│         │         │  alert_type      │                             │
│         │         │  target_price    │                             │
│         │         └──────────────────┘                             │
│         │                                                          │
└─────────┼──────────────────────────────────────────────────────────┘
          │
┌─────────┼──────────────────────────────────────────────────────────┐
│         │              SUPPORT DOMAIN                               │
│         │                                                          │
│         │         ┌──────────────────┐                             │
│         ├────────►│  notifications   │                             │
│         │         │  type, title     │                             │
│         │         │  related_type/id │  (다형성 참조)              │
│         │         └──────────────────┘                             │
│         │                                                          │
│         │         ┌──────────────────┐                             │
│         ├────────►│   audit_logs     │                             │
│         │         │  entity_type/id  │  (다형성 참조)              │
│         │         │  action, changes │                             │
│         │         └──────────────────┘                             │
│         │                                                          │
│         │         ┌──────────────────┐                             │
│         ├────────►│    comments      │                             │
│         │         │  doc_type/doc_id │  (다형성 참조)              │
│         │         │  content         │                             │
│         │         └──────────────────┘                             │
│         │                                                          │
│         │         ┌──────────────────┐                             │
│         ├────────►│ push_subscriptions│                            │
│         │         │  endpoint, keys  │                             │
│         │         └──────────────────┘                             │
│         │                                                          │
│         │  author_id  ┌──────────────────┐                        │
│         ├────────────►│  team_columns    │◄──┐                    │
│         │  verified_by│  blocks, verified│   │ recovered_by       │
│         │             └──────────────────┘   │ _column_id         │
│         │                                    │                    │
│         │  user_id    ┌──────────────────┐   │                    │
│         ├────────────►│  attendances     │───┘                    │
│         │  approved_by│  date, status    │                        │
│         │             │  UQ(user,date)   │                        │
│         │             └──────────────────┘                        │
│         │                                                          │
└─────────┼──────────────────────────────────────────────────────────┘
          │
┌─────────┼──────────────────────────────────────────────────────────┐
│         │          INDEPENDENT DOMAIN                               │
│         │                                                          │
│         │         ┌──────────────────┐                             │
│         │         │  team_settings   │  (싱글톤, FK 없음)         │
│         │         │  capital, AI용량 │                             │
│         │         └──────────────────┘                             │
│         │                                                          │
│         │         ┌──────────────────┐                             │
│         │         │email_verifications│  (FK 없음)                │
│         │         │  code, expires_at│                             │
│         │         └──────────────────┘                             │
│         │                                                          │
│         │         ┌──────────────────┐                             │
│         │         │   news_desks     │  (FK 없음, UNIQUE date)    │
│         │         │  AI columns/cards│                             │
│         │         └──────────────────┘                             │
│         │                        ▲ 논리적 관계                     │
│         │         ┌──────────────┴───┐  (newsdesk_date)           │
│         │         │    raw_news      │  (FK 없음)                 │
│         │         │  source, title   │                             │
│         │         └──────────────────┘                             │
│         │                                                          │
│         │         ┌──────────────────┐                             │
│         │         │ asset_snapshots  │  (FK 없음, UNIQUE date)    │
│         │         │  KRW/USD/USDT   │                             │
│         │         │  PnL tracking    │                             │
│         │         └──────────────────┘                             │
│         │                                                          │
└─────────┴──────────────────────────────────────────────────────────┘
```

**다형성 패턴 사용 테이블** (FK 없이 type + id로 참조):
- `notifications`: `related_type` + `related_id` -> request / discussion / position
- `audit_logs`: `entity_type` + `entity_id` -> position / request / discussion
- `comments`: `document_type` + `document_id` -> decision_note / report / column / ai_column / news

---

### 1.5 DateTime 처리 불일치 정리

현재 코드에서 DateTime 기본값 처리 방식이 3가지 혼재. Spring Boot 통일 시 참고.

| 방식 | 사용 테이블 | 특징 |
|------|-----------|------|
| `server_default=func.now()` (timezone=True) | users, positions, requests, discussions, messages, price_alerts, email_verifications, team_settings, audit_logs | **권장**. DB 서버 시간, timezone aware |
| `default=datetime.utcnow` (timezone 없음) | notifications, decision_notes, team_columns, attendances, trading_plans, news_desks, raw_news, asset_snapshots, push_subscriptions | Python 앱 시간, timezone naive. UTC |
| `default=lambda: datetime.now(KST)` | comments | Python 앱 시간, KST (Asia/Seoul) |

> **Spring Boot 권장**: 모든 DateTime 컬럼을 `TIMESTAMP WITH TIME ZONE`으로 통일하고, JPA `@CreationTimestamp` / `@UpdateTimestamp` + 서버 타임존 UTC 설정.

---

## Part 2: 미래 확장용 스키마 (FUTURE_FEATURES.md 기반)

> 구현 순서: B -> C -> D -> E -> F -> G

---

### 2.1 B. 세션/기수 관리 (Fund Generation Management)

#### 신규 테이블: `fund_sessions`

| 컬럼명 | 타입 | Nullable | Default | 비고 |
|--------|------|----------|---------|------|
| `id` | `Integer` | NO | auto | PK |
| `generation_number` | `Integer` | NO | - | 기수 번호 (32, 33...), UNIQUE |
| `start_date` | `Date` | NO | - | 시작일 |
| `end_date` | `Date` | YES | - | 종료일 (진행중이면 null) |
| `initial_capital_krw` | `Numeric(20,0)` | YES | `0` | 원화 초기 자본금 |
| `initial_capital_usd` | `Numeric(20,2)` | YES | `0` | 달러 초기 자본금 |
| `status` | `String(20)` | NO | `'active'` | 'active', 'closed', 'transitioning' |
| `created_at` | `DateTime(tz)` | YES | server_default | |
| `updated_at` | `DateTime(tz)` | YES | server_default | |

**관계**: 1:N users (session_id), 1:N capital_transactions

#### 신규 테이블: `capital_transactions`

| 컬럼명 | 타입 | Nullable | Default | 비고 |
|--------|------|----------|---------|------|
| `id` | `Integer` | NO | auto | PK |
| `session_id` | `Integer` | NO | - | FK -> fund_sessions.id |
| `transaction_type` | `String(30)` | NO | - | deposit, withdrawal, loan, investment... |
| `amount` | `Numeric(20,2)` | NO | - | 금액 |
| `currency` | `String(10)` | NO | - | KRW, USD |
| `description` | `Text` | YES | - | 설명 |
| `executed_by` | `Integer` | NO | - | FK -> users.id |
| `executed_at` | `DateTime(tz)` | NO | - | 실행 시각 |
| `created_at` | `DateTime(tz)` | YES | server_default | |

#### 기존 테이블 변경

| 테이블 | 추가 컬럼 | 타입 | 비고 |
|--------|----------|------|------|
| `users` | `session_id` | `Integer FK` | -> fund_sessions.id (소속 기수) |

---

### 2.2 C. 멀티테넌시 (Multi-tenancy)

#### 신규 테이블: `teams`

| 컬럼명 | 타입 | Nullable | Default | 비고 |
|--------|------|----------|---------|------|
| `id` | `Integer` | NO | auto | PK |
| `code` | `String(50)` | NO | - | UNIQUE. 예: "SNU_FUND" |
| `name` | `String(200)` | NO | - | "서울대 펀드팀" |
| `is_active` | `Boolean` | YES | `true` | |
| `created_by` | `Integer` | YES | - | FK -> users.id (super admin) |
| `created_at` | `DateTime(tz)` | YES | server_default | |

#### 기존 테이블 변경 (team_id 추가 대상)

| 테이블 | 추가 컬럼 | 비고 |
|--------|----------|------|
| `users` | `team_id` Integer FK | -> teams.id |
| `positions` | `team_id` Integer FK | -> teams.id |
| `requests` | `team_id` Integer FK | -> teams.id (쿼리 필터용) |
| `discussions` | `team_id` Integer FK | -> teams.id |
| `team_settings` | `team_id` Integer FK, UNIQUE | 팀별 설정 |
| `attendances` | `team_id` Integer FK | -> teams.id |
| `team_columns` | `team_id` Integer FK | -> teams.id |
| `decision_notes` | `team_id` Integer FK | -> teams.id |
| `news_desks` | - | 공유 캐시로 분리 (D항) |
| `asset_snapshots` | `team_id` Integer FK | -> teams.id |

#### UserRole 확장

| 값 | 추가 | 설명 |
|----|------|------|
| `SUPER_ADMIN` | 신규 | 모든 팀 관리 가능 |

---

### 2.3 D. 뉴스데스크 공유 캐시

#### 기존 `news_desks` -> `shared_news_desks`로 리네임

| 컬럼명 | 타입 | Nullable | Default | 비고 |
|--------|------|----------|---------|------|
| (기존 컬럼 유지) | | | | |
| `created_by_team_id` | `Integer` | YES | - | FK -> teams.id (최초 생성 팀) |

#### 신규 테이블: `team_newsdesk_accesses`

| 컬럼명 | 타입 | Nullable | Default | 비고 |
|--------|------|----------|---------|------|
| `id` | `Integer` | NO | auto | PK |
| `team_id` | `Integer` | NO | - | FK -> teams.id |
| `shared_newsdesk_id` | `Integer` | NO | - | FK -> shared_news_desks.id |
| `accessed_at` | `DateTime(tz)` | NO | server_default | |
| `was_cached` | `Boolean` | NO | `false` | AI 호출 없이 캐시 히트 여부 |

#### 신규 테이블: `team_newsdesk_subscriptions`

| 컬럼명 | 타입 | Nullable | Default | 비고 |
|--------|------|----------|---------|------|
| `id` | `Integer` | NO | auto | PK |
| `team_id` | `Integer` | NO | - | FK -> teams.id, UNIQUE |
| `is_active` | `Boolean` | NO | `false` | 구독 활성 여부 |
| `plan_type` | `String(20)` | NO | `'free'` | 'free', 'basic', 'premium' |
| `daily_past_request_limit` | `Integer` | YES | `3` | 하루 과거 열람 횟수 |
| `activated_at` | `DateTime(tz)` | YES | - | |
| `expires_at` | `DateTime(tz)` | YES | - | |

---

### 2.4 E. 커뮤니티 허브

#### 신규 테이블: `posts`

| 컬럼명 | 타입 | Nullable | Default | 비고 |
|--------|------|----------|---------|------|
| `id` | `Integer` | NO | auto | PK |
| `team_id` | `Integer` | NO | - | FK -> teams.id |
| `category` | `String(30)` | NO | - | 'report', 'column', 'analysis', 'free', 'notice' |
| `title` | `String(300)` | NO | - | |
| `content` | `Text` | NO | - | rich text / markdown |
| `is_premium` | `Boolean` | YES | `false` | 유료 콘텐츠 여부 |
| `price_credits` | `Integer` | YES | `0` | 유료 시 크레딧 가격 |
| `view_count` | `Integer` | YES | `0` | 조회수 |
| `published_at` | `DateTime(tz)` | YES | - | |
| `tags` | `JSON` | YES | - | 태그 배열 |
| `created_at` | `DateTime(tz)` | YES | server_default | |
| `updated_at` | `DateTime(tz)` | YES | server_default | |

#### 신규 테이블: `post_comments`

| 컬럼명 | 타입 | Nullable | Default | 비고 |
|--------|------|----------|---------|------|
| `id` | `Integer` | NO | auto | PK |
| `post_id` | `Integer` | NO | - | FK -> posts.id |
| `author_team_id` | `Integer` | NO | - | FK -> teams.id |
| `author_user_id` | `Integer` | YES | - | FK -> users.id (선택) |
| `content` | `Text` | NO | - | |
| `created_at` | `DateTime(tz)` | YES | server_default | |

#### 신규 테이블: `team_messages` (팀 간 DM)

| 컬럼명 | 타입 | Nullable | Default | 비고 |
|--------|------|----------|---------|------|
| `id` | `Integer` | NO | auto | PK |
| `sender_team_id` | `Integer` | NO | - | FK -> teams.id |
| `receiver_team_id` | `Integer` | NO | - | FK -> teams.id |
| `sender_user_id` | `Integer` | NO | - | FK -> users.id (팀장/부팀장) |
| `content` | `Text` | NO | - | |
| `is_read` | `Boolean` | YES | `false` | |
| `created_at` | `DateTime(tz)` | YES | server_default | |

---

### 2.5 F. 크레딧 시스템

#### 신규 테이블: `credit_accounts`

| 컬럼명 | 타입 | Nullable | Default | 비고 |
|--------|------|----------|---------|------|
| `id` | `Integer` | NO | auto | PK |
| `team_id` | `Integer` | NO | - | FK -> teams.id, UNIQUE |
| `balance_credits` | `Integer` | NO | `0` | 보유 크레딧 |
| `total_earned` | `Integer` | NO | `0` | 누적 획득 |
| `total_spent` | `Integer` | NO | `0` | 누적 사용 |
| `updated_at` | `DateTime(tz)` | YES | server_default | |

#### 신규 테이블: `credit_transactions`

| 컬럼명 | 타입 | Nullable | Default | 비고 |
|--------|------|----------|---------|------|
| `id` | `Integer` | NO | auto | PK |
| `team_id` | `Integer` | NO | - | FK -> teams.id |
| `transaction_type` | `String(30)` | NO | - | purchase, spend, earn, subscription, refund |
| `amount_credits` | `Integer` | NO | - | 크레딧 수량 (+/-) |
| `amount_krw` | `Numeric(20,2)` | YES | - | 현금 거래 시 금액 |
| `reference_id` | `Integer` | YES | - | 관련 콘텐츠/구독 ID |
| `reference_type` | `String(50)` | YES | - | 관련 엔티티 타입 |
| `description` | `Text` | YES | - | 설명 |
| `created_at` | `DateTime(tz)` | YES | server_default | |

---

### 2.6 G. 콘텐츠 마켓플레이스

#### 신규 테이블: `content_purchases`

| 컬럼명 | 타입 | Nullable | Default | 비고 |
|--------|------|----------|---------|------|
| `id` | `Integer` | NO | auto | PK |
| `buyer_team_id` | `Integer` | NO | - | FK -> teams.id |
| `seller_team_id` | `Integer` | NO | - | FK -> teams.id |
| `content_type` | `String(30)` | NO | - | 'post', 'portfolio_access', 'subscription' |
| `content_id` | `Integer` | YES | - | Post.id 등 |
| `price_credits` | `Integer` | NO | - | 크레딧 가격 |
| `purchased_at` | `DateTime(tz)` | NO | server_default | |
| `expires_at` | `DateTime(tz)` | YES | - | 구독형 만료일 |

#### 신규 테이블: `content_subscriptions`

| 컬럼명 | 타입 | Nullable | Default | 비고 |
|--------|------|----------|---------|------|
| `id` | `Integer` | NO | auto | PK |
| `subscriber_team_id` | `Integer` | NO | - | FK -> teams.id |
| `publisher_team_id` | `Integer` | NO | - | FK -> teams.id |
| `plan` | `String(20)` | NO | - | 'monthly', 'quarterly', 'annual' |
| `price_credits_per_period` | `Integer` | NO | - | 기간당 크레딧 |
| `auto_renew` | `Boolean` | YES | `true` | 자동 갱신 |
| `started_at` | `DateTime(tz)` | NO | - | |
| `next_billing_at` | `DateTime(tz)` | YES | - | |
| `cancelled_at` | `DateTime(tz)` | YES | - | |

#### 신규 테이블: `portfolio_accesses`

| 컬럼명 | 타입 | Nullable | Default | 비고 |
|--------|------|----------|---------|------|
| `id` | `Integer` | NO | auto | PK |
| `buyer_team_id` | `Integer` | NO | - | FK -> teams.id |
| `seller_team_id` | `Integer` | NO | - | FK -> teams.id |
| `access_type` | `String(20)` | NO | - | 'one_time', 'monthly' |
| `price_credits` | `Integer` | NO | - | |
| `include_realtime` | `Boolean` | YES | `false` | 실시간 업데이트 포함 |
| `granted_at` | `DateTime(tz)` | NO | server_default | |
| `expires_at` | `DateTime(tz)` | YES | - | |

---

## Part 3: Spring Boot JPA 매핑 가이드

### 3.1 SQLAlchemy -> JPA Entity 매핑 총정리

| SQLAlchemy | JPA/Hibernate | 비고 |
|-----------|---------------|------|
| `Base` (declarative_base) | `@Entity` + `@Table(name="...")` | |
| `Column(Integer, primary_key=True)` | `@Id @GeneratedValue(strategy=IDENTITY)` | PostgreSQL은 IDENTITY 또는 SEQUENCE |
| `Column(String(255))` | `@Column(length=255)` | |
| `Column(Text)` | `@Column(columnDefinition="TEXT")` 또는 `@Lob` | TEXT 권장 (Lob은 CLOB) |
| `Column(Numeric(20,4))` | `BigDecimal` + `@Column(precision=20, scale=4)` | |
| `Column(Boolean)` | `Boolean` + `@Column` | |
| `Column(DateTime(timezone=True))` | `OffsetDateTime` 또는 `ZonedDateTime` | |
| `Column(DateTime)` (no tz) | `LocalDateTime` | timezone naive |
| `Column(Date)` | `LocalDate` | |
| `Column(JSON)` | `String` + `@JdbcTypeCode(SqlTypes.JSON)` (Hibernate 6) | 또는 `@Type(JsonType.class)` |
| `Column(nullable=False)` | `@Column(nullable=false)` | |
| `Column(unique=True)` | `@Column(unique=true)` | |
| `Column(index=True)` | `@Table(indexes={@Index(...)})` | 클래스 레벨에서 선언 |
| `server_default=func.now()` | `@CreationTimestamp` (Hibernate) | 또는 `@Column(columnDefinition="... DEFAULT NOW()")` |
| `onupdate=func.now()` | `@UpdateTimestamp` (Hibernate) | |
| `ForeignKey("table.id")` | `@JoinColumn(name="column_name")` | |
| `ForeignKey(ondelete="CASCADE")` | `@OnDelete(action=OnDeleteAction.CASCADE)` | 또는 JPA cascade + orphanRemoval |

### 3.2 Relationship 매핑

| SQLAlchemy | JPA | 비고 |
|-----------|-----|------|
| `relationship("Child", back_populates="parent")` | `@OneToMany(mappedBy="parent")` | 양방향 |
| `relationship("Parent", back_populates="children")` | `@ManyToOne @JoinColumn(name="parent_id")` | FK 소유 측 |
| `relationship(..., foreign_keys=[col])` | `@JoinColumn(name="col", referencedColumnName="id")` | 다중 FK 구분 |
| `relationship(..., order_by="Child.created_at.desc()")` | `@OrderBy("createdAt DESC")` | |
| `relationship(..., cascade="all, delete-orphan")` | `@OneToMany(cascade=ALL, orphanRemoval=true)` | |
| `backref="name"` | 양방향 `@OneToMany` + `@ManyToOne` | backref는 JPA에서 명시적 양방향으로 변환 |

#### 다중 FK 예시 (User -> Position)

```java
// Position.java
@Entity
@Table(name = "positions")
public class Position {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "opened_by")
    private User opener;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "closed_by")
    private User closer;
}

// User.java
@Entity
@Table(name = "users")
public class User {
    @OneToMany(mappedBy = "opener")
    private List<Position> openedPositions = new ArrayList<>();

    @OneToMany(mappedBy = "closer")
    private List<Position> closedPositions = new ArrayList<>();
}
```

### 3.3 Enum 처리

현재 모든 Enum이 **문자열**로 DB에 저장됨 (`String(20)` 컬럼, Python `str, enum.Enum` 상속).

```java
// Java Enum
public enum UserRole {
    MANAGER("manager"),
    ADMIN("admin"),
    MEMBER("member"),
    VIEWER("viewer");

    private final String value;
    // constructor, getter...
}

// Entity에서 사용
@Column(name = "role", length = 20, nullable = false)
@Enumerated(EnumType.STRING)
private UserRole role = UserRole.MEMBER;
```

> **주의**: SQLAlchemy에서는 `UserRole.MEMBER.value` ("member")를 저장하지만, JPA `@Enumerated(STRING)`은 enum 이름 자체("MEMBER")를 저장함. DB 호환을 위해 **AttributeConverter** 사용 권장:

```java
@Converter(autoApply = true)
public class UserRoleConverter implements AttributeConverter<UserRole, String> {
    @Override
    public String convertToDatabaseColumn(UserRole role) {
        return role == null ? null : role.getValue(); // "member"
    }

    @Override
    public UserRole convertToEntityAttribute(String dbData) {
        return UserRole.fromValue(dbData);
    }
}
```

### 3.4 DateTime / Timezone 처리 통일 전략

**현재 상태 (Python)**:
- 혼재: `func.now()` (server), `datetime.utcnow` (app UTC), `datetime.now(KST)` (app KST)

**Spring Boot 권장**:

```java
// application.yml
spring:
  jpa:
    properties:
      hibernate:
        jdbc:
          time_zone: UTC  # Hibernate이 UTC로 통일하여 DB와 통신

// BaseEntity.java (공통 상위 클래스)
@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
public abstract class BaseEntity {
    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;
}
```

**DB 컬럼**: 모든 DateTime을 `TIMESTAMP WITH TIME ZONE`으로 통일.

### 3.5 JSON 컬럼 처리

현재 프로젝트에서 JSON 컬럼을 많이 사용 (buy_plan, targets, chart_data, blocks 등).

```java
// Hibernate 6.x (Spring Boot 3.x)
@JdbcTypeCode(SqlTypes.JSON)
@Column(name = "buy_plan", columnDefinition = "jsonb")
private List<BuyPlanItem> buyPlan;

// BuyPlanItem.java (JSON 매핑용 VO)
@Embeddable  // 또는 별도 record
public class BuyPlanItem {
    private BigDecimal price;
    private BigDecimal quantity;
    private Boolean completed;
}
```

또는 hypersistence-utils 라이브러리 활용:
```java
@Type(JsonType.class)
@Column(name = "buy_plan", columnDefinition = "jsonb")
private List<Map<String, Object>> buyPlan;
```

### 3.6 다형성 참조 패턴 (Polymorphic Reference)

`notifications`, `audit_logs`, `comments`에서 사용하는 type + id 패턴:

```java
// 방법 1: 단순 문자열 + Integer (현재 구조 유지)
@Entity
public class AuditLog {
    @Column(name = "entity_type", length = 50, nullable = false)
    private String entityType; // "position", "request", ...

    @Column(name = "entity_id", nullable = false)
    private Integer entityId;
}

// 방법 2: Generic 인터페이스 (타입 안전)
public interface Auditable {
    Integer getId();
    String getEntityType();
}

// Position implements Auditable { getEntityType() = "position"; }
```

> 방법 1을 권장 (현재 구조 유지, 마이그레이션 최소화).

### 3.7 UniqueConstraint 매핑

```java
// attendances: (user_id, date) UNIQUE
@Entity
@Table(name = "attendances", uniqueConstraints = {
    @UniqueConstraint(name = "uq_user_date", columnNames = {"user_id", "date"})
})
public class Attendance { ... }

// push_subscriptions: endpoint UNIQUE
@Entity
@Table(name = "push_subscriptions", uniqueConstraints = {
    @UniqueConstraint(name = "uq_push_subscription_endpoint", columnNames = {"endpoint"})
})
public class PushSubscription { ... }
```

### 3.8 마이그레이션 체크리스트

- [ ] 모든 `datetime.utcnow` Python default -> `@CreationTimestamp` + UTC 통일
- [ ] `comments.created_at` KST -> UTC 통일 (기존 데이터 변환 필요)
- [ ] `push_subscriptions` 모델을 `__init__.py` 등록 누락 -> Entity 정상 등록 확인
- [ ] `audit_logs`의 backref -> 명시적 양방향 `@OneToMany`/`@ManyToOne`으로 변환
- [ ] `decision_notes.blocks`의 `postgresql.JSON` -> 표준 JSON 타입으로 교체
- [ ] 모든 Enum의 `.value` 저장 -> `AttributeConverter`로 소문자 값 유지
- [ ] `Numeric` 정밀도 검증 (특히 `Numeric(20,8)` -> `BigDecimal` scale 8)
- [ ] N+1 쿼리 방지: `@ManyToOne(fetch=LAZY)` 기본, 필요 시 `@EntityGraph`
- [ ] `team_settings` 싱글톤 패턴 -> Spring에서 캐싱 전략 수립
- [ ] `ondelete="CASCADE"` 매핑: JPA `cascade` + `orphanRemoval` 또는 `@OnDelete`

---

> **이 문서는 SQLAlchemy 모델 코드를 기반으로 자동 생성되었습니다.**
> 원본: `F:\fundmessage\backend\app\models\` (19개 모델, 7개 Enum)
> 참조: `F:\fundmessage\docs\plans\FUTURE_FEATURES.md`
