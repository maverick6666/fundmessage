# 펀드메신저 기능명세서
> Spring Boot 리팩토링 참조 문서 | 작성일: 2026-02-18
> 도메인별 기능 단위로 DB 스키마, API, 비즈니스 로직을 통합 정리
> 소스: SPEC_DB_SCHEMA.md, SPEC_BUSINESS_LOGIC.md, SPEC_API.md, FUTURE_FEATURES.md

---

## 도메인 1: 인증/사용자 관리

### 기능 1.1: 회원가입

- **설명**: 이메일 인증 코드 발송 → 코드 검증 → 회원가입 → 팀장 승인 → 계정 활성화. 첫 번째 가입자는 자동 팀장으로 즉시 활성화.
- **관련 DB 테이블**:
  - `users` (email, username, password_hash, full_name, role, is_active)
  - `email_verifications` (email, code, is_verified, expires_at)
- **관련 API**:
  - `POST /api/v1/auth/send-verification` — 비인증. 이메일 인증 코드 발송
  - `POST /api/v1/auth/verify-code` — 비인증. 이메일 인증 코드 확인
  - `POST /api/v1/auth/signup` — 비인증. 회원가입 (201)
  - `POST /api/v1/users/{user_id}/approve` — manager_or_admin. 가입 승인
  - `POST /api/v1/auth/register` — manager_or_admin. 사용자 직접 등록 (레거시)
- **비즈니스 로직**:
  1. 이메일 중복 확인 후 6자리 인증 코드 생성 (10분 유효)
  2. SMTP로 발송 (설정 없으면 콘솔 출력)
  3. 코드 일치 + 만료 확인 → `is_verified = true`
  4. 회원가입 시 이메일 중복 재확인
  5. `username = full_name` (동명이인 시 숫자 추가: "홍길동" → "홍길동1")
  6. 첫 번째 사용자: `role=MANAGER`, `is_active=true` (즉시 로그인 가능)
  7. 이후 사용자: `role=MEMBER`, `is_active=false` (팀장 승인 대기)
- **알림/부수효과**:
  - 2번째 이상 가입 시 모든 매니저/어드민에게 `user_pending_approval` 알림 발송 (DB + WebSocket + Web Push)
- **Spring Boot 참고**:
  - Spring Mail (JavaMailSender)로 이메일 발송
  - 비밀번호: bcrypt 해시 → Spring Security `BCryptPasswordEncoder`

---

### 기능 1.2: 로그인/토큰 관리

- **설명**: 이메일+비밀번호로 로그인하여 JWT 토큰(Access + Refresh)을 발급받고, 만료 시 Refresh Token으로 갱신. 로그인 시 자동 출석 체크.
- **관련 DB 테이블**:
  - `users` (email, password_hash, is_active)
  - `attendances` (user_id, date, status) — 자동 출석 체크
- **관련 API**:
  - `POST /api/v1/auth/login` — 비인증. 로그인 + 자동 출석 체크
  - `POST /api/v1/auth/refresh` — 비인증. Access Token 갱신
- **비즈니스 로직**:
  1. 사용자 존재 확인 → 비밀번호 bcrypt 검증 → `is_active` 확인
  2. JWT 토큰 발급:
     - Access Token: HS256, `sub=user_id`, `type="access"`, 만료=60분
     - Refresh Token: HS256, `sub=user_id`, `type="refresh"`, 만료=30일
  3. Token Rotation: Refresh 시 Access + Refresh 모두 재발급
  4. 반환: `{access_token, refresh_token, token_type, expires_in, user}`
- **알림/부수효과**:
  - KST 기준 오늘 날짜로 `attendances` 레코드 없으면 자동 생성 (`status='present'`)
  - 출석 실패해도 로그인은 정상 진행 (try-except)
- **Spring Boot 참고**:
  - `jjwt` 또는 Spring Security OAuth2 Resource Server
  - `JwtAuthenticationFilter` + `SecurityContextHolder`
  - 설정: `secret_key` (환경변수), `algorithm=HS256`

---

### 기능 1.3: 사용자 역할 관리

- **설명**: 팀장이 사용자의 역할(manager/admin/member/viewer)을 변경하고, 비활성화/삭제 처리.
- **관련 DB 테이블**:
  - `users` (role, is_active)
  - `notifications`, `messages`, `decision_notes`, `audit_logs`, `requests`, `discussions` — 삭제 시 연쇄 처리
- **관련 API**:
  - `GET /api/v1/users` — manager_or_admin. 전체 사용자 목록 (`?role=&is_active=`)
  - `GET /api/v1/users/me` — get_current_user. 내 정보 조회
  - `GET /api/v1/users/team-members` — get_current_user. 팀원 목록 (제한 정보)
  - `GET /api/v1/users/pending` — manager_or_admin. 승인 대기 사용자
  - `GET /api/v1/users/{user_id}` — get_current_user. 사용자 상세
  - `PATCH /api/v1/users/{user_id}/role` — get_manager. 역할 변경
  - `POST /api/v1/users/{user_id}/deactivate` — get_manager. 비활성화
  - `DELETE /api/v1/users/{user_id}` — get_manager. 완전 삭제
- **비즈니스 로직**:
  - 역할 변경: manager만 가능 (get_manager 의존성)
  - 삭제: 자기 자신/팀장 삭제 불가
  - 삭제 시 연쇄 처리: 알림 삭제, 메시지 `user_id=null`, 의사결정 노트 삭제, 감사로그 `user_id=null`, 요청 `requester_id/approved_by=null`, 토론 `opened_by/closed_by=null`
- **권한 매트릭스**:

  | 기능 | MANAGER | ADMIN | MEMBER | VIEWER |
  |------|---------|-------|--------|--------|
  | 사용자 승인 | O | O | X | X |
  | 역할 변경 | O | O | X | X |
  | 비활성화 | O | X | X | X |
  | 삭제 | O | X | X | X |

---

### 기능 1.4: 팀장 권한 이전

- **설명**: 현재 팀장이 다른 활성 사용자에게 manager 역할을 이전. 이전 팀장은 admin으로 변경.
- **관련 DB 테이블**:
  - `users` (role)
- **관련 API**:
  - `POST /api/v1/users/{user_id}/transfer-manager` — get_manager. 팀장 권한 이전
- **비즈니스 로직**:
  1. 대상 사용자의 `is_active` 확인 (비활성이면 거부)
  2. 현재 팀장: `role → admin`
  3. 대상 사용자: `role → manager`
  4. 반환: `{previous_manager, new_manager}`
- **Spring Boot 참고**:
  - `@Transactional`로 원자적 역할 교환 보장

---

## 도메인 2: 매매 요청

### 기능 2.1: 매수 요청

- **설명**: 팀원이 종목 매수를 요청. 종목 코드, 주문 방식(금액/수량), 매수가, 익절/손절 목표, 메모를 포함.
- **관련 DB 테이블**:
  - `requests` (requester_id, request_type='buy', target_ticker, ticker_name, target_market, order_type, order_amount, order_quantity, buy_price, take_profit_targets, stop_loss_targets, memo, status='pending')
- **관련 API**:
  - `POST /api/v1/requests/buy` — get_writer_user. 매수 요청 (201)
- **비즈니스 로직**:
  - `order_type`: 'amount'(금액 기준) 또는 'quantity'(수량 기준)
  - `buy_price`: null이면 시장가
  - `take_profit_targets`, `stop_loss_targets`: `[{price, quantity}]` 배열
  - `status`는 `PENDING`으로 생성
- **알림/부수효과**:
  - 모든 매니저/어드민에게 `new_request` 알림 발송 ("{이름}님이 {종목} 매수 요청을 제출했습니다")
  - DB + WebSocket + Web Push 3채널

---

### 기능 2.2: 매도 요청

- **설명**: 팀원이 보유 포지션에 대해 매도를 요청. 포지션 ID, 매도 수량, 매도 가격, 매도 사유를 포함.
- **관련 DB 테이블**:
  - `requests` (position_id, request_type='sell', sell_quantity, sell_price, sell_reason, status='pending')
  - `positions` (status — 존재 + OPEN 여부 확인)
- **관련 API**:
  - `POST /api/v1/requests/sell` — get_writer_user. 매도 요청 (201)
- **비즈니스 로직**:
  - 포지션 존재 확인
  - `position.status == OPEN` 확인
  - `sell_price`: null이면 시장가
  - `status`는 `PENDING`으로 생성
- **알림/부수효과**:
  - 모든 매니저/어드민에게 `new_request` 알림 발송

---

### 기능 2.3: 요청 승인 (포지션 자동 생성/추가매수)

- **설명**: 팀장/관리자가 매수/매도 요청을 승인. 매수 승인 시 포지션 자동 생성 또는 기존 포지션에 추가매수. 매도 승인 시 부분/전량 청산.
- **관련 DB 테이블**:
  - `requests` (status='approved', approved_by, approved_at, executed_price, executed_quantity, executed_at)
  - `positions` (신규 생성 또는 업데이트)
- **관련 API**:
  - `POST /api/v1/requests/{request_id}/approve` — manager_or_admin. 요청 승인
- **비즈니스 로직**:
  - **매수 승인 시**:
    1. 요청자의 희망가/수량 사용 (팀장이 별도 입력 안 하면)
    2. 동일 종목+시장의 OPEN 포지션이 있으면 → `add_to_position` (추가 매수, 가중평균 재계산)
    3. 없으면 → `create_position_from_request` (신규 포지션, `is_info_confirmed=false`)
    4. `take_profit_targets`, `stop_loss_targets`에 `completed=false` 플래그 추가
    5. `buy_plan` 생성 (분할매수면 첫 번째만 `completed=true`)
  - **매도 승인 시**:
    1. 매도 수량 >= 보유 수량 → `close_position` (전량 청산)
    2. 매도 수량 < 보유 수량 → `reduce_position` (부분 청산)
- **알림/부수효과**:
  - 요청자에게 `request_approved` 알림 ("{종목} 매수/매도 요청이 승인되었습니다")

---

### 기능 2.4: 요청 거부

- **설명**: 팀장/관리자가 매매 요청을 거부. 거부 사유 필수.
- **관련 DB 테이블**:
  - `requests` (status='rejected', approved_by, approved_at, rejection_reason)
- **관련 API**:
  - `POST /api/v1/requests/{request_id}/reject` — manager_or_admin. 요청 거부
- **비즈니스 로직**:
  - `rejection_reason` 필수 입력
  - `PENDING` 또는 `DISCUSSION` 상태에서만 거부 가능
- **알림/부수효과**:
  - 요청자에게 `request_rejected` 알림 ("{종목} 매수 요청이 거부되었습니다" + 거부 사유)

---

### 기능 2.5: 토론 전환

- **설명**: 팀장/관리자가 요청에 대해 즉시 승인/거부 대신 토론을 개시. 요청 상태를 DISCUSSION으로 변경.
- **관련 DB 테이블**:
  - `requests` (status='discussion')
  - `discussions` (request_id, title, current_agenda, status='open', session_count=1)
  - `messages` (시스템 메시지 — "Session 1 started\n의제: {agenda}")
- **관련 API**:
  - `POST /api/v1/requests/{request_id}/discuss` — manager_or_admin. 토론 개시 (201)
  - `POST /api/v1/requests/{request_id}/request-discussion` — get_writer_user. 토론 요청 (팀원→매니저)
- **비즈니스 로직**:
  - `request.status`를 `DISCUSSION`으로 변경
  - `Discussion` 레코드 생성 (title, agenda)
  - 시스템 메시지 자동 생성 (`message_type='system'`, `session_number=1`)
- **알림/부수효과**:
  - 요청자에게 `discussion_opened` 알림 ("토론이 시작되었습니다: {제목}")
  - 팀원의 토론 요청 시 매니저에게 `discussion_requested` 알림

---

### 기능 2.6: 요청 목록/상세 조회

- **설명**: 매매 요청 목록을 필터링/페이지네이션으로 조회하고, 개별 요청의 상세 정보 확인.
- **관련 DB 테이블**:
  - `requests` (status, request_type, requester_id 필터)
- **관련 API**:
  - `GET /api/v1/requests` — get_current_user. 요청 목록 (`?status=&request_type=&requester_id=&page=&limit=`)
  - `GET /api/v1/requests/{request_id}` — get_current_user. 요청 상세
  - `DELETE /api/v1/requests/{request_id}` — manager_or_admin. 요청 삭제

---

### 요청 상태 머신 요약

```
PENDING ──┬──> APPROVED (팀장 승인) → 포지션 생성/수정
          ├──> REJECTED (팀장 거부)
          └──> DISCUSSION (토론 전환) ──┬──> APPROVED
                                       └──> REJECTED
```

---

## 도메인 3: 포지션 관리

### 기능 3.1: 포지션 생성 (요청 승인 시 자동)

- **설명**: 매수 요청 승인 시 자동으로 포지션이 생성됨. 팀장의 정보 확인 전까지 `is_info_confirmed=false`.
- **관련 DB 테이블**:
  - `positions` (ticker, ticker_name, market, status='open', is_info_confirmed=false, average_buy_price, total_quantity, total_buy_amount, buy_plan, take_profit_targets, stop_loss_targets, opened_by, opened_at)
- **관련 API**: 직접 API 없음 — `POST /api/v1/requests/{id}/approve` 내부에서 자동 호출
- **비즈니스 로직**:
  - `create_position_from_request()`: 요청 데이터로 포지션 레코드 생성
  - `buy_plan`, `take_profit_targets`, `stop_loss_targets`에 `completed=false` 플래그 추가
  - `opened_at` = 현재 시각

---

### 기능 3.2: 추가 매수 (동일 티커 포지션에 합산)

- **설명**: 동일 종목+시장의 열린 포지션이 이미 존재할 때, 매수 승인 시 기존 포지션에 수량/금액을 합산. 가중평균 재계산.
- **관련 DB 테이블**:
  - `positions` (average_buy_price, total_quantity, total_buy_amount)
- **관련 API**: 직접 API 없음 — `POST /api/v1/requests/{id}/approve` 내부에서 자동 호출
- **비즈니스 로직** (가중평균 공식):
  ```
  new_total_amount = old_total_amount + (additional_quantity * additional_price)
  new_total_quantity = old_quantity + additional_quantity
  average_buy_price = new_total_amount / new_total_quantity
  ```
- **Spring Boot 참고**: `BigDecimal` 연산 필수 (정밀도 보장)

---

### 기능 3.3: 매매계획 관리 (buy_plan, take_profit, stop_loss)

- **설명**: 포지션의 분할매수 계획, 익절 목표, 손절 목표를 설정/수정. 변경 이력을 trading_plans 테이블에 버전 관리.
- **관련 DB 테이블**:
  - `positions` (buy_plan JSON, take_profit_targets JSON, stop_loss_targets JSON)
  - `trading_plans` (record_type='plan_saved', version, buy_plan, take_profit_targets, stop_loss_targets, memo, status='draft'/'submitted')
  - `audit_logs` (entity_type='position', 변경 추적)
- **관련 API**:
  - `PATCH /api/v1/positions/{position_id}/plans` — get_writer_user. 매매 계획 수정
  - `GET /api/v1/positions/{position_id}/plans` — get_current_user. 매매계획 이력
  - `POST /api/v1/positions/{position_id}/plans` — get_writer_user. 매매계획 저장 (201)
  - `POST /api/v1/positions/{position_id}/plans/{plan_id}/submit` — get_writer_user. 매매계획 제출
  - `DELETE /api/v1/positions/{position_id}/plans/{plan_id}` — get_writer_user. 매매계획 삭제 (draft만)
- **비즈니스 로직**:
  - JSON 구조: `buy_plan = [{price, quantity, completed}]`
  - JSON 구조: `take_profit_targets / stop_loss_targets = [{price, ratio, completed}]`
  - `trading_plans`에 버전 관리 (version 자동 증가)
  - `status`: draft → submitted (제출 후 수정 불가)
  - 변경 시 `audit_logs`에 old/new 값 기록
- **Spring Boot 참고**: JSON 컬럼 변경 감지 — SQLAlchemy는 `flag_modified()` 필요, JPA는 dirty checking 자동

---

### 기능 3.4: 체결 체크리스트 (toggle_plan_item)

- **설명**: 매매계획의 개별 항목(분할매수/익절/손절)을 체결 완료로 토글. 체결 시 포지션의 수량/손익 자동 재계산.
- **관련 DB 테이블**:
  - `positions` (buy_plan, take_profit_targets, stop_loss_targets, total_quantity, total_buy_amount, average_buy_price, realized_profit_loss)
  - `trading_plans` (record_type='execution', plan_type, execution_index, target_price, target_quantity, executed_price, executed_quantity, executed_amount, profit_loss, profit_rate)
  - `audit_logs` (체결 기록)
- **관련 API**:
  - `POST /api/v1/positions/{position_id}/toggle-plan` — get_manager. 계획 항목 완료 토글
  - `POST /api/v1/positions/{position_id}/executions` — get_writer_user (실질 manager만). 체결 기록 생성 (201)
- **비즈니스 로직**:
  - `plan_type`: 'buy' / 'take_profit' / 'stop_loss'
  - **매수 체결**: 수량 증가, 평균단가 가중평균 재계산
  - **익절/손절 체결**: 수량 감소, 실현손익 누적
    ```
    realized_pnl = (sell_price - average_buy_price) * sell_quantity
    position.realized_profit_loss += realized_pnl
    position.total_quantity -= sell_quantity
    position.total_buy_amount = total_quantity * average_buy_price
    ```
  - **체결 취소 불가** (HTTPException)
  - 해당 계획 항목의 `completed=true` 설정
- **알림/부수효과**:
  - `audit_logs`에 체결 기록 자동 생성

---

### 기능 3.5: 포지션 정보 확인 (팀장 confirm)

- **설명**: 팀장이 포지션의 실제 매입 정보(평균매입가, 수량 등)를 확인하고 `is_info_confirmed=true`로 설정.
- **관련 DB 테이블**:
  - `positions` (is_info_confirmed, average_buy_price, total_quantity, total_buy_amount, ticker_name)
  - `audit_logs` (확인 기록)
- **관련 API**:
  - `POST /api/v1/positions/{position_id}/confirm` — get_manager. 포지션 정보 확인
- **비즈니스 로직**:
  - 팀장이 실제 체결 정보(평균매입가, 수량)를 입력
  - `is_info_confirmed = true`
  - `audit_logs`에 변경 기록

---

### 기능 3.6: 부분 매도 (reduce_position)

- **설명**: 매도 승인 시 매도 수량이 보유 수량보다 적으면 부분 청산. 수량 차감 및 실현손익 계산.
- **관련 DB 테이블**:
  - `positions` (total_quantity, total_buy_amount, realized_profit_loss)
- **관련 API**: 직접 API 없음 — `POST /api/v1/requests/{id}/approve` 내부에서 자동 호출
- **비즈니스 로직**:
  - `total_quantity -= sell_quantity`
  - `total_buy_amount` 재계산
  - 실현손익 누적

---

### 기능 3.7: 포지션 종료 (수익률 자동 계산)

- **설명**: 포지션을 종료(CLOSED)하고 최종 수익률, 보유 기간을 자동 계산.
- **관련 DB 테이블**:
  - `positions` (status='closed', average_sell_price, total_sell_amount, profit_loss, profit_rate, holding_period_hours, closed_at, closed_by)
- **관련 API**:
  - `POST /api/v1/positions/{position_id}/close` — manager_or_admin. 포지션 종료
  - `DELETE /api/v1/positions/{position_id}` — manager_or_admin. 포지션 삭제
- **비즈니스 로직** (수익률 계산 공식):
  ```
  profit_loss = total_sell_amount - total_buy_amount
  profit_rate = profit_loss / total_buy_amount  (total_buy_amount > 0)
  holding_period_hours = (closed_at - opened_at).total_seconds() / 3600
  ```
- **포지션 상태 정보 (get_position_status_info)**:
  - 잔량 0인데 열려있음 → `alert: 'danger'`, `message: '잔량 0 - 포지션 종료 필요'`
  - 매도 계획 전부 완료됨 → `alert: 'warning'`, `message: '매도 계획 없음'`
  - 정상 → `alert: null`
- **알림/부수효과**:
  - 삭제 시 연쇄 삭제: 결정노트, 포지션 관련 토론(+메시지), 요청 관련 토론(+메시지), 감사로그

---

### 기능 3.8: 수정 이력 (감사 로그)

- **설명**: 포지션의 매매계획 수정, 정보 확인, 체결 등 모든 변경 사항을 감사 로그로 자동 기록.
- **관련 DB 테이블**:
  - `audit_logs` (entity_type='position', entity_id, action, field_name, old_value, new_value, changes JSON, user_id)
- **관련 API**:
  - `GET /api/v1/positions/{position_id}/audit-logs` — get_current_user. 포지션 수정 이력
- **비즈니스 로직**:
  - `AuditService.log_change()`: 단일 필드 변경
  - `AuditService.log_multiple_changes()`: 여러 필드 동시 변경 (`{field: {old, new}}` JSON)
  - 매매계획 수정, 포지션 정보 확인, 체결 시 자동 기록
- **Spring Boot 참고**: Spring AOP `@Around`로 자동화 가능

---

### 기능 3.9: 포지션 목록/상세 조회

- **설명**: 포지션 목록을 상태/티커/사용자별로 필터링하여 조회. 개별 포지션의 상세 정보(현재 시세 포함) 확인.
- **관련 DB 테이블**:
  - `positions` (status, ticker, opened_by 필터)
- **관련 API**:
  - `GET /api/v1/positions` — get_current_user. 포지션 목록 (`?status=&ticker=&opened_by=&page=&limit=`)
  - `GET /api/v1/positions/{position_id}` — get_current_user. 포지션 상세
  - `PATCH /api/v1/positions/{position_id}` — manager_or_admin. 포지션 수정
- **비즈니스 로직** (미실현 수익률 — PriceService):
  ```
  unrealized = (current_price * remaining_quantity) - (avg_buy_price * remaining_quantity)
  total_profit_loss = realized_profit_loss + unrealized
  profit_rate = total_profit_loss / total_buy_amount
  ```

---

### 기능 3.10: 포지션 토론/조기종료 요청

- **설명**: 팀원이 포지션에 대한 토론 또는 조기종료를 요청하여 매니저에게 알림.
- **관련 DB 테이블**:
  - `notifications` (알림 생성)
- **관련 API**:
  - `POST /api/v1/positions/{position_id}/request-discussion` — get_writer_user. 포지션 토론 요청
  - `POST /api/v1/positions/{position_id}/request-early-close` — get_current_user. 조기종료 요청
- **알림/부수효과**:
  - 매니저에게 `discussion_requested` 또는 `early_close_requested` 알림

---

## 도메인 4: 토론

### 기능 4.1: 토론 생성

- **설명**: 매매 요청 또는 포지션에 대한 토론 스레드를 생성. 요청 연결 시 요청 상태를 DISCUSSION으로 변경.
- **관련 DB 테이블**:
  - `discussions` (request_id, position_id, title, current_agenda, status='open', session_count=1, opened_by, opened_at)
  - `messages` (시스템 메시지 자동 생성)
  - `requests` (status='discussion' — 요청 연결 시)
- **관련 API**:
  - `POST /api/v1/discussions` — manager_or_admin. 토론 생성 (201)
- **비즈니스 로직**:
  - `request_id` 또는 `position_id` 중 하나 이상 필요
  - `request_id`가 있으면: `request.status = DISCUSSION`
  - `session_count = 1`
  - 시스템 메시지 자동 생성: `"Session 1 started\n의제: {agenda}"`

---

### 기능 4.2: 메시지 전송 (text/chart)

- **설명**: 토론 스레드에 텍스트 메시지 또는 차트 데이터(OHLCV 캔들)를 전송.
- **관련 DB 테이블**:
  - `messages` (discussion_id, user_id, content, message_type, chart_data JSON, session_number)
- **관련 API**:
  - `POST /api/v1/discussions/{discussion_id}/messages` — get_writer_user. 메시지 전송 (201)
  - `GET /api/v1/discussions/{discussion_id}/messages` — get_current_user. 메시지 목록 (`?page=&limit=`)
- **비즈니스 로직**:
  - `discussion.status == CLOSED`이면 메시지 전송 불가 (400 에러)
  - `message_type`:
    - `text`: 일반 텍스트
    - `chart`: OHLCV 캔들 데이터 (`chart_data` JSON 저장)
    - `system`: 시스템 메시지 (세션 시작/종료, `user_id=null`)
  - `session_number = discussion.session_count` (현재 세션 번호 자동 부여)
- **알림/부수효과**:
  - WebSocket: 같은 토론방 참여자에게 `message_received` 이벤트 (발신자에게는 `message_sent`)

---

### 기능 4.3: 세션 관리 (종료/재개)

- **설명**: 토론을 세션 단위로 운영. 종료 시 요약 기록, 재개 시 새 세션 번호와 의제 설정.
- **관련 DB 테이블**:
  - `discussions` (status, session_count, summary, summary_by_participant JSON, closed_by, closed_at)
  - `messages` (시스템 메시지 — 세션 시작)
  - `requests` (status — 재개 시 DISCUSSION으로 복원)
- **관련 API**:
  - `POST /api/v1/discussions/{discussion_id}/close` — manager_or_admin. 토론 종료
  - `POST /api/v1/discussions/{discussion_id}/reopen` — manager_or_admin. 토론 재개
  - `POST /api/v1/discussions/{discussion_id}/request-reopen` — get_writer_user. 재개 요청
  - `GET /api/v1/discussions/{discussion_id}/sessions` — get_current_user. 세션 목록
  - `DELETE /api/v1/discussions/{discussion_id}/sessions/{session_number}` — manager_or_admin. 세션 삭제
- **비즈니스 로직**:
  - **종료**: `status='closed'`, `summary` 기록, `closed_by/closed_at` 설정
  - **재개**: `session_count += 1`, `status='open'`, 새 의제 설정, 시스템 메시지 "Session {N} started\n의제: {agenda}"
  - **재개 시** request 연결이 있으면 `request.status = DISCUSSION`으로 복원
  - **세션 삭제**: 해당 세션의 모든 메시지 삭제 (매니저 전용)
- **알림/부수효과**:
  - 재개 요청 시 매니저에게 `reopen_requested` 알림

---

### 기능 4.4: 토론 내보내기

- **설명**: 토론 내용을 JSON 또는 텍스트 형식으로 내보내기. 세션별 분리 가능.
- **관련 DB 테이블**:
  - `discussions`, `messages`
- **관련 API**:
  - `GET /api/v1/discussions/{discussion_id}/export` — get_current_user. 토론 내보내기 (JSON)
  - `GET /api/v1/discussions/{discussion_id}/export-txt` — get_current_user. 텍스트 내보내기 (`?sessions=1,2,3`)
- **비즈니스 로직**:
  - `export_discussion_txt()`: 세션별 텍스트 형식 (`sessions` 파라미터로 특정 세션 선택)
  - `get_discussion_export()`: 참여자 + 메시지 목록 JSON

---

### 기능 4.5: 토론 목록/상세 조회

- **설명**: 토론 목록 조회 (상태 필터), 포지션별 토론 조회, 개별 토론 상세 확인.
- **관련 DB 테이블**:
  - `discussions` (status 필터)
- **관련 API**:
  - `GET /api/v1/discussions` — get_current_user. 토론 목록 (`?status=&limit=&offset=`)
  - `GET /api/v1/discussions/position/{position_id}` — get_current_user. 포지션별 토론
  - `GET /api/v1/discussions/{discussion_id}` — get_current_user. 토론 상세
  - `PATCH /api/v1/discussions/{discussion_id}` — manager_or_admin. 토론 수정
  - `DELETE /api/v1/discussions/{discussion_id}` — manager_or_admin. 토론 삭제

---

## 도메인 5: AI 분석

### 기능 5.1: 의사결정서 생성

- **설명**: AI가 토론 세션의 메시지를 분석하여 투자 의사결정서를 자동 생성. Editor.js 블록 데이터 지원.
- **관련 DB 테이블**:
  - `decision_notes` (position_id, title, content, blocks JSON, note_type='decision', created_by)
  - `messages` (세션별 메시지 수집)
  - `positions` (포지션 컨텍스트)
  - `team_settings` (ai_daily_limit, ai_usage_count, ai_usage_reset_date)
- **관련 API**:
  - `POST /api/v1/ai/generate-decision-note` — manager_or_admin. AI 의사결정서 생성
  - `GET /api/v1/ai/status` — get_current_user. AI 사용 가능 여부 + 남은 횟수
- **비즈니스 로직**:
  1. **메시지 수집**: `session_ids` → 토론 메시지 텍스트 변환
     - 시스템 메시지: `[시스템]` 태그
     - 차트 메시지: OHLCV 데이터 포함 (최대 5개 캔들)
     - 일반 메시지: `[시간] [작성자]: 내용`
  2. **포지션 컨텍스트** (선택): 종목 정보, 평단가, 수량, 매매계획, 요청 이력
  3. **사용량 예약**: Row-level lock (`with_for_update`), 날짜 변경 시 자동 리셋, 제한 초과 시 거부
  4. **AI 호출**:
     - 1차: OpenAI Responses API (`verbosity` 파라미터 지원)
     - 2차: Chat Completions fallback (Responses API 실패 시)
  5. **제목 추출**: 정규식 `**제목**:` 패턴
  6. **실패 시**: 사용량 자동 복원 (`_rollback_usage`)
- **출력 구조** (마크다운):
  1. 개요 (종목, 참여자, 기간, 결론)
  2. 참여자별 의견 (입장, 핵심 주장, 수치 근거)
  3. 논의 흐름 (세션별 쟁점 + 합의)
  4. 최종 결정 (투자 방향, 진입 전략, 목표가, 손절가)
  5. 리스크 (유형, 내용, 대응)
  6. 후속 조치
- **Spring Boot 참고**:
  - 사용량 동시성 제어: `@Lock(LockModeType.PESSIMISTIC_WRITE)`
  - OpenAI Java SDK 또는 Spring AI 사용
  - Responses API Java SDK 호환 여부 확인 필요

---

### 기능 5.2: 운용보고서 생성

- **설명**: AI가 포지션의 전체 데이터(매매이력, 토론, 의사결정서)를 종합하여 운용보고서를 자동 생성.
- **관련 DB 테이블**:
  - `decision_notes` (note_type='report')
  - `positions` (포지션 기본 정보)
  - `requests` (관련 요청 이력)
  - `discussions`, `messages` (토론 세션 + 메시지)
  - `trading_plans` (매매계획 이력)
  - `team_settings` (AI 사용량)
- **관련 API**:
  - `POST /api/v1/ai/generate-operation-report` — manager_or_admin. AI 운용보고서 생성
  - `GET /api/v1/ai/position-data/{position_id}` — get_current_user. 포지션 전체 데이터 (미리보기용)
- **비즈니스 로직**:
  - **데이터 수집** (`collect_position_data`):
    - 포지션 기본 정보 (종목, 가격, 수량, 상태, 보유기간)
    - 현재 매매계획 (buy_plan, take_profit, stop_loss + 완료 수)
    - 관련 요청 이력 (모든 Request)
    - 의사결정 노트 (모든 DecisionNote)
    - 매매계획 이력 (모든 TradingPlan 버전)
    - 토론 세션 + 메시지 (차트 데이터 포함, 캔들 수 제한)
  - AI 호출 방식은 의사결정서와 동일 (Responses API → Chat Completions fallback)
- **출력 구조** (마크다운):
  1. 포지션 개요
  2. 매매 현황 (진입/현재 평가/청산)
  3. 매매계획 및 실행
  4. 요청 이력
  5. 의사결정 기록
  6. 토론 요약
  7. 종합 평가 (투자 근거 일관성, 계획 대비 실행, 리스크 관리)

---

### 기능 5.3: AI 사용량 제한 (일 3회)

- **설명**: 팀 전체 AI 사용량을 일일 3회로 제한. 의사결정서 + 운용보고서 합산. KST 기준 날짜 변경 시 자동 리셋.
- **관련 DB 테이블**:
  - `team_settings` (ai_daily_limit=3, ai_usage_count, ai_usage_reset_date)
- **관련 API**:
  - `GET /api/v1/ai/status` — get_current_user. 사용 가능 여부 + 남은 횟수
- **비즈니스 로직**:
  - `_reserve_usage()`: Row-level lock으로 원자적 예약
  - 날짜 변경(KST) 시 `ai_usage_count=0`, `ai_usage_reset_date=today`
  - 실패 시 `_rollback_usage()`로 사용량 복원

---

### 기능 5.4: 의사결정서/운용보고서 CRUD

- **설명**: AI 생성 또는 수동 작성된 의사결정서/운용보고서의 조회, 수정, 삭제.
- **관련 DB 테이블**:
  - `decision_notes` (position_id, title, content, blocks, note_type)
- **관련 API**:
  - `GET /api/v1/positions/{position_id}/notes` — get_current_user. 노트 목록
  - `GET /api/v1/positions/{position_id}/notes/{note_id}` — get_current_user. 노트 상세
  - `POST /api/v1/positions/{position_id}/notes` — get_manager. 노트 수동 작성
  - `PATCH /api/v1/positions/{position_id}/notes/{note_id}` — get_manager. 노트 수정
  - `DELETE /api/v1/positions/{position_id}/notes/{note_id}` — get_manager. 노트 삭제
  - `GET /api/v1/reports` — get_current_user. 운용보고서 목록 (포지션별 그룹)
  - `GET /api/v1/reports/operation-reports` — get_current_user. 운용보고서 (note_type='report')
  - `GET /api/v1/reports/decision-notes` — get_current_user. 전체 의사결정서
  - `GET /api/v1/reports/position/{position_id}` — get_current_user. 포지션별 운용보고서
  - `GET /api/v1/reports/positions` — get_current_user. 보고서용 포지션 목록

---

## 도메인 6: 뉴스데스크

### 기능 6.1: 뉴스 수집 (네이버 + yfinance)

- **설명**: 네이버 검색 API와 yfinance로 국내외 뉴스를 자동 수집하여 raw_news 테이블에 저장.
- **관련 DB 테이블**:
  - `raw_news` (source, title, description, link, pub_date, collected_at, keywords JSON, sentiment, newsdesk_date)
- **관련 API**: 직접 API 없음 — 스케줄러(KST 05:30)에서 자동 호출
- **비즈니스 로직**:
  - 네이버 검색 API: 13개 카테고리, 170+ 키워드, 키워드당 10개
    - 카테고리: core, finance, realestate, consumer, labor, entertainment, crypto, ai_semi, ev_mobility, bio_health, energy_infra, macro_policy, bigtech, events
  - yfinance: 8개 해외 티커, 티커당 5개
  - 수집 범위: 어제 전체 + 오늘 새벽 뉴스
  - DB 중복 제거: `link + newsdesk_date` 기준
- **Spring Boot 참고**: `WebClient` (Spring WebFlux) 또는 `RestTemplate`

---

### 기능 6.2: 뉴스데스크 AI 생성

- **설명**: 수집된 원본 뉴스를 AI가 분석하여 칼럼(2개), 뉴스카드(6개), 키워드, 감성분석, 주목종목(3개)을 생성.
- **관련 DB 테이블**:
  - `news_desks` (publish_date, columns JSON, news_cards JSON, keywords JSON, sentiment JSON, top_stocks JSON, status, raw_news_count, generation_count, last_generated_at)
  - `raw_news` (원본 뉴스 조회)
- **관련 API**: 직접 API 없음 — 스케줄러(KST 05:30)에서 자동 호출
- **비즈니스 로직**:
  1. 이미 `status="ready"` 뉴스데스크 존재 → 스킵
  2. `status="generating"`으로 설정
  3. 뉴스 크롤링 (`NewsCrawler.collect_for_morning_briefing`)
  4. 원본 뉴스 최대 50개를 텍스트로 변환
  5. 어제 뉴스데스크 제목 조회 (중복 방지)
  6. AI 호출 (Responses API → Chat Completions fallback)
  7. JSON 응답 파싱 (코드블록 추출, `첫{~마지막}` 추출)
  8. `status="ready"`, `generation_count++`
  9. 실패 시 `status="failed"`, `error_message` 기록
- **콘텐츠 구조** (JSON):
  ```json
  {
    "columns": [{id, title, summary, content, category, keywords, sentiment}],
    "news_cards": [{id, title, summary, content, source, category, keywords, sentiment}],
    "keywords": [{keyword, count, greed_score, category, top_greed, top_fear}],
    "sentiment": {greed_ratio, fear_ratio, overall_score, top_greed, top_fear},
    "top_stocks": [{rank, ticker, name, market, price_change, volume, mention_count, reason, detail, sentiment, related_news}]
  }
  ```

---

### 기능 6.3: 뉴스데스크 조회 (오늘/과거/히스토리)

- **설명**: 오늘의 뉴스데스크, 특정 날짜의 뉴스데스크, 최근 N일 히스토리 조회.
- **관련 DB 테이블**:
  - `news_desks` (publish_date로 조회)
- **관련 API**:
  - `GET /api/v1/newsdesk/today` — get_current_user. 오늘의 뉴스데스크
  - `GET /api/v1/newsdesk/{target_date}` — get_current_user. 특정 날짜 뉴스데스크
  - `GET /api/v1/newsdesk/history` — get_current_user. 최근 N일 뉴스데스크 (`?days=1~30`)
- **비즈니스 로직**:
  - 수동 생성 엔드포인트는 제거됨 (2026-02-10)
  - 뉴스데스크는 스케줄러(KST 05:30)로만 자동 생성

---

### 기능 6.4: 벤치마크 데이터

- **설명**: KOSPI, NASDAQ, S&P500, 펀드 수익률의 시계열 데이터를 기간별로 조회.
- **관련 DB 테이블**:
  - `asset_snapshots` (펀드 수익률 데이터)
- **관련 API**:
  - `GET /api/v1/newsdesk/benchmarks` — get_current_user. 벤치마크 데이터 (`?period=1W|1M|3M|6M|1Y`)
- **비즈니스 로직**:
  - KOSPI/NASDAQ/S&P500: yfinance에서 조회
  - 펀드 수익률: `asset_snapshots` 테이블에서 계산
  - 반환: `{kospi, nasdaq, sp500, fund}` — 각각 `[{time, value}]` 배열

---

## 도메인 7: 시세/차트

### 기능 7.1: 종목 검색

- **설명**: 종목 코드/이름으로 퍼지 검색. 한국/미국/암호화폐 시장 지원.
- **관련 DB 테이블**: 없음 (외부 API + 캐시)
- **관련 API**:
  - `GET /api/v1/prices/search` — get_current_user. 종목 검색 (`?q=&market=&limit=`)
  - `GET /api/v1/prices/lookup` — get_current_user. 종목 코드 조회 (`?ticker=&market=`)
- **비즈니스 로직**:
  - KOSPI/KOSDAQ: PyKRX (전체 종목 목록), 24시간 캐시
  - NASDAQ/NYSE: 인기 종목 25개 + yfinance Search
  - CRYPTO: 정적 리스트 20개
  - 퍼지 매칭: `rapidfuzz` (partial_ratio >= 60)
  - 점수 기준: 정확 매칭(100) > 시작 매칭(90) > 포함(70) > 퍼지(score*0.6)
- **Spring Boot 참고**: Apache Lucene 또는 FuzzyWuzzy Java, `@Cacheable(24시간)`

---

### 기능 7.2: 실시간 시세 조회

- **설명**: 종목의 현재 시세를 조회. 1분 캐시 적용.
- **관련 DB 테이블**: 없음 (외부 API + 캐시)
- **관련 API**:
  - `GET /api/v1/prices/quote` — get_current_user. 단일 시세 (`?ticker=&market=`)
- **비즈니스 로직**:

  | 시장 | 소스 | 캐시 |
  |------|------|------|
  | KOSPI/KOSDAQ | Yahoo Finance (.KS/.KQ 접미사) | 1분 |
  | NASDAQ/NYSE | Yahoo Finance | 1분 |
  | CRYPTO | Binance API (USDT 페어) | 1분 |

- **Spring Boot 참고**: `@Cacheable(value="price", key="#ticker+#market")`, WebClient 비동기

---

### 기능 7.3: 캔들 차트 데이터

- **설명**: OHLCV 캔들 데이터를 시간 프레임별로 조회. lazy loading 지원.
- **관련 DB 테이블**: 없음 (외부 API)
- **관련 API**:
  - `GET /api/v1/prices/candles` — get_current_user. OHLCV 조회 (`?ticker=&market=&timeframe=&limit=&before=`)
- **비즈니스 로직**:
  - 한국/미국: Yahoo Finance (1d, 1w, 1M, 1h)
  - 암호화폐: Binance Klines API (1m~1M)
  - `limit`: 기본 200, 최대 500
  - `before`: Unix timestamp (lazy loading용, 이전 데이터 요청)
  - Yahoo Finance 버그 보정: `Low=0` → `min(Open, Close)`

---

### 기능 7.4: 포지션 평가 (현재가 기반)

- **설명**: 열린 포지션의 현재 시세를 일괄 조회하여 평가액/손익 계산.
- **관련 DB 테이블**:
  - `positions` (열린 포지션 목록)
- **관련 API**:
  - `GET /api/v1/prices/positions` — get_current_user. 열린 포지션 시세
- **비즈니스 로직** (미실현 수익률):
  ```
  unrealized = (current_price * remaining_quantity) - (avg_buy_price * remaining_quantity)
  total_profit_loss = realized_profit_loss + unrealized
  profit_rate = total_profit_loss / total_buy_amount
  ```

---

## 도메인 8: 출석

### 기능 8.1: 출석 체크 (로그인 자동)

- **설명**: 로그인 시 자동 출석 체크 또는 수동 출석 체크인. 방패 자동 소모 로직 포함.
- **관련 DB 테이블**:
  - `attendances` (user_id, date, status, UNIQUE(user_id, date))
  - `users` (attendance_shields)
- **관련 API**:
  - `POST /api/v1/attendance/check-in` — get_writer_user. 출석 체크 (KST)
  - `GET /api/v1/attendance/me` — get_current_user. 내 출석 캘린더 (`?year=&month=`)
  - `GET /api/v1/attendance/me/stats` — get_current_user. 내 출석 통계
  - `GET /api/v1/attendance/user/{user_id}` — get_current_user. 특정 사용자 출석
- **비즈니스 로직**:
  1. 이미 오늘 출석했으면 → "이미 출석 체크되었습니다"
  2. **방패 자동 소모**:
     - 어제 출석 상태가 `absent`이고 `attendance_shields > 0`이면
     - 어제 상태를 `recovered`로 변경
     - `attendance_shields -= 1`
  3. 오늘 출석 레코드 생성 (`status='present'`)
- **출석 상태**: `present`, `absent`, `recovered`, `pending_recovery`

---

### 기능 8.2: 결석 복구 (칼럼 검증 연계)

- **설명**: 칼럼 작성 후 팀장 검증 시 가장 최근 결석을 자동 복구하거나, 직접 칼럼을 제출하여 복구 요청.
- **관련 DB 테이블**:
  - `attendances` (status, recovered_by_column_id, approved_by)
  - `team_columns` (is_verified, verified_by, verified_at, shield_granted)
  - `users` (attendance_shields)
- **관련 API**:
  - `POST /api/v1/columns/{column_id}/verify` — get_manager. 칼럼 검증 (→ 결석 복구)
  - `POST /api/v1/columns/{column_id}/unverify` — get_manager. 검증 취소 (→ 복구 원복)
  - `POST /api/v1/attendance/recover` — get_current_user. 칼럼으로 결석 복구 요청
  - `GET /api/v1/attendance/pending` — get_manager. 복구 대기 목록
  - `POST /api/v1/attendance/{attendance_id}/approve` — get_manager. 복구 승인
  - `POST /api/v1/attendance/{attendance_id}/reject` — get_manager. 복구 거부
- **비즈니스 로직**:
  - **칼럼 검증 시** (본인 칼럼 검증 불가):
    - 결석이 있으면: `status='recovered'`, `recovered_by_column_id=column.id`, `approved_by=검증자`
    - 결석이 없으면 (출석률 100%): `attendance_shields += 1`, `column.shield_granted = true`
  - **검증 취소 시**:
    - 복구된 출석이 있었다면 → `status='absent'`로 되돌림
    - 방패가 적립되었다면 → `attendance_shields -= 1`
  - **칼럼 기반 복구 요청**:
    - 본인 작성 칼럼만 사용 가능
    - 대상 날짜의 출석이 `absent`인 경우만
    - `status='pending_recovery'` → 매니저 승인/거부

---

### 기능 8.3: 방패 시스템

- **설명**: 칼럼 검증 시 결석이 없으면 방패 1개 적립. 결석이 있는 채로 출석 체크인 시 방패 자동 소모하여 어제 결석 복구.
- **관련 DB 테이블**:
  - `users` (attendance_shields)
  - `attendances` (status)
  - `team_columns` (shield_granted)
- **비즈니스 로직**:
  - **적립**: 칼럼 검증 시 결석 없으면 `attendance_shields += 1`
  - **소모**: 출석 체크인 시 어제가 `absent`이고 방패 > 0이면 → 어제 `recovered`, 방패 -1
  - **검증 취소 시**: 적립했던 방패 차감

---

## 도메인 9: 칼럼/댓글

### 기능 9.1: 칼럼 CRUD

- **설명**: 팀원들이 자유롭게 글을 작성. Editor.js 블록 에디터 데이터 지원. 레거시 마크다운 하위 호환.
- **관련 DB 테이블**:
  - `team_columns` (author_id, title, content, blocks JSON, is_verified, verified_by, verified_at, shield_granted)
- **관련 API**:
  - `GET /api/v1/columns` — get_current_user. 칼럼 목록 (`?skip=&limit=&author_id=&verified=`)
  - `GET /api/v1/columns/{column_id}` — get_current_user. 칼럼 상세
  - `POST /api/v1/columns` — get_writer_user. 칼럼 작성
  - `PUT /api/v1/columns/{column_id}` — get_writer_user. 칼럼 수정 (작성자만)
  - `DELETE /api/v1/columns/{column_id}` — get_writer_user. 칼럼 삭제 (작성자/매니저)
- **비즈니스 로직**:
  - `blocks`: Editor.js 블록 형식 (PostgreSQL JSON)
  - `content`: 레거시 마크다운 (하위 호환)
  - 수정: 작성자만 가능
  - 삭제: 작성자 또는 매니저

---

### 기능 9.2: 칼럼 검증 (팀장)

- **설명**: 팀장이 칼럼 품질을 검증하여 파란 체크 부여. 검증 시 결석 복구 또는 방패 적립 연동.
- **관련 DB 테이블**:
  - `team_columns` (is_verified, verified_by, verified_at, shield_granted)
  - `attendances` (결석 복구)
  - `users` (attendance_shields)
- **관련 API**:
  - `POST /api/v1/columns/{column_id}/verify` — get_manager. 칼럼 검증
  - `POST /api/v1/columns/{column_id}/unverify` — get_manager. 검증 취소
- **비즈니스 로직**: (기능 8.2 참조)
  - 본인 칼럼 검증 불가
  - 검증 시: 결석 복구 (있으면) 또는 방패 적립 (없으면)
  - 취소 시: 복구/적립 원복

---

### 기능 9.3: 댓글 시스템 (다형성)

- **설명**: 다양한 문서 타입에 대한 댓글. `document_type + document_id`로 다형성 참조.
- **관련 DB 테이블**:
  - `comments` (user_id, document_type, document_id, content)
- **관련 API**:
  - `GET /api/v1/comments` — get_current_user. 댓글 목록 (`?document_type=&document_id=&skip=&limit=`)
  - `POST /api/v1/comments` — get_current_user. 댓글 작성 (viewer 포함 가능)
  - `PUT /api/v1/comments/{comment_id}` — get_current_user. 댓글 수정 (작성자만)
  - `DELETE /api/v1/comments/{comment_id}` — get_current_user. 댓글 삭제 (작성자/매니저)
- **비즈니스 로직**:
  - `document_type` 허용값: `decision_note`, `report`, `column`, `ai_column`, `news`
  - `content`: 최소 1자, 최대 2000자
  - 수정: 작성자만
  - 삭제: 작성자 또는 매니저
- **Spring Boot 참고**: `created_at`이 KST(Asia/Seoul)로 저장됨 — 타임존 통일 필요

---

## 도메인 10: 알림

### 기능 10.1: 알림 발송 (DB + WebSocket + Push)

- **설명**: 비즈니스 이벤트 발생 시 3채널로 알림 발송. DB 저장, WebSocket 실시간 전송, Web Push 브라우저 알림.
- **관련 DB 테이블**:
  - `notifications` (user_id, notification_type, title, message, related_type, related_id, is_read)
  - `push_subscriptions` (endpoint, p256dh, auth)
- **관련 API**: 직접 API 없음 — `NotificationService` 내부에서 자동 호출
- **비즈니스 로직**:
  - **알림 발송 조건**:

    | 이벤트 | notification_type | 수신자 | 제목 패턴 |
    |--------|-------------------|--------|-----------|
    | 새 매수/매도 요청 | `new_request` | 모든 매니저/어드민 | "{이름}님이 {종목} 매수/매도 요청을 제출했습니다" |
    | 요청 승인 | `request_approved` | 요청자 | "{종목} 매수 요청이 승인되었습니다" |
    | 요청 거부 | `request_rejected` | 요청자 | "{종목} 매수 요청이 거부되었습니다" + 거부 사유 |
    | 토론 개시 | `discussion_opened` | 요청자 | "토론이 시작되었습니다: {제목}" |
    | 토론 요청 | `discussion_requested` | 모든 매니저/어드민 | "{이름}님이 {종목} 관련 토론을 요청했습니다" |
    | 가입 승인 요청 | `user_pending_approval` | 모든 매니저/어드민 | "{이름}님이 가입 승인을 요청했습니다" |
    | 토론 재개 요청 | `reopen_requested` | 모든 매니저/어드민 | - |
    | 조기종료 요청 | `early_close_requested` | 모든 매니저/어드민 | - |

  - **채널 1: DB 저장** — `Notification` 레코드 생성
  - **채널 2: WebSocket** (best-effort) — `manager.send_personal_message()`, 이벤트 루프 접근 실패 시 무시
    ```json
    {"type": "notification", "data": {id, notification_type, title, message, related_type, related_id, is_read, created_at}}
    ```
  - **채널 3: Web Push** (best-effort) — `pywebpush`, VAPID 인증, 만료 구독 자동 정리 (410 Gone/404 → 삭제)
  - **Push URL 결정 로직**:
    - `related_type="position"` → `/positions/{id}`
    - `related_type="discussion"` → `/discussions/{id}`
    - `user_pending_approval` → `/team`
    - 기본 → `/notifications`

---

### 기능 10.2: Web Push 구독/해제

- **설명**: 브라우저의 Web Push 구독 정보(VAPID)를 등록/해제. 구독 시 같은 endpoint이면 업데이트.
- **관련 DB 테이블**:
  - `push_subscriptions` (user_id, endpoint UNIQUE, p256dh, auth)
- **관련 API**:
  - `GET /api/v1/notifications/vapid-key` — 비인증. VAPID 공개키 조회
  - `POST /api/v1/notifications/push/subscribe` — get_current_user. Push 구독
  - `POST /api/v1/notifications/push/unsubscribe` — get_current_user. Push 구독 해제
- **비즈니스 로직**:
  - `subscribe`: 같은 endpoint이면 업데이트 (기기 변경 등)
  - `unsubscribe`: `user_id + endpoint`로 삭제
- **Spring Boot 참고**: web-push Java 라이브러리 또는 Firebase Cloud Messaging

---

### 기능 10.3: 알림 관리 (읽음/삭제)

- **설명**: 알림 목록 조회, 선택/전체 읽음 처리, 개별/전체 삭제.
- **관련 DB 테이블**:
  - `notifications` (is_read)
- **관련 API**:
  - `GET /api/v1/notifications` — get_current_user. 알림 목록 (`?unread_only=&limit=&offset=`)
  - `GET /api/v1/notifications/unread-count` — get_current_user. 미읽음 수
  - `PATCH /api/v1/notifications/read` — get_current_user. 선택 읽음 처리
  - `PATCH /api/v1/notifications/read-all` — get_current_user. 전체 읽음 처리
  - `DELETE /api/v1/notifications/{notification_id}` — get_current_user. 알림 삭제
  - `DELETE /api/v1/notifications` — get_current_user. 전체 알림 삭제

---

## 도메인 11: 통계/자산

### 기능 11.1: 개인 통계

- **설명**: 사용자별 매매 실적 통계 — 포지션 수, 수익률, 승률 등.
- **관련 DB 테이블**:
  - `positions` (사용자별 포지션 집계)
  - `requests` (요청 이력)
- **관련 API**:
  - `GET /api/v1/stats/users/{user_id}` — get_current_user. 개인 통계
- **비즈니스 로직**:
  - 총 포지션 수, 오픈/클로즈 포지션, 평균 수익률, 총 수익, 승률, 승/패 거래 수

---

### 기능 11.2: 팀 통계

- **설명**: 팀 전체의 자산 현황, 포지션 현황, 수익률 통계. 실시간 시세 포함.
- **관련 DB 테이블**:
  - `positions` (팀 전체 포지션 집계)
  - `team_settings` (초기 자본금)
  - `asset_snapshots` (일별 스냅샷)
- **관련 API**:
  - `GET /api/v1/stats/team` — get_current_user. 팀 통계 (`?start_date=&end_date=`)
  - `GET /api/v1/stats/exchange-rate` — get_current_user. 환율 조회 (yfinance)

---

### 기능 11.3: 팀원 랭킹

- **설명**: 팀원별 수익률, 포지션 수, 승률, 출석률 등을 종합한 랭킹.
- **관련 DB 테이블**:
  - `users`, `positions`, `attendances`
- **관련 API**:
  - `GET /api/v1/stats/team-ranking` — get_current_user. 팀원 랭킹
- **비즈니스 로직**:
  - 랭킹 필드: `avg_profit_rate`, `total_profit`, `position_count`, `total_trades`, `win_rate`, `winning_trades`, `losing_trades`, `open_positions`, `closed_positions`, `week_attendance_rate`, `month_attendance_rate`, `total_attendance_rate`
  - `role_priority`: 역할별 우선순위 정렬

---

### 기능 11.4: 자산 스냅샷

- **설명**: 팀 전체 자산의 일별 스냅샷 자동 생성. KRW/USD/USDT별 현금+평가액, 합산, 손익 추적.
- **관련 DB 테이블**:
  - `asset_snapshots` (snapshot_date UNIQUE, krw_cash, krw_evaluation, usd_cash, usd_evaluation, usdt_evaluation, total_krw, exchange_rate, realized_pnl, unrealized_pnl, position_details JSON)
  - `positions` (열린 포지션 현재가 조회)
  - `team_settings` (초기 자본금)
- **관련 API**:
  - `POST /api/v1/stats/asset-snapshot` — get_manager. 수동 스냅샷 생성
  - `GET /api/v1/stats/asset-snapshot/{date}` — get_current_user. 특정 날짜 스냅샷 상세
- **비즈니스 로직** (`create_daily_snapshot_async`):
  1. 이미 오늘 스냅샷 존재 → 반환
  2. `team_settings`에서 초기자본(KRW, USD) 조회
  3. 열린 포지션 순회:
     - 현재가 조회 (실패 시 매입가 대체)
     - 마켓별 분류: KRX→KRW, NASDAQ/NYSE→USD, CRYPTO→USDT
     - 평가액 = 현재가 * 수량
  4. 현금 = 초기자본 - 투자금액
  5. 종료 포지션 실현손익 합계
  6. 미실현손익 = 평가액 합 - 투자금 합
  7. 환율 하드코딩: 1 USD = 1,350 KRW
  8. 전체 KRW 환산 = KRW(현금+평가) + USD(현금+평가)*환율 + USDT*환율
- **알림/부수효과**:
  - KST 09:00 스케줄러에서 자동 생성

---

### 기능 11.5: 자산 히스토리

- **설명**: 자산 스냅샷의 시계열 데이터를 기간별로 조회.
- **관련 DB 테이블**:
  - `asset_snapshots` (기간별 조회)
- **관련 API**:
  - `GET /api/v1/stats/asset-history` — get_current_user. 자산 히스토리 (`?period=1w|1m|3m|all&start_date=`)

---

## 도메인 12: 팀 설정

### 기능 12.1: 자본금 관리

- **설명**: 팀의 초기 자본금(KRW/USD) 설정/수정. 싱글톤 패턴 (1행).
- **관련 DB 테이블**:
  - `team_settings` (initial_capital_krw, initial_capital_usd, description)
- **관련 API**:
  - `GET /api/v1/positions/settings/team` — get_current_user. 팀 설정 조회
  - `PUT /api/v1/positions/settings/team` — get_manager. 팀 설정 수정
- **비즈니스 로직**:
  - `team_settings` 테이블은 1행만 존재 (싱글톤)
  - `initial_capital_krw`: 원화 초기 자본금
  - `initial_capital_usd`: 달러 초기 자본금
- **Spring Boot 참고**: 싱글톤 → Spring 캐싱 전략 수립

---

### 기능 12.2: 환전

- **설명**: KRW ↔ USD 환전 기록. 환전 이력을 JSON 배열에 추적.
- **관련 DB 테이블**:
  - `team_settings` (initial_capital_krw, initial_capital_usd, exchange_history JSON)
- **관련 API**:
  - `POST /api/v1/positions/settings/team/exchange` — get_manager. 환전 (KRW↔USD)
- **비즈니스 로직**:
  - `from_currency`, `to_currency`, `from_amount`, `to_amount`, `exchange_rate`, `memo`
  - `exchange_history` JSON 배열에 환전 기록 추가:
    ```json
    {"from_currency": "KRW", "to_currency": "USD", "from_amount": 1300000, "to_amount": 1000, "exchange_rate": 1300, "memo": "...", "user_id": 1, "user_name": "홍길동"}
    ```
  - `initial_capital_krw` 차감, `initial_capital_usd` 증가 (또는 반대)

---

## 도메인 13: 파일 업로드

### 기능 13.1: 이미지 업로드

- **설명**: 이미지 파일 업로드 (최대 10MB). Editor.js, 토론 등에서 사용.
- **관련 DB 테이블**: 없음 (로컬 파일 시스템)
- **관련 API**:
  - `POST /api/v1/uploads/image` — get_current_user. 이미지 업로드 (multipart)
  - `GET /api/v1/uploads/files/{filename}` — 비인증. 파일 조회
- **비즈니스 로직**:
  - 최대 파일 크기: 10MB
  - 허용 MIME: image/jpeg, image/png, image/gif, image/webp
  - 반환: `{url, filename, size, content_type}`
- **Spring Boot 참고**: `MultipartFile` + S3 또는 로컬 저장

---

### 기능 13.2: 디스크 사용량

- **설명**: 업로드된 파일의 총 디스크 사용량 조회.
- **관련 DB 테이블**: 없음 (파일 시스템 조회)
- **관련 API**:
  - `GET /api/v1/uploads/disk-usage` — get_current_user. 디스크 사용량
- **비즈니스 로직**:
  - 반환: `{total_size, file_count, formatted_size}`

---

## 도메인 14: WebSocket 실시간 통신

### 기능 14.1: WebSocket 연결/해제

- **설명**: JWT 토큰으로 인증된 WebSocket 연결. 다중 탭 지원 (사용자당 여러 WebSocket).
- **관련 DB 테이블**: 없음 (인메모리 상태)
- **관련 API**:
  - `ws://<host>/ws?token=<access_token>` — WebSocket 연결
- **비즈니스 로직**:
  - Query parameter로 JWT access token 전달
  - 인증 실패: WebSocket close code 4001
  - 연결 관리:
    - `active_connections`: `Dict[user_id, List[WebSocket]]` (다중 탭)
    - `discussion_rooms`: `Dict[discussion_id, Set[user_id]]`
    - `price_subscriptions`: `Dict[ticker, Set[user_id]]`
  - 해제 시: 모든 토론방 + 가격 구독에서 자동 제거
- **Spring Boot 참고**: STOMP over SockJS, `ChannelInterceptor`로 토큰 인증

### 기능 14.2: 클라이언트 → 서버 이벤트

| 이벤트 | 페이로드 | 설명 |
|--------|----------|------|
| `join_discussion` | `{discussion_id: int}` | 토론방 입장 → 다른 참여자에게 `user_joined` 브로드캐스트 |
| `leave_discussion` | `{discussion_id: int}` | 토론방 퇴장 → `user_left` 브로드캐스트 |
| `send_message` | `{discussion_id, content, message_type?, chart_data?}` | DB 저장 → `message_received` / `message_sent` |
| `subscribe_price` | `{ticker: str}` | 시세 구독 |
| `unsubscribe_price` | `{ticker: str}` | 시세 구독 해제 |

### 기능 14.3: 서버 → 클라이언트 이벤트

| 이벤트 | 페이로드 | 수신 대상 |
|--------|----------|----------|
| `user_joined` | `{discussion_id, user_id}` | 같은 토론방 (발신자 제외) |
| `user_left` | `{discussion_id, user_id}` | 같은 토론방 |
| `message_received` | `{id, discussion_id, user, content, message_type, chart_data, created_at}` | 같은 토론방 (발신자 제외) |
| `message_sent` | (message_received와 동일) | 발신자 본인 |
| `price_update` | 시세 데이터 dict | 해당 ticker 구독자 |
| `notification` | `{id, notification_type, title, message, related_type, related_id, is_read, created_at}` | 해당 사용자 |

### Spring Boot STOMP 매핑

```
join_discussion  → @SubscribeMapping("/discussion/{id}")
send_message     → @MessageMapping("/discussion/{id}/message") → @SendTo("/topic/discussion/{id}")
subscribe_price  → @SubscribeMapping("/prices/{ticker}")
price_update     → messagingTemplate.convertAndSend("/topic/prices/{ticker}", data)
notification     → messagingTemplate.convertAndSendToUser(userId, "/queue/notifications", data)
```

---

## 도메인 15: 스케줄러/백그라운드 작업

### 기능 15.1: 뉴스데스크 자동 생성

- **설명**: 매일 KST 05:30에 뉴스 수집 + AI 분석 + 뉴스데스크 생성을 자동 실행.
- **관련 DB 테이블**: `raw_news`, `news_desks`
- **스케줄**: `CronTrigger(hour=5, minute=30, timezone=kst)`
- **비즈니스 로직**: (기능 6.1, 6.2 참조)
- **Spring Boot 참고**: `@Scheduled(cron = "0 30 5 * * *", zone = "Asia/Seoul")`

### 기능 15.2: 자산 스냅샷 자동 생성

- **설명**: 매일 KST 09:00에 열린 포지션의 현재가를 조회하여 일별 자산 스냅샷 생성.
- **관련 DB 테이블**: `asset_snapshots`, `positions`, `team_settings`
- **스케줄**: `CronTrigger(hour=9, minute=0, timezone=kst)`
- **비즈니스 로직**: (기능 11.4 참조)
- **Spring Boot 참고**: `@Scheduled(cron = "0 0 9 * * *", zone = "Asia/Seoul")`

---

---

## 미래 확장 도메인 (FUTURE_FEATURES.md 기반)

> 구현 순서: F1(B) → F2(C) → F3(D) → F4(E) → F5(F) → F6(G)

---

## 도메인 F1: 세션/기수 관리 (FUTURE_FEATURES.md B항)

### 기능 F1.1: 기수(세션) 생성/관리

- **설명**: 펀드팀을 기수 단위(32기, 33기 등)로 운영. 각 기수의 시작일, 종료일, 초기 자본금, 상태를 관리.
- **관련 DB 테이블**:
  - `fund_sessions` (신규): generation_number UNIQUE, start_date, end_date, initial_capital_krw, initial_capital_usd, status
- **관련 API**:
  - `POST /api/v1/sessions` — manager. 기수 생성
  - `GET /api/v1/sessions` — get_current_user. 기수 목록
  - `GET /api/v1/sessions/active` — get_current_user. 현재 활성 기수
  - `GET /api/v1/sessions/{session_id}` — get_current_user. 기수 상세
  - `PATCH /api/v1/sessions/{session_id}` — manager. 기수 수정
  - `POST /api/v1/sessions/{session_id}/close` — manager. 기수 종료
  - `GET /api/v1/sessions/{session_id}/stats` — get_current_user. 기수별 통계
- **비즈니스 로직**:
  - `status`: `active` → `transitioning` → `closed`
  - 동시에 활성 기수 1개만 가능 (또는 transitioning 중 2개)
  - 기수 종료 시 자본금 재계산

---

### 기능 F1.2: 기수 승계 (팀장 이전)

- **설명**: 현 기수에서 다음 기수로 팀 운영을 이전. 인원 승인, 역할 위임, 전관예우 처리.
- **관련 DB 테이블**:
  - `fund_sessions` (status='transitioning')
  - `users` (session_id FK, role 변경)
- **관련 API**:
  - `POST /api/v1/sessions/{session_id}/transition` — manager. 승계 시작
  - `POST /api/v1/sessions/{session_id}/complete-transition` — manager. 승계 완료
- **비즈니스 로직** (승계 플로우):
  1. 32기 팀장이 33기 인원 회원가입 승인
  2. 33기 인원은 `member` 역할로 시작
  3. 32기 팀장이 33기 중 한 명에게 `manager` 위임
  4. 32기 팀장 본인은 `viewer` (전관예우) 또는 `admin`으로 변경
  5. 승계 완료 시 자본금 재계산
  - **미결 사항**: 승계 중 포지션 처리 (자동 청산 vs 승계)

---

### 기능 F1.3: 자본 변동 기록

- **설명**: 기수별 자본 변동(입금, 출금, 대출, 투자 등)을 추적.
- **관련 DB 테이블**:
  - `capital_transactions` (신규): session_id FK, transaction_type, amount, currency, description, executed_by, executed_at
- **관련 API**:
  - `POST /api/v1/capital-transactions` — manager. 자본 변동 기록
  - `GET /api/v1/capital-transactions` — get_current_user. 자본 변동 이력
- **비즈니스 로직**:
  - `transaction_type`: deposit, withdrawal, loan, investment 등
  - `currency`: KRW, USD

---

### 기능 F1.4: 전관예우 (과거 기수 열람)

- **설명**: 이전 기수 멤버들을 `viewer` 권한으로 변경. 과거/현재 데이터 읽기만 가능, 수정/삭제 불가.
- **관련 DB 테이블**:
  - `users` (role='viewer')
- **비즈니스 로직**:
  - `viewer` 역할: 읽기 전용 (`get_writer_user` 의존성에서 차단)
  - 과거 기수의 통계는 별도 조회 가능해야 함

---

## 도메인 F2: 멀티테넌시 (FUTURE_FEATURES.md C항)

### 기능 F2.1: 팀(테넌트) 생성/관리

- **설명**: 여러 대학 펀드팀을 독립 테넌트로 운영. 팀 코드 발급, 초대, 관리.
- **관련 DB 테이블**:
  - `teams` (신규): code UNIQUE, name, is_active, created_by
  - `users`: `team_id` FK 추가
- **관련 API**:
  - `POST /api/v1/teams` — super_admin. 팀 생성
  - `GET /api/v1/teams` — super_admin. 팀 목록
  - `GET /api/v1/teams/{team_id}` — super_admin. 팀 상세
  - `PATCH /api/v1/teams/{team_id}` — super_admin. 팀 수정
  - `POST /api/v1/teams/{team_id}/invite` — super_admin. 초대 코드 발급
  - `POST /api/v1/teams/join` — 비인증. 초대 코드로 가입
- **비즈니스 로직**:
  - 관리자 발급 방식 (계약 기반)
  - `UserRole`에 `SUPER_ADMIN` 추가 (모든 팀 관리)

---

### 기능 F2.2: 데이터 격리

- **설명**: 모든 주요 테이블에 `team_id`를 추가하여 팀 간 데이터를 완전 격리.
- **관련 DB 테이블** (team_id 추가 대상):
  - `positions`, `requests`, `discussions`, `team_settings`, `attendances`, `team_columns`, `decision_notes`, `asset_snapshots`
- **비즈니스 로직**:
  - 모든 쿼리에 `current_user.team_id` 자동 필터링
  - API 미들웨어/dependency에서 팀 격리 강제
- **Spring Boot 참고**: Hibernate Filter 또는 커스텀 Repository에서 `@Query`에 team_id 조건 자동 추가

---

## 도메인 F3: 뉴스데스크 공유 캐시 (FUTURE_FEATURES.md D항)

### 기능 F3.1: 공유 뉴스데스크 캐시

- **설명**: 뉴스데스크 AI 분석 결과를 팀 간 공유. 한 팀이 생성하면 다른 팀은 AI 호출 없이 즉시 열람.
- **관련 DB 테이블**:
  - `shared_news_desks` (기존 `news_desks` 리네임): publish_date UNIQUE, 뉴스데스크 데이터, created_by_team_id
  - `team_newsdesk_accesses` (신규): team_id, shared_newsdesk_id, accessed_at, was_cached
- **관련 API**:
  - `GET /api/v1/newsdesk/shared/available-dates` — get_current_user. 열람 가능 날짜 목록
  - `POST /api/v1/newsdesk/shared/request/{date}` — get_current_user. 과거 뉴스데스크 열람 요청
- **비즈니스 로직** (캐시 플로우):
  ```
  팀에서 뉴스데스크 요청
    → SharedNewsDesk에 해당 날짜 존재?
      → YES: 캐시 히트! 즉시 반환 + TeamNewsDeskAccess 기록
      → NO: 7일 이내? → 크롤링 + AI 생성 + SharedNewsDesk 저장
                         7일 초과? → "해당 날짜의 뉴스데스크가 존재하지 않습니다"
  ```

---

### 기능 F3.2: 과거 뉴스데스크 열람 (AI 생성 연출)

- **설명**: 과거 날짜의 뉴스데스크를 "AI 생성 요청" UI로 열람. 실제로는 캐시 조회이지만 로딩 UI 연출.
- **관련 DB 테이블**:
  - `shared_news_desks` (기존 데이터 조회)
  - `team_newsdesk_accesses` (팀별 접근 기록)
- **비즈니스 로직**:
  - 달력에서 `SharedNewsDesk`에 존재하는 날짜만 선택 가능
  - "뉴스데스크 생성하기" 버튼 → 프로그레스 바 연출 → 실제: SharedNewsDesk 조회 + Access 기록
  - 하루 3회 제한 (`plan_type`에 따라 변동)
  - 이후 해당 날짜는 재요청 없이 즉시 열람 가능

---

### 기능 F3.3: 뉴스데스크 구독 관리

- **설명**: 팀별 뉴스데스크 구독 상태 관리. 미구독/Basic/Premium 플랜.
- **관련 DB 테이블**:
  - `team_newsdesk_subscriptions` (신규): team_id UNIQUE, is_active, plan_type, daily_past_request_limit, activated_at, expires_at
- **관련 API**:
  - `GET /api/v1/newsdesk/subscription` — manager. 팀 구독 상태
  - `POST /api/v1/newsdesk/subscription` — manager. 구독 활성화
  - `DELETE /api/v1/newsdesk/subscription` — manager. 구독 해지
- **비즈니스 로직**:

  | 플랜 | 매일 자동 갱신 | 과거 열람 | 가격 |
  |------|-------------|---------|------|
  | 미구독 | X | X | 무료 |
  | Basic | O | 하루 3회 | 월 N원 |
  | Premium | O | 무제한 | 월 N원 |

---

## 도메인 F4: 커뮤니티 허브 (FUTURE_FEATURES.md E항)

### 기능 F4.1: 팀 간 리더보드

- **설명**: 팀별 수익률, 샤프지수, MDD를 비교하는 랭킹. 공개 동의한 팀만 노출.
- **관련 DB 테이블**:
  - `teams`, `positions`, `asset_snapshots`
- **관련 API**:
  - `GET /api/v1/community/leaderboard` — get_current_user. 팀 랭킹
- **비즈니스 로직**:
  - 기간 선택: 월/분기/연/기수 전체
  - 지표: 수익률, 샤프지수, 최대 낙폭(MDD)
  - 공개 동의한 팀만 노출 (팀 설정에서 공개/비공개 선택)

---

### 기능 F4.2: 게시판 (공개 커뮤니티)

- **설명**: 팀이 운용보고서, 칼럼, 분석리포트 등을 공개 게시. 유료 콘텐츠 지원 (마켓 연동).
- **관련 DB 테이블**:
  - `posts` (신규): team_id, category, title, content, is_premium, price_credits, view_count, tags JSON
  - `post_comments` (신규): post_id, author_team_id, author_user_id, content
- **관련 API**:
  - `GET /api/v1/community/posts` — get_current_user. 게시글 목록
  - `POST /api/v1/community/posts` — get_writer_user. 게시글 작성
  - `GET /api/v1/community/posts/{post_id}` — get_current_user. 게시글 상세
  - `POST /api/v1/community/posts/{post_id}/comments` — get_current_user. 댓글 작성
- **비즈니스 로직**:
  - `category`: 운용보고서 / 칼럼 / 분석리포트 / 자유 / 공지
  - `is_premium`: 유료 콘텐츠 여부 (F5 크레딧, F6 마켓 연동)
  - 댓글: 팀 단위 작성 (익명성 보호)

---

### 기능 F4.3: 팀 간 DM

- **설명**: 팀 단위의 직접 메시지. 팀장/부팀장만 발신 가능.
- **관련 DB 테이블**:
  - `team_messages` (신규): sender_team_id, receiver_team_id, sender_user_id, content, is_read
- **관련 API**:
  - `GET /api/v1/community/team-messages` — manager. 팀 간 DM 목록
  - `POST /api/v1/community/team-messages` — manager. 팀 간 DM 발송
- **비즈니스 로직**:
  - 발신: 팀장/부팀장만 가능 (스팸 방지)
  - 수신: 채널에서 팀 멤버 전원 확인 가능
  - 용도: 교류전, 스터디 제안, 정보 공유

---

## 도메인 F5: 크레딧 시스템 (FUTURE_FEATURES.md F항)

### 기능 F5.1: 크레딧 잔액/거래내역 조회

- **설명**: 팀의 크레딧 보유량, 누적 획득/사용량, 거래 내역을 조회.
- **관련 DB 테이블**:
  - `credit_accounts` (신규): team_id UNIQUE, balance_credits, total_earned, total_spent
  - `credit_transactions` (신규): team_id, transaction_type, amount_credits, amount_krw, reference_id, reference_type, description
- **관련 API**:
  - `GET /api/v1/credits/balance` — manager. 크레딧 잔액 조회
  - `GET /api/v1/credits/transactions` — manager. 거래 내역

---

### 기능 F5.2: 크레딧 구매

- **설명**: 현금으로 크레딧을 구매. PG사 연동 필요.
- **관련 DB 테이블**:
  - `credit_accounts` (balance_credits 증가)
  - `credit_transactions` (transaction_type='purchase', amount_credits, amount_krw)
- **관련 API**:
  - `POST /api/v1/credits/purchase` — manager. 크레딧 구매 (PG 연동)
- **비즈니스 로직**:
  - 구매 플랜: 10,000원→100크레딧 / 50,000원→550크레딧(+50 보너스) / 100,000원→1,200크레딧(+200 보너스)
  - PG사 연동 필요 (토스페이먼츠, 아임포트 등)

---

### 기능 F5.3: 크레딧 사용/적립

- **설명**: 콘텐츠 구매 시 크레딧 차감, 콘텐츠 판매 시 크레딧 적립.
- **관련 DB 테이블**:
  - `credit_accounts` (balance_credits, total_earned, total_spent)
  - `credit_transactions` (transaction_type='spend'/'earn')
- **관련 API**:
  - `POST /api/v1/credits/spend` — manager. 크레딧 사용
  - `POST /api/v1/credits/subscription-payment` — manager. 구독료 크레딧 결제
- **비즈니스 로직** (순환 구조):
  ```
  현금 → 크레딧 구매
    → 콘텐츠/포트폴리오 구매 (크레딧 차감)
      → 판매 팀 크레딧 적립
        → 구독료 결제로 재사용 가능
  ```

---

## 도메인 F6: 콘텐츠 마켓플레이스 (FUTURE_FEATURES.md G항)

### 기능 F6.1: 마켓 탐색/구매

- **설명**: 팀이 생산한 지식 자산(포트폴리오, 운용보고서, 칼럼)을 크레딧으로 거래하는 P2P 마켓.
- **관련 DB 테이블**:
  - `content_purchases` (신규): buyer_team_id, seller_team_id, content_type, content_id, price_credits, purchased_at, expires_at
- **관련 API**:
  - `GET /api/v1/marketplace/listings` — get_current_user. 마켓 목록 (필터/정렬)
  - `GET /api/v1/marketplace/listings/{listing_id}` — get_current_user. 상품 상세
  - `POST /api/v1/marketplace/purchase` — manager. 콘텐츠 구매
  - `GET /api/v1/marketplace/my-purchases` — get_current_user. 구매 내역
  - `GET /api/v1/marketplace/my-sales` — manager. 판매 내역
- **비즈니스 로직**:
  - `content_type`: post / portfolio_access / subscription
  - 수익 정산: 공급 팀 80% 크레딧 적립 / 운영사 20% (플랫폼 수수료)
  - 탐색: 카테고리 필터, 인기순/최신순/가격순/리뷰순 정렬

---

### 기능 F6.2: 칼럼 구독

- **설명**: 특정 팀의 칼럼을 월/분기/연 단위로 구독. 자동 갱신 지원.
- **관련 DB 테이블**:
  - `content_subscriptions` (신규): subscriber_team_id, publisher_team_id, plan, price_credits_per_period, auto_renew, started_at, next_billing_at, cancelled_at
- **관련 API**:
  - `POST /api/v1/marketplace/subscriptions` — manager. 칼럼 구독
  - `DELETE /api/v1/marketplace/subscriptions/{sub_id}` — manager. 구독 취소
- **비즈니스 로직**:
  - `plan`: monthly / quarterly / annual
  - `auto_renew`: 자동 갱신 여부
  - 구독 중 신규 칼럼은 자동 열람 가능
  - 구독 취소 시 만료일까지 유지

---

### 기능 F6.3: 포트폴리오 열람권

- **설명**: 다른 팀의 현재 포트폴리오(보유 종목, 비중, 평단가)를 열람할 수 있는 권한을 구매.
- **관련 DB 테이블**:
  - `portfolio_accesses` (신규): buyer_team_id, seller_team_id, access_type, price_credits, include_realtime, granted_at, expires_at
- **관련 API**:
  - `GET /api/v1/marketplace/portfolio-access/{team_id}` — get_current_user. 포트폴리오 열람
- **비즈니스 로직**:
  - `access_type`: one_time (1회) / monthly (월 구독)
  - `include_realtime`: 실시간 업데이트 포함 여부
  - 공급 팀이 공개 동의한 항목만 노출
  - 가격: 공급 팀이 직접 책정

---

## 부록: 인증 레벨 총정리

| 레벨 | 의존성 함수 | 허용 역할 | 사용 도메인 |
|------|-----------|----------|------------|
| 비인증 | 없음 | - | 회원가입, 로그인, 토큰 갱신, VAPID 키, 파일 조회, 헬스체크 |
| `get_current_user` | HTTPBearer | manager, admin, member, viewer | 목록/상세 조회, 알림, 통계, 시세 |
| `get_writer_user` | get_current_user | manager, admin, member | 요청 생성, 메시지 전송, 칼럼 작성, 매매계획 |
| `get_manager_or_admin` | get_current_user | manager, admin | 요청 승인/거부, 포지션 종료, AI 생성, 사용자 승인 |
| `get_manager` | get_current_user | manager | 역할 변경, 칼럼 검증, 출석 복구, 팀장 이전, 팀 설정 |
| `super_admin` | (미래) | super_admin | 팀 생성/관리 (멀티테넌시) |
