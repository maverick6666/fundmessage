# 펀드메신저 API 명세서
> Spring Boot 리팩토링 참조 문서 | 작성일: 2026-02-18

---

## Part 1: 개요

### 1.1 기본 정보
| 항목 | 값 |
|------|-----|
| Base URL | `/api/v1` |
| 인증 방식 | JWT Bearer Token (`Authorization: Bearer <token>`) |
| WebSocket | `ws://<host>/ws?token=<access_token>` |
| 응답 래퍼 | `APIResponse { success: bool, data: Any?, message: str }` |
| 에러 래퍼 | `ErrorResponse { success: false, error: { code, message, details? } }` |
| 페이지네이션 | page/limit (기본), skip/limit (일부 엔드포인트) |

### 1.2 인증 레벨 요약
| 레벨 | Dependency | 설명 | 허용 역할 |
|------|-----------|------|----------|
| 비인증 | 없음 | 인증 불필요 | - |
| `get_current_user` | HTTPBearer | 활성 사용자 | manager, admin, member, viewer |
| `get_writer_user` | get_current_user | viewer 제외 | manager, admin, member |
| `get_manager_or_admin` | get_current_user | 팀장 또는 관리자 | manager, admin |
| `get_manager` | get_current_user | 팀장만 | manager |

### 1.3 사용자 역할 (UserRole Enum)
| 값 | 설명 |
|----|------|
| `manager` | 팀장 (1명만 존재, 모든 권한) |
| `admin` | 관리자 (팀장 위임 후 이전 팀장) |
| `member` | 팀원 (매매 요청, 칼럼 작성, 토론 참여) |
| `viewer` | 뷰어 (읽기 전용, 전관예우) |

### 1.4 CORS 허용 Origin
- `http://localhost`
- `http://localhost:5173`
- `http://localhost:3000`
- `https://fundmessage.vercel.app`

---

## Part 2: 현재 구현된 API 엔드포인트

### 2.1 Auth (`/api/v1/auth`)

| 메서드 | 경로 | 인증 | 요청 바디/파라미터 | 응답 data | 설명 |
|--------|------|------|-------------------|-----------|------|
| POST | `/auth/send-verification` | 비인증 | `SendVerificationRequest` | - | 이메일 인증 코드 발송 |
| POST | `/auth/verify-code` | 비인증 | `VerifyCodeRequest` | - | 이메일 인증 코드 확인 |
| POST | `/auth/signup` | 비인증 | `SignupRequest` | `SignupResponse` | 회원가입 (201) |
| POST | `/auth/login` | 비인증 | `LoginRequest` | `Token` | 로그인 + 자동 출석 체크 |
| POST | `/auth/refresh` | 비인증 | `RefreshRequest` | `TokenRefreshResponse` | Access Token 갱신 |
| POST | `/auth/register` | manager_or_admin | `UserCreate` | `{ user: UserResponse }` | 사용자 직접 등록 (201, 레거시) |
| POST | `/auth/activate-first-user` | manager_or_admin | - | - | 첫 유저 팀장 활성화 |
| GET | `/auth/check-users` | manager_or_admin | - | `[{ id, email, full_name, role, is_active }]` | 모든 유저 상태 확인 |

#### 상세: POST `/auth/signup`
- 첫 번째 가입자 자동 팀장 + 즉시 활성화
- 이후 가입자는 `member` + 비활성 (팀장 승인 필요)
- username은 full_name 기반 자동 생성 (동명이인 시 숫자 추가)
- **부수 효과**: 2번째 이상 가입 시 매니저에게 `user_pending_approval` 알림 발송

#### 상세: POST `/auth/login`
- **부수 효과**: KST 기준 오늘 날짜 자동 출석 체크 (Attendance 레코드 생성)
- Token의 expires_in은 초 단위 (settings.access_token_expire_minutes * 60)

---

### 2.2 Users (`/api/v1/users`)

| 메서드 | 경로 | 인증 | 요청 바디/파라미터 | 응답 data | 설명 |
|--------|------|------|-------------------|-----------|------|
| GET | `/users/me` | get_current_user | - | `UserResponse` | 내 정보 조회 |
| GET | `/users/team-members` | get_current_user | - | `{ members: [], total }` | 팀원 목록 (제한 정보) |
| GET | `/users` | manager_or_admin | `?role=&is_active=` | `{ users: [UserResponse], total }` | 전체 사용자 목록 |
| GET | `/users/pending` | manager_or_admin | - | `{ users: [UserResponse], total }` | 승인 대기 사용자 |
| GET | `/users/{user_id}` | get_current_user | - | `UserResponse` | 사용자 상세 |
| PATCH | `/users/{user_id}/role` | get_manager | `UserRoleUpdate` | `{ id, username, role }` | 역할 변경 |
| POST | `/users/{user_id}/approve` | manager_or_admin | - | `UserResponse` | 가입 승인 |
| POST | `/users/{user_id}/deactivate` | get_manager | - | `UserResponse` | 비활성화 |
| DELETE | `/users/{user_id}` | get_manager | - | - | 완전 삭제 |
| POST | `/users/{user_id}/transfer-manager` | get_manager | - | `{ previous_manager, new_manager }` | 팀장 권한 이전 |

#### 상세: DELETE `/users/{user_id}`
- 자기 자신 삭제 불가, 팀장 삭제 불가
- **연쇄 삭제**: 알림 삭제, 메시지 user_id null 처리, 의사결정 노트 삭제, 감사로그 user_id null 처리, 요청 requester_id/approved_by null 처리, 토론 opened_by/closed_by null 처리

#### 상세: POST `/users/{user_id}/transfer-manager`
- 현재 팀장 -> admin, 대상 -> manager
- 대상이 비활성이면 거부

---

### 2.3 Positions (`/api/v1/positions`)

| 메서드 | 경로 | 인증 | 요청 바디/파라미터 | 응답 data | 설명 |
|--------|------|------|-------------------|-----------|------|
| GET | `/positions/settings/team` | get_current_user | - | `TeamSettingsResponse` | 팀 설정 조회 |
| PUT | `/positions/settings/team` | get_manager | `TeamSettingsUpdate` | `TeamSettingsResponse` | 팀 설정 수정 |
| POST | `/positions/settings/team/exchange` | get_manager | `CurrencyExchange` | `TeamSettingsResponse` | 환전 (KRW<->USD) |
| GET | `/positions` | get_current_user | `?status=&ticker=&opened_by=&page=&limit=` | `PositionListResponse` | 포지션 목록 |
| GET | `/positions/{position_id}` | get_current_user | - | `PositionResponse` | 포지션 상세 |
| PATCH | `/positions/{position_id}` | manager_or_admin | `PositionUpdate` | `PositionResponse` | 포지션 수정 |
| POST | `/positions/{position_id}/close` | manager_or_admin | `PositionClose` | `PositionResponse` | 포지션 종료 |
| POST | `/positions/{position_id}/confirm` | get_manager | `PositionConfirmInfo` | `PositionResponse` | 포지션 정보 확인 |
| POST | `/positions/{position_id}/toggle-plan` | get_manager | `TogglePlanItem` | `PositionResponse` | 계획 항목 완료 토글 |
| PATCH | `/positions/{position_id}/plans` | get_writer_user | `UpdatePlans` | `PositionResponse` | 매매 계획 수정 |
| GET | `/positions/{position_id}/audit-logs` | get_current_user | - | `{ logs: [] }` | 포지션 수정 이력 |
| POST | `/positions/{position_id}/request-discussion` | get_writer_user | - | - | 포지션 토론 요청 |
| POST | `/positions/{position_id}/request-early-close` | get_current_user | - | - | 조기종료 요청 |
| DELETE | `/positions/{position_id}` | manager_or_admin | - | - | 포지션 삭제 |

#### 상세: POST `/positions/settings/team/exchange`
- `CurrencyExchange`: `{ from_currency, to_currency, from_amount, to_amount, exchange_rate?, memo? }`
- **부수 효과**: exchange_history JSON 배열에 환전 기록 추가 (user_id, user_name, timestamp 포함)

#### 상세: DELETE `/positions/{position_id}`
- **연쇄 삭제**: 결정노트, 포지션 관련 토론(+메시지), 요청 관련 토론(+메시지), 감사로그, 포지션

#### 인라인 스키마 (라우터에서 직접 정의)
- `CurrencyExchange`: `{ from_currency: str, to_currency: str, from_amount: float, to_amount: float, exchange_rate?: float, memo?: str }`
- `TogglePlanItem`: `{ plan_type: str('buy'|'take_profit'|'stop_loss'), index: int, completed: bool }`
- `UpdatePlans`: `{ buy_plan?: list, take_profit_targets?: list, stop_loss_targets?: list }`

---

### 2.4 Requests (`/api/v1/requests`)

| 메서드 | 경로 | 인증 | 요청 바디/파라미터 | 응답 data | 설명 |
|--------|------|------|-------------------|-----------|------|
| POST | `/requests/buy` | get_writer_user | `BuyRequestCreate` | `{ request: RequestResponse }` | 매수 요청 (201) |
| POST | `/requests/sell` | get_writer_user | `SellRequestCreate` | `{ request: RequestResponse }` | 매도 요청 (201) |
| GET | `/requests` | get_current_user | `?status=&request_type=&requester_id=&page=&limit=` | `RequestListResponse` | 요청 목록 |
| GET | `/requests/{request_id}` | get_current_user | - | `RequestResponse` | 요청 상세 |
| POST | `/requests/{request_id}/approve` | manager_or_admin | `RequestApprove` | `{ request, position? }` | 요청 승인 |
| POST | `/requests/{request_id}/reject` | manager_or_admin | `RequestReject` | `{ request }` | 요청 거부 |
| POST | `/requests/{request_id}/discuss` | manager_or_admin | `RequestDiscuss` | `{ request, discussion }` | 토론 개시 (201) |
| POST | `/requests/{request_id}/request-discussion` | get_writer_user | - | - | 토론 요청 (팀원->매니저) |
| DELETE | `/requests/{request_id}` | manager_or_admin | - | - | 요청 삭제 |

#### 상세: POST `/requests/buy`
- **부수 효과**: 매니저에게 `new_request` 알림 발송 (Push 포함)

#### 상세: POST `/requests/{request_id}/approve`
- **부수 효과**: 매수 승인 시 포지션 생성/업데이트, 요청자에게 `request_approved` 알림

#### 상태 머신
```
PENDING -> APPROVED (승인)
PENDING -> REJECTED (거부)
PENDING -> DISCUSSION (토론으로 전환)
DISCUSSION -> APPROVED (토론 후 승인)
DISCUSSION -> REJECTED (토론 후 거부)
```

---

### 2.5 Discussions (`/api/v1/discussions`)

| 메서드 | 경로 | 인증 | 요청 바디/파라미터 | 응답 data | 설명 |
|--------|------|------|-------------------|-----------|------|
| GET | `/discussions` | get_current_user | `?status=&limit=&offset=` | `{ discussions: [], total }` | 토론 목록 |
| POST | `/discussions` | manager_or_admin | `DiscussionCreate` | `DiscussionResponse` | 토론 생성 (201) |
| GET | `/discussions/position/{position_id}` | get_current_user | - | `[DiscussionResponse+]` | 포지션별 토론 |
| GET | `/discussions/{discussion_id}` | get_current_user | - | `DiscussionResponse` | 토론 상세 |
| PATCH | `/discussions/{discussion_id}` | manager_or_admin | `DiscussionUpdate` | `DiscussionResponse` | 토론 수정 |
| GET | `/discussions/{discussion_id}/messages` | get_current_user | `?page=&limit=` | `DiscussionMessagesResponse` | 메시지 목록 |
| POST | `/discussions/{discussion_id}/messages` | get_writer_user | `MessageCreate` | `MessageResponse` | 메시지 전송 (201) |
| POST | `/discussions/{discussion_id}/close` | manager_or_admin | `DiscussionClose` | `DiscussionResponse+` | 토론 종료 |
| POST | `/discussions/{discussion_id}/reopen` | manager_or_admin | `DiscussionReopen` | `DiscussionResponse` | 토론 재개 |
| POST | `/discussions/{discussion_id}/request-reopen` | get_writer_user | - | - | 재개 요청 |
| GET | `/discussions/{discussion_id}/sessions` | get_current_user | - | `{ sessions: [] }` | 세션 목록 |
| GET | `/discussions/{discussion_id}/export` | get_current_user | - | JSON 직접 반환 | 토론 내보내기 (JSON) |
| GET | `/discussions/{discussion_id}/export-txt` | get_current_user | `?sessions=1,2,3` | `{ files: [] }` | 토론 텍스트 내보내기 |
| DELETE | `/discussions/{discussion_id}` | manager_or_admin | - | - | 토론 삭제 |
| DELETE | `/discussions/{discussion_id}/sessions/{session_number}` | manager_or_admin | - | `{ deleted_messages }` | 세션 삭제 |

#### 토론 세션 시스템
- 토론은 여러 세션으로 구성 (session_count 관리)
- reopen 시 session_count 증가, 새 의제 설정
- 세션별 메시지 분리 가능 (session_number 필드)

---

### 2.6 Stats (`/api/v1/stats`)

| 메서드 | 경로 | 인증 | 요청 바디/파라미터 | 응답 data | 설명 |
|--------|------|------|-------------------|-----------|------|
| GET | `/stats/users/{user_id}` | get_current_user | - | 사용자 통계 dict | 개인 통계 |
| GET | `/stats/team` | get_current_user | `?start_date=&end_date=` | 팀 통계 dict | 팀 통계 (실시간 시세 포함) |
| GET | `/stats/exchange-rate` | get_current_user | - | `{ usd_krw: float? }` | 환율 조회 (yfinance) |
| GET | `/stats/asset-history` | get_current_user | `?period=(1w|1m|3m|all)&start_date=` | `[{ date, value, krw_cash, ... }]` | 자산 히스토리 |
| GET | `/stats/asset-snapshot/{date}` | get_current_user | - | 스냅샷 상세 dict | 특정 날짜 스냅샷 |
| POST | `/stats/asset-snapshot` | get_manager | - | 스냅샷 요약 dict | 수동 스냅샷 생성 |
| GET | `/stats/team-ranking` | get_current_user | - | `{ members: [], avg_week_attendance_rate, total_members }` | 팀원 랭킹 |

#### 상세: GET `/stats/team-ranking` 응답 필드
```
members[]: id, username, full_name, role, role_priority, avg_profit_rate, total_profit,
           position_count, total_trades, win_rate, winning_trades, losing_trades,
           open_positions, closed_positions, week_attendance_rate, month_attendance_rate,
           total_attendance_rate, week_present, week_total
```

---

### 2.7 Prices (`/api/v1/prices`)

| 메서드 | 경로 | 인증 | 요청 바디/파라미터 | 응답 data | 설명 |
|--------|------|------|-------------------|-----------|------|
| GET | `/prices/search` | get_current_user | `?q=&market=&limit=` | `{ query, results, count }` | 종목 검색 |
| GET | `/prices/quote` | get_current_user | `?ticker=&market=` | `{ ticker, market, price }` | 단일 시세 |
| GET | `/prices/lookup` | get_current_user | `?ticker=&market=` | 종목 정보 dict | 종목 코드 조회 |
| GET | `/prices/candles` | get_current_user | `?ticker=&market=&timeframe=&limit=&before=` | 캔들 데이터 | OHLCV 조회 |
| GET | `/prices/positions` | get_current_user | - | `{ positions: [] }` | 열린 포지션 시세 |

#### 파라미터 상세
- `market`: KOSPI, KOSDAQ, NASDAQ, NYSE, CRYPTO
- `timeframe`: 1d, 1w, 1M, 1h 등
- `limit`: 캔들 기본 200, 최대 500
- `before`: Unix timestamp (lazy loading용)

---

### 2.8 Notifications (`/api/v1/notifications`)

| 메서드 | 경로 | 인증 | 요청 바디/파라미터 | 응답 data | 설명 |
|--------|------|------|-------------------|-----------|------|
| GET | `/notifications` | get_current_user | `?unread_only=&limit=&offset=` | `NotificationListResponse` | 알림 목록 |
| GET | `/notifications/unread-count` | get_current_user | - | `UnreadCountResponse` | 미읽음 수 |
| PATCH | `/notifications/read` | get_current_user | `NotificationMarkRead` | - | 선택 읽음 처리 |
| PATCH | `/notifications/read-all` | get_current_user | - | - | 전체 읽음 처리 |
| DELETE | `/notifications/{notification_id}` | get_current_user | - | - | 알림 삭제 |
| DELETE | `/notifications` | get_current_user | - | - | 전체 알림 삭제 |
| GET | `/notifications/vapid-key` | 비인증 | - | `{ vapid_public_key }` | VAPID 공개키 |
| POST | `/notifications/push/subscribe` | get_current_user | `PushSubscribeRequest` | `{ id }` | Push 구독 |
| POST | `/notifications/push/unsubscribe` | get_current_user | `PushUnsubscribeRequest` | - | Push 구독 해제 |

---

### 2.9 Decision Notes (`/api/v1/positions/{position_id}/notes`)

> **주의**: 이 라우터는 `prefix="/positions"` 로 등록되어 Positions 라우터와 경로를 공유합니다.

| 메서드 | 경로 | 인증 | 요청 바디/파라미터 | 응답 data | 설명 |
|--------|------|------|-------------------|-----------|------|
| GET | `/positions/{position_id}/notes` | get_current_user | - | `{ notes: [] }` | 노트 목록 |
| GET | `/positions/{position_id}/notes/{note_id}` | get_current_user | - | 노트 dict | 노트 상세 |
| POST | `/positions/{position_id}/notes` | get_manager | `DecisionNoteCreate` | 노트 dict | 노트 작성 |
| PATCH | `/positions/{position_id}/notes/{note_id}` | get_manager | `DecisionNoteUpdate` | 노트 dict | 노트 수정 |
| DELETE | `/positions/{position_id}/notes/{note_id}` | get_manager | - | - | 노트 삭제 |

#### 인라인 스키마 (라우터에서 직접 정의)
- `DecisionNoteCreate`: `{ title: str, content: str, blocks?: List[Any], note_type?: str('decision'|'report') }`
- `DecisionNoteUpdate`: `{ title?: str, content?: str, blocks?: List[Any] }`

---

### 2.10 Columns (`/api/v1/columns`)

| 메서드 | 경로 | 인증 | 요청 바디/파라미터 | 응답 data | 설명 |
|--------|------|------|-------------------|-----------|------|
| GET | `/columns` | get_current_user | `?skip=&limit=&author_id=&verified=` | `{ columns, total, skip, limit }` | 칼럼 목록 |
| GET | `/columns/{column_id}` | get_current_user | - | 칼럼 상세 dict | 칼럼 상세 |
| POST | `/columns` | get_writer_user | `TeamColumnCreate` | 칼럼 dict | 칼럼 작성 |
| PUT | `/columns/{column_id}` | get_writer_user | `TeamColumnUpdate` | 칼럼 dict | 칼럼 수정 (작성자만) |
| DELETE | `/columns/{column_id}` | get_writer_user | - | - | 칼럼 삭제 (작성자/매니저) |
| POST | `/columns/{column_id}/verify` | get_manager | - | 칼럼+복구정보 dict | 칼럼 검증 |
| POST | `/columns/{column_id}/unverify` | get_manager | - | 칼럼 dict | 검증 취소 |

#### 상세: POST `/columns/{column_id}/verify`
- **부수 효과 A**: 미출석이 있으면 -> 가장 최근 absent을 recovered로 변경
- **부수 효과 B**: 미출석이 없으면 -> 작성자의 attendance_shields +1

#### 상세: POST `/columns/{column_id}/unverify`
- **부수 효과**: verify 시 출석 복구했으면 원복, 방패 적립했으면 방패 차감

---

### 2.11 Reports (`/api/v1/reports`)

| 메서드 | 경로 | 인증 | 요청 바디/파라미터 | 응답 data | 설명 |
|--------|------|------|-------------------|-----------|------|
| GET | `/reports` | get_current_user | `?skip=&limit=` | `{ reports, total, skip, limit }` | 운용보고서 목록 (포지션별 그룹) |
| GET | `/reports/positions` | get_current_user | `?skip=&limit=&status=` | `{ positions, total, skip, limit }` | 보고서용 포지션 목록 |
| GET | `/reports/operation-reports` | get_current_user | `?skip=&limit=` | `{ notes, total, skip, limit }` | 운용보고서 (note_type='report') |
| GET | `/reports/decision-notes` | get_current_user | `?skip=&limit=` | `{ notes, total, skip, limit }` | 전체 의사결정서 |
| GET | `/reports/position/{position_id}` | get_current_user | - | `{ position, notes }` | 포지션별 운용보고서 |

---

### 2.12 Attendance (`/api/v1/attendance`)

| 메서드 | 경로 | 인증 | 요청 바디/파라미터 | 응답 data | 설명 |
|--------|------|------|-------------------|-----------|------|
| POST | `/attendance/check-in` | get_writer_user | - | 출석 dict + 방패 정보 | 출석 체크 (KST) |
| GET | `/attendance/me` | get_current_user | `?year=&month=` | `{ year, month, attendances }` | 내 출석 (캘린더) |
| GET | `/attendance/me/stats` | get_current_user | - | 출석률 통계 dict | 내 출석 통계 |
| POST | `/attendance/recover` | get_current_user | `RecoverRequest` | 출석 dict | 칼럼으로 결석 복구 요청 |
| GET | `/attendance/pending` | get_manager | - | `{ pending, total }` | 복구 대기 목록 |
| POST | `/attendance/{attendance_id}/approve` | get_manager | - | 출석 dict | 복구 승인 |
| POST | `/attendance/{attendance_id}/reject` | get_manager | - | 출석 dict | 복구 거부 |
| GET | `/attendance/user/{user_id}` | get_current_user | `?year=&month=` | `{ user_id, year, month, attendances }` | 특정 사용자 출석 |

#### 상세: POST `/attendance/check-in`
- **방패 자동 소모**: 어제 absent이고 방패 보유 시, 어제를 recovered로 변경 + 방패 -1
- 출석 상태: present, absent, recovered, pending_recovery

#### 인라인 스키마
- `RecoverRequest`: `{ column_id: int, date: str(YYYY-MM-DD) }`

---

### 2.13 AI (`/api/v1/ai`)

| 메서드 | 경로 | 인증 | 요청 바디/파라미터 | 응답 data | 설명 |
|--------|------|------|-------------------|-----------|------|
| GET | `/ai/status` | get_current_user | - | AI 상태 dict | AI 사용 가능 여부 + 남은 횟수 |
| POST | `/ai/generate-decision-note` | manager_or_admin | `GenerateDecisionNoteRequest` | `{ content, remaining_uses, sessions_analyzed }` | AI 의사결정서 생성 |
| POST | `/ai/generate-operation-report` | manager_or_admin | `GenerateOperationReportRequest` | `{ content, remaining_uses, position_id }` | AI 운용보고서 생성 |
| GET | `/ai/position-data/{position_id}` | get_current_user | - | 포지션 전체 데이터 | 보고서 미리보기용 |

#### 인라인 스키마
- `GenerateDecisionNoteRequest`: `{ session_ids: List[int], position_id?: int }`
- `GenerateOperationReportRequest`: `{ position_id: int }`

#### 비즈니스 규칙
- 일일 사용 제한: 팀 전체 3회 (의사결정서 + 운용보고서 합산)

---

### 2.14 Trading Plans (`/api/v1/positions/{position_id}/plans`)

> **주의**: 이 라우터도 `prefix="/positions"` 로 등록되어 있습니다.

| 메서드 | 경로 | 인증 | 요청 바디/파라미터 | 응답 data | 설명 |
|--------|------|------|-------------------|-----------|------|
| GET | `/positions/{position_id}/plans` | get_current_user | - | `TradingPlanListResponse` | 매매계획 이력 |
| POST | `/positions/{position_id}/plans` | get_writer_user | `TradingPlanCreate` | `TradingPlanResponse` | 매매계획 저장 (201) |
| GET | `/positions/{position_id}/plans/{plan_id}` | get_current_user | - | `TradingPlanResponse` | 매매계획 상세 |
| POST | `/positions/{position_id}/plans/{plan_id}/submit` | get_writer_user | - | `TradingPlanResponse` | 매매계획 제출 |
| DELETE | `/positions/{position_id}/plans/{plan_id}` | get_writer_user | - | - | 매매계획 삭제 (draft만) |
| POST | `/positions/{position_id}/executions` | get_writer_user | `ExecutionCreate` | `TradingPlanResponse` | 체결 기록 생성 (201) |

#### 상세: POST `/positions/{position_id}/executions`
- 실질적으로 **팀장만** 가능 (코드 내 `is_manager_or_admin()` 확인)
- **부수 효과 (매수 체결)**: 포지션의 평균매입가, 수량, 총매입금액 가중평균 재계산
- **부수 효과 (익절/손절 체결)**: 수량 차감, realized_profit_loss 누적
- **부수 효과**: 해당 계획 항목 completed=True 설정, 감사 로그 기록

---

### 2.15 Uploads (`/api/v1/uploads`)

| 메서드 | 경로 | 인증 | 요청 바디/파라미터 | 응답 data | 설명 |
|--------|------|------|-------------------|-----------|------|
| POST | `/uploads/image` | get_current_user | `file: UploadFile` (multipart) | `{ url, filename, size, content_type }` | 이미지 업로드 |
| GET | `/uploads/files/{filename}` | 비인증 | - | FileResponse | 파일 조회 |
| GET | `/uploads/disk-usage` | get_current_user | - | `{ total_size, file_count, formatted_size }` | 디스크 사용량 |

#### 업로드 제한
- 최대 파일 크기: 10MB
- 허용 MIME: image/jpeg, image/png, image/gif, image/webp

---

### 2.16 NewsDesk (`/api/v1/newsdesk`)

| 메서드 | 경로 | 인증 | 요청 바디/파라미터 | 응답 data | 설명 |
|--------|------|------|-------------------|-----------|------|
| GET | `/newsdesk/today` | get_current_user | - | `NewsDeskResponse?` | 오늘의 뉴스데스크 |
| GET | `/newsdesk/benchmarks` | get_current_user | `?period=(1W|1M|3M|6M|1Y)` | `{ kospi, nasdaq, sp500, fund }` | 벤치마크 데이터 |
| GET | `/newsdesk/history` | get_current_user | `?days=(1~30)` | `{ items, total }` | 최근 N일 뉴스데스크 |
| GET | `/newsdesk/{target_date}` | get_current_user | - | `NewsDeskResponse` | 특정 날짜 뉴스데스크 |

#### 비즈니스 규칙
- 수동 생성 엔드포인트 제거됨 (2026-02-10)
- 뉴스데스크는 스케줄러(KST 05:30)로만 자동 생성

---

### 2.17 Comments (`/api/v1/comments`)

| 메서드 | 경로 | 인증 | 요청 바디/파라미터 | 응답 data | 설명 |
|--------|------|------|-------------------|-----------|------|
| GET | `/comments` | get_current_user | `?document_type=&document_id=&skip=&limit=` | `{ comments, total }` | 댓글 목록 |
| POST | `/comments` | get_current_user | `CommentCreate` | 댓글 dict | 댓글 작성 (viewer 포함) |
| PUT | `/comments/{comment_id}` | get_current_user | `CommentUpdate` | 댓글 dict | 댓글 수정 (작성자만) |
| DELETE | `/comments/{comment_id}` | get_current_user | - | - | 댓글 삭제 (작성자/매니저) |

#### document_type 허용값
`decision_note`, `report`, `column`, `ai_column`, `news`

---

### 2.18 Health Check

| 메서드 | 경로 | 인증 | 응답 | 설명 |
|--------|------|------|------|------|
| GET | `/health` | 비인증 | `{ "status": "healthy" }` | 헬스 체크 |

---

## Part 3: Pydantic 스키마 전체 목록

### 3.1 공통 스키마 (`common.py`)

| 스키마명 | 필드 | 타입 | 필수 | 설명 |
|---------|------|------|------|------|
| **APIResponse** | success | bool | O (기본 true) | 성공 여부 |
| | data | Any? | X | 응답 데이터 |
| | message | str | O (기본 "Success") | 메시지 |
| **ErrorDetail** | code | str | O | 에러 코드 |
| | message | str | O | 에러 메시지 |
| | details | dict? | X | 추가 상세 |
| **ErrorResponse** | success | bool | O (기본 false) | 항상 false |
| | error | ErrorDetail | O | 에러 상세 |
| **PaginationParams** | page | int | O (기본 1) | 페이지 |
| | limit | int | O (기본 20) | 페이지 크기 |
| **PaginatedResponse** | total | int | O | 전체 개수 |
| | page | int | O | 현재 페이지 |
| | limit | int | O | 페이지 크기 |

### 3.2 인증 스키마 (`auth.py`)

| 스키마명 | 필드 | 타입 | 필수 | 검증 규칙 |
|---------|------|------|------|----------|
| **LoginRequest** | email | str | O | - |
| | password | str | O | - |
| **RefreshRequest** | refresh_token | str | O | - |
| **SendVerificationRequest** | email | EmailStr | O | 이메일 형식 |
| **VerifyCodeRequest** | email | EmailStr | O | 이메일 형식 |
| | code | str | O | min=6, max=6 |
| **SignupRequest** | email | EmailStr | O | 이메일 형식 |
| | password | str | O | min=8 |
| | username | str? | X | min=3, max=50 (자동생성) |
| | full_name | str | O | min=2, max=100 |
| | role | str | O | 기본 "member", 패턴: ^(member\|manager\|admin)$ |
| **SignupResponse** | message | str | O | - |
| | requires_approval | bool | O | 기본 true |
| **Token** | access_token | str | O | - |
| | refresh_token | str | O | - |
| | token_type | str | O | 기본 "bearer" |
| | expires_in | int | O | 초 단위 |
| | user | UserResponse | O | 사용자 정보 |
| **TokenRefreshResponse** | access_token | str | O | - |
| | refresh_token | str? | X | - |
| | token_type | str | O | 기본 "bearer" |
| | expires_in | int | O | 초 단위 |
| **TokenPayload** | sub | str? | X | user_id |
| | exp | int? | X | 만료 시간 |
| | type | str? | X | "access" 또는 "refresh" |

### 3.3 사용자 스키마 (`user.py`)

| 스키마명 | 필드 | 타입 | 필수 | 검증 규칙 |
|---------|------|------|------|----------|
| **UserCreate** | email | EmailStr | O | - |
| | full_name | str | O | min=2, max=100 |
| | password | str | O | min=8 |
| | username | str? | X | min=3, max=50 |
| | role | str | O | 기본 "member" |
| **UserUpdate** | email | EmailStr? | X | - |
| | username | str? | X | min=3, max=50 |
| | full_name | str? | X | min=1, max=100 |
| | is_active | bool? | X | - |
| **UserRoleUpdate** | role | str | O | - |
| **UserResponse** | id | int | O | - |
| | email | str | O | - |
| | username | str | O | - |
| | full_name | str | O | - |
| | role | str | O | - |
| | is_active | bool | O | - |
| | attendance_shields | int | O | 기본 0 |
| | created_at | datetime | O | - |
| **UserBrief** | id | int | O | - |
| | username | str | O | - |
| | full_name | str | O | - |

### 3.4 포지션 스키마 (`position.py`)

| 스키마명 | 필드 | 타입 | 필수 | 검증 규칙 |
|---------|------|------|------|----------|
| **PriceTarget** | price | Decimal | O | - |
| | quantity | Decimal? | X | - |
| | ratio | Decimal? | X | (legacy) |
| | completed | bool | O | 기본 false |
| **BuyPlanItem** | price | Decimal | O | - |
| | quantity | Decimal? | X | - |
| | ratio | Decimal? | X | (legacy) |
| | completed | bool | O | 기본 false |
| **ContributorInfo** | user | UserBrief | O | - |
| | quantity | Decimal | O | - |
| | contribution_ratio | Decimal | O | - |
| **PositionCreate** | ticker | str | O | - |
| | ticker_name | str? | X | - |
| | market | str | O | 기본 "KRX" |
| | average_buy_price | Decimal | O | - |
| | total_quantity | Decimal | O | - |
| | total_buy_amount | Decimal | O | - |
| | take_profit_targets | List[PriceTarget]? | X | - |
| | stop_loss_targets | List[PriceTarget]? | X | - |
| | opened_by | int | O | - |
| **PositionUpdate** | ticker_name | str? | X | - |
| | average_buy_price | Decimal? | X | - |
| | total_quantity | Decimal? | X | - |
| | total_buy_amount | Decimal? | X | - |
| | take_profit_targets | List[PriceTarget]? | X | - |
| | stop_loss_targets | List[PriceTarget]? | X | - |
| **PositionClose** | total_sell_amount | Decimal | O | 실제 청산 금액 |
| | average_sell_price | Decimal? | X | - |
| | closed_at | datetime? | X | - |
| **PositionConfirmInfo** | average_buy_price | Decimal | O | - |
| | total_quantity | Decimal | O | - |
| | total_buy_amount | Decimal? | X | - |
| | ticker_name | str? | X | - |
| **PositionStatusInfo** | status | str | O | 'normal', 'needs_close', 'no_plan' |
| | alert | str? | X | 'warning', 'danger' |
| | message | str? | X | - |
| **PositionResponse** | id | int | O | - |
| | ticker | str | O | - |
| | ticker_name | str? | X | - |
| | market | str | O | - |
| | status | str | O | - |
| | is_info_confirmed | bool | O | 기본 false |
| | average_buy_price | Decimal? | X | - |
| | total_quantity | Decimal? | X | - |
| | total_buy_amount | Decimal? | X | - |
| | buy_plan | List[dict]? | X | - |
| | take_profit_targets | List[dict]? | X | - |
| | stop_loss_targets | List[dict]? | X | - |
| | remaining_buys | int | O | 기본 0 |
| | remaining_take_profits | int | O | 기본 0 |
| | remaining_stop_losses | int | O | 기본 0 |
| | average_sell_price | Decimal? | X | - |
| | total_sell_amount | Decimal? | X | - |
| | profit_loss | Decimal? | X | - |
| | profit_rate | Decimal? | X | - |
| | realized_profit_loss | Decimal? | X | 기본 0 |
| | holding_period_hours | int? | X | - |
| | opened_at | datetime? | X | - |
| | closed_at | datetime? | X | - |
| | opened_by | UserBrief? | X | - |
| | closed_by | UserBrief? | X | - |
| | created_at | datetime | O | - |
| | status_info | PositionStatusInfo? | X | - |
| **PositionBrief** | (PositionResponse의 축약) | | | |
| **PositionListResponse** | positions | List[PositionResponse] | O | - |
| | total | int | O | - |
| | page | int | O | 기본 1 |
| | limit | int | O | 기본 20 |
| **TeamSettingsUpdate** | initial_capital_krw | Decimal? | X | 원화 |
| | initial_capital_usd | Decimal? | X | 달러 |
| | description | str? | X | - |
| **TeamSettingsResponse** | id | int | O | - |
| | initial_capital_krw | Decimal? | X | 기본 0 |
| | initial_capital_usd | Decimal? | X | 기본 0 |
| | exchange_history | List[dict]? | X | - |
| | description | str? | X | - |
| | updated_at | datetime | O | - |

### 3.5 요청 스키마 (`request.py`)

| 스키마명 | 필드 | 타입 | 필수 | 검증 규칙 |
|---------|------|------|------|----------|
| **BuyOrder** | price | Decimal | O | - |
| | quantity | Decimal? | X | - |
| | ratio | Decimal? | X | ge=0, le=1 (legacy) |
| **BuyRequestCreate** | target_ticker | str | O | - |
| | ticker_name | str? | X | - |
| | target_market | str | O | 기본 "KOSPI" |
| | order_type | str | O | 기본 "amount" ('amount' or 'quantity') |
| | order_amount | Decimal? | X | 매수 금액 |
| | order_quantity | Decimal? | X | 매수 수량 |
| | buy_price | Decimal? | X | 매수 희망가 (None=시장가) |
| | buy_orders | List[BuyOrder]? | X | (legacy) |
| | target_ratio | Decimal? | X | ge=0, le=1 (legacy) |
| | take_profit_targets | List[PriceTarget]? | X | - |
| | stop_loss_targets | List[PriceTarget]? | X | - |
| | memo | str? | X | - |
| **SellRequestCreate** | position_id | int | O | - |
| | sell_quantity | Decimal | O | - |
| | sell_price | Decimal? | X | (None=시장가) |
| | sell_reason | str? | X | - |
| **RequestApprove** | executed_price | Decimal? | X | - |
| | executed_quantity | Decimal? | X | - |
| | executed_at | datetime? | X | - |
| **RequestReject** | rejection_reason | str | O | - |
| **RequestDiscuss** | title | str | O | max=200 |
| | agenda | str | O | min=1, max=500 |
| **RequestResponse** | (24개 필드 - 상세는 코드 참조) | | | |
| **RequestListResponse** | requests | List[RequestResponse] | O | - |
| | total | int | O | - |
| | page | int | O | 기본 1 |
| | limit | int | O | 기본 20 |

### 3.6 토론 스키마 (`discussion.py`)

| 스키마명 | 필드 | 타입 | 필수 | 검증 규칙 |
|---------|------|------|------|----------|
| **DiscussionCreate** | request_id | int? | X | - |
| | position_id | int? | X | - |
| | title | str | O | max=200 |
| | agenda | str | O | min=1, max=500 |
| **DiscussionClose** | summary | str? | X | - |
| **DiscussionReopen** | agenda | str | O | min=1, max=500 |
| **DiscussionUpdate** | title | str? | X | max=200 |
| | current_agenda | str? | X | max=500 |
| **MessageCreate** | content | str | O | min=1 |
| | message_type | str | O | 기본 "text" (text, chart) |
| | chart_data | dict? | X | 차트 캔들 데이터 |
| **MessageResponse** | id | int | O | - |
| | discussion_id | int | O | - |
| | user | UserBrief | O | - |
| | content | str | O | - |
| | message_type | str | O | - |
| | chart_data | dict? | X | - |
| | session_number | int | O | 기본 1 |
| | created_at | datetime | O | - |
| **DiscussionResponse** | id | int | O | - |
| | request_id | int? | X | - |
| | position_id | int? | X | - |
| | title | str | O | - |
| | status | str | O | - |
| | summary | str? | X | - |
| | session_count | int | O | 기본 1 |
| | current_agenda | str? | X | - |
| | opened_by | UserBrief | O | - |
| | closed_by | UserBrief? | X | - |
| | opened_at | datetime | O | - |
| | closed_at | datetime? | X | - |
| | message_count | int | O | 기본 0 |
| **SessionInfo** | session_number | int | O | - |
| | agenda | str? | X | - |
| | message_count | int | O | 기본 0 |
| | started_at | datetime? | X | - |
| | last_message | str? | X | - |
| | last_message_at | datetime? | X | - |
| **DiscussionMessagesResponse** | messages | List[MessageResponse] | O | - |
| | total | int | O | - |
| | page | int | O | 기본 1 |
| | limit | int | O | 기본 50 |

### 3.7 매매계획 스키마 (`trading_plan.py`)

| 스키마명 | 필드 | 타입 | 필수 | 검증 규칙 |
|---------|------|------|------|----------|
| **PlanChange** | action | str | O | "add", "modify", "delete" |
| | type | str | O | "buy", "take_profit", "stop_loss" |
| | user | str | O | 사용자명 |
| | price | float? | X | - |
| | quantity | float? | X | - |
| | old_price | float? | X | 수정 시 이전값 |
| | old_quantity | float? | X | 수정 시 이전값 |
| | timestamp | str | O | ISO 형식 |
| **TradingPlanCreate** | buy_plan | List[dict]? | X | - |
| | take_profit_targets | List[dict]? | X | - |
| | stop_loss_targets | List[dict]? | X | - |
| | memo | str? | X | - |
| | changes | List[PlanChange]? | X | (deprecated) |
| **ExecutionCreate** | plan_type | str | O | "buy", "take_profit", "stop_loss" |
| | execution_index | int | O | 몇 번째 체결 (1-based) |
| | target_price | float | O | 계획 가격 |
| | target_quantity | float | O | 계획 수량 |
| | executed_price | float | O | 실제 체결 가격 |
| | executed_quantity | float | O | 실제 체결 수량 |
| **TradingPlanResponse** | id | int | O | - |
| | position_id | int | O | - |
| | version | int | O | - |
| | record_type | str | O | 기본 'plan_saved' |
| | buy_plan | List[dict]? | X | - |
| | take_profit_targets | List[dict]? | X | - |
| | stop_loss_targets | List[dict]? | X | - |
| | memo | str? | X | - |
| | changes | List[dict]? | X | (deprecated) |
| | plan_type | str? | X | 체결 기록용 |
| | execution_index | int? | X | - |
| | target_price | float? | X | - |
| | target_quantity | float? | X | - |
| | executed_price | float? | X | - |
| | executed_quantity | float? | X | - |
| | executed_amount | float? | X | - |
| | profit_loss | float? | X | - |
| | profit_rate | float? | X | - |
| | status | str | O | - |
| | user | UserBrief? | X | - |
| | created_at | datetime | O | - |
| | submitted_at | datetime? | X | - |
| **TradingPlanListResponse** | plans | List[TradingPlanResponse] | O | - |
| | total | int | O | - |

### 3.8 댓글 스키마 (`comment.py`)

| 스키마명 | 필드 | 타입 | 필수 | 검증 규칙 |
|---------|------|------|------|----------|
| **CommentCreate** | document_type | str | O | - |
| | document_id | int | O | - |
| | content | str | O | min=1, max=2000 |
| **CommentUpdate** | content | str | O | min=1, max=2000 |
| **CommentAuthor** | id | int | O | - |
| | username | str | O | - |
| | full_name | str | O | - |
| **CommentResponse** | id | int | O | - |
| | user_id | int | O | - |
| | user | CommentAuthor? | X | - |
| | document_type | str | O | - |
| | document_id | int | O | - |
| | content | str | O | - |
| | created_at | datetime? | X | - |
| | updated_at | datetime? | X | - |
| **CommentListResponse** | comments | List[CommentResponse] | O | - |
| | total | int | O | - |

### 3.9 뉴스데스크 스키마 (`newsdesk.py`)

| 스키마명 | 필드 | 타입 | 필수 | 검증 규칙 |
|---------|------|------|------|----------|
| **KeywordBubble** | keyword | str | O | - |
| | count | int | O | 언급 횟수 |
| | greed_score | float? | X | 0.0~1.0 |
| | category | str? | X | - |
| | top_greed | List[str] | O | 기본 [] |
| | top_fear | List[str] | O | 기본 [] |
| | sentiment | Any? | X | (legacy) |
| **SentimentData** | greed_ratio | float? | X | 0.0~1.0 |
| | fear_ratio | float? | X | 0.0~1.0 |
| | overall_score | int? | X | 0~100 |
| | top_greed | List[str] | O | 기본 [] |
| | top_fear | List[str] | O | 기본 [] |
| | positive_count | int? | X | (legacy) |
| | negative_count | int? | X | (legacy) |
| | neutral_count | int? | X | (legacy) |
| | positive_ratio | float? | X | (legacy) |
| | negative_ratio | float? | X | (legacy) |
| | key_positive | List[str]? | X | (legacy) |
| | key_negative | List[str]? | X | (legacy) |
| **NewsCard** | id | int | O | - |
| | title | str | O | - |
| | summary | str | O | 2-3문장 |
| | content | str | O | 상세 내용 |
| | source | str? | X | - |
| | category | str | O | 국내, 해외, AI칼럼 |
| | keywords | List[str] | O | - |
| | sentiment | str | O | - |
| | image_url | str? | X | - |
| **TopStock** | rank | int | O | - |
| | ticker | str | O | - |
| | name | str | O | - |
| | market | str | O | KRX, NASDAQ, NYSE |
| | price_change | float | O | 등락률 |
| | volume | float | O | 거래대금 |
| | mention_count | int | O | - |
| | reason | str | O | 주목 이유 |
| | detail | str | O | 상세 분석 |
| | sentiment | str | O | - |
| | related_news | List[str] | O | 관련 뉴스 제목 |
| **NewsDeskResponse** | id | int | O | - |
| | publish_date | date | O | - |
| | status | str | O | - |
| | columns | List[NewsCard]? | X | - |
| | news_cards | List[NewsCard]? | X | - |
| | keywords | List[KeywordBubble]? | X | - |
| | sentiment | SentimentData? | X | - |
| | top_stocks | List[TopStock]? | X | - |
| | raw_news_count | int | O | - |
| | created_at | datetime | O | - |
| | updated_at | datetime | O | - |
| **NewsDeskGenerateRequest** | target_date | date? | X | None이면 오늘 |
| **BenchmarkDataPoint** | time | int | O | Unix timestamp |
| | value | float | O | - |
| **BenchmarkResponse** | kospi | List[BenchmarkDataPoint] | O | - |
| | nasdaq | List[BenchmarkDataPoint] | O | - |
| | sp500 | List[BenchmarkDataPoint] | O | - |
| | fund | List[BenchmarkDataPoint]? | X | - |

### 3.10 알림 스키마 (`notification.py`)

| 스키마명 | 필드 | 타입 | 필수 | 검증 규칙 |
|---------|------|------|------|----------|
| **NotificationResponse** | id | int | O | - |
| | notification_type | str | O | - |
| | title | str | O | - |
| | message | str? | X | - |
| | related_type | str? | X | - |
| | related_id | int? | X | - |
| | is_read | bool | O | - |
| | created_at | datetime | O | - |
| **NotificationListResponse** | notifications | List[NotificationResponse] | O | - |
| | total | int | O | - |
| | unread_count | int | O | - |
| **NotificationMarkRead** | notification_ids | List[int] | O | - |
| **UnreadCountResponse** | unread_count | int | O | - |
| **PushSubscribeRequest** | endpoint | str | O | - |
| | keys | dict | O | { p256dh, auth } |
| **PushUnsubscribeRequest** | endpoint | str | O | - |

### 3.11 팀 칼럼 스키마 (`team_column.py`)

| 스키마명 | 필드 | 타입 | 필수 | 검증 규칙 |
|---------|------|------|------|----------|
| **TeamColumnCreate** | title | str | O | min=1, max=200 |
| | content | str? | X | (legacy markdown) |
| | blocks | List[Any]? | X | Editor.js 블록 |
| **TeamColumnUpdate** | title | str? | X | min=1, max=200 |
| | content | str? | X | - |
| | blocks | List[Any]? | X | - |
| **AuthorBrief** | id | int | O | - |
| | username | str | O | - |
| | full_name | str | O | - |
| **TeamColumnResponse** | id | int | O | - |
| | title | str | O | - |
| | content | str | O | - |
| | author_id | int | O | - |
| | author | AuthorBrief? | X | - |
| | created_at | datetime | O | - |
| | updated_at | datetime? | X | - |
| **TeamColumnListItem** | id | int | O | - |
| | title | str | O | - |
| | author_id | int | O | - |
| | author | AuthorBrief? | X | - |
| | created_at | datetime | O | - |

---

## Part 4: WebSocket API

### 4.1 연결 방식
| 항목 | 값 |
|------|-----|
| 경로 | `ws://<host>/ws?token=<access_token>` |
| 인증 | Query parameter로 JWT access token 전달 |
| 인증 실패 | WebSocket close code 4001 |
| 프로토콜 | JSON 메시지 (`{ "type": "...", "data": { ... } }`) |

### 4.2 클라이언트 -> 서버 이벤트

| type | data 필드 | 설명 |
|------|-----------|------|
| `join_discussion` | `{ discussion_id: int }` | 토론방 입장 |
| `leave_discussion` | `{ discussion_id: int }` | 토론방 퇴장 |
| `send_message` | `{ discussion_id: int, content: str, message_type?: str, chart_data?: dict }` | 메시지 전송 |
| `subscribe_price` | `{ ticker: str }` | 시세 구독 |
| `unsubscribe_price` | `{ ticker: str }` | 시세 구독 해제 |

### 4.3 서버 -> 클라이언트 이벤트

| type | data 필드 | 설명 | 수신 대상 |
|------|-----------|------|----------|
| `user_joined` | `{ discussion_id, user_id }` | 사용자 토론 입장 | 같은 토론방 (발신자 제외) |
| `user_left` | `{ discussion_id, user_id }` | 사용자 토론 퇴장 | 같은 토론방 |
| `message_received` | `{ id, discussion_id, user, content, message_type, chart_data, created_at }` | 새 메시지 수신 | 같은 토론방 (발신자 제외) |
| `message_sent` | `{ id, discussion_id, user, content, message_type, chart_data, created_at }` | 메시지 전송 확인 (ID 포함) | 발신자 본인 |
| `price_update` | 시세 데이터 dict | 실시간 시세 업데이트 | 해당 ticker 구독자 |

### 4.4 서비스 -> 클라이언트 이벤트 (NotificationService에서 발송)

| type | 설명 | 트리거 |
|------|------|--------|
| `notification` | 실시간 알림 | 매매 요청/승인/거부, 토론 개시, 가입 승인 등 |

### 4.5 ConnectionManager 상태 관리
- `active_connections`: user_id -> WebSocket 리스트 (다중 탭 지원)
- `discussion_rooms`: discussion_id -> user_id 셋
- `price_subscriptions`: ticker -> user_id 셋

---

## Part 5: 미래 확장 API (FUTURE_FEATURES.md 기반)

### 5.1 B. 세션/기수 관리 API

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| POST | `/api/v1/sessions` | manager | 기수 생성 |
| GET | `/api/v1/sessions` | get_current_user | 기수 목록 |
| GET | `/api/v1/sessions/active` | get_current_user | 현재 활성 기수 |
| GET | `/api/v1/sessions/{session_id}` | get_current_user | 기수 상세 |
| PATCH | `/api/v1/sessions/{session_id}` | manager | 기수 수정 |
| POST | `/api/v1/sessions/{session_id}/close` | manager | 기수 종료 |
| POST | `/api/v1/sessions/{session_id}/transition` | manager | 승계 시작 (transitioning) |
| POST | `/api/v1/sessions/{session_id}/complete-transition` | manager | 승계 완료 |
| GET | `/api/v1/sessions/{session_id}/stats` | get_current_user | 기수별 통계 |
| POST | `/api/v1/capital-transactions` | manager | 자본 변동 기록 |
| GET | `/api/v1/capital-transactions` | get_current_user | 자본 변동 이력 |

**필요한 스키마/모델:**
- `FundSession`: id, generation_number, start_date, end_date, initial_capital_krw, initial_capital_usd, status(active/closed/transitioning)
- `CapitalTransaction`: id, session_id, transaction_type(deposit/withdrawal/loan/investment), amount, currency, description, executed_by, executed_at

---

### 5.2 C. 멀티테넌시 API

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| POST | `/api/v1/teams` | super_admin | 팀 생성 |
| GET | `/api/v1/teams` | super_admin | 팀 목록 |
| GET | `/api/v1/teams/{team_id}` | super_admin | 팀 상세 |
| PATCH | `/api/v1/teams/{team_id}` | super_admin | 팀 수정 |
| POST | `/api/v1/teams/{team_id}/invite` | super_admin | 초대 코드 발급 |
| POST | `/api/v1/teams/join` | 비인증 | 초대 코드로 가입 |

**데이터 격리:**
- 모든 기존 테이블에 `team_id` 컬럼 추가
- API 미들웨어/dependency에서 `current_user.team_id`로 자동 필터링
- `UserRole`에 `SUPER_ADMIN` 추가

**필요한 모델:**
- `Team`: id, code(UNIQUE), name, created_at, is_active, created_by

---

### 5.3 D. 뉴스데스크 공유 캐시 API

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| GET | `/api/v1/newsdesk/shared/available-dates` | get_current_user | 열람 가능 날짜 목록 |
| POST | `/api/v1/newsdesk/shared/request/{date}` | get_current_user | 과거 뉴스데스크 열람 요청 |
| GET | `/api/v1/newsdesk/subscription` | manager | 팀 구독 상태 |
| POST | `/api/v1/newsdesk/subscription` | manager | 구독 활성화 |
| DELETE | `/api/v1/newsdesk/subscription` | manager | 구독 해지 |

**필요한 모델:**
- `SharedNewsDesk`: publish_date(UNIQUE), 뉴스데스크 데이터, created_by_team_id
- `TeamNewsDeskAccess`: team_id, shared_newsdesk_id, accessed_at, was_cached
- `TeamNewsDeskSubscription`: team_id, is_active, plan_type(free/basic/premium), daily_past_request_limit, activated_at, expires_at

---

### 5.4 E. 커뮤니티 허브 API

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| GET | `/api/v1/community/leaderboard` | get_current_user | 팀 랭킹 |
| GET | `/api/v1/community/posts` | get_current_user | 게시글 목록 |
| POST | `/api/v1/community/posts` | get_writer_user | 게시글 작성 |
| GET | `/api/v1/community/posts/{post_id}` | get_current_user | 게시글 상세 |
| POST | `/api/v1/community/posts/{post_id}/comments` | get_current_user | 댓글 작성 |
| GET | `/api/v1/community/team-messages` | manager | 팀 간 DM 목록 |
| POST | `/api/v1/community/team-messages` | manager | 팀 간 DM 발송 |

**필요한 모델:**
- `Post`: id, team_id, category, title, content, is_premium, price_credits, view_count, tags
- `PostComment`: id, post_id, author_team_id, content
- `TeamMessage`: 팀 간 DM

---

### 5.5 F. 크레딧 시스템 API

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| GET | `/api/v1/credits/balance` | manager | 크레딧 잔액 조회 |
| GET | `/api/v1/credits/transactions` | manager | 거래 내역 |
| POST | `/api/v1/credits/purchase` | manager | 크레딧 구매 (PG 연동) |
| POST | `/api/v1/credits/spend` | manager | 크레딧 사용 |
| POST | `/api/v1/credits/subscription-payment` | manager | 구독료 크레딧 결제 |

**필요한 모델:**
- `CreditAccount`: team_id(UNIQUE), balance_credits, total_earned, total_spent
- `CreditTransaction`: id, team_id, transaction_type(purchase/spend/earn/subscription/refund), amount_credits, amount_krw, reference_id, description

---

### 5.6 G. 콘텐츠 마켓플레이스 API

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| GET | `/api/v1/marketplace/listings` | get_current_user | 마켓 목록 (필터/정렬) |
| GET | `/api/v1/marketplace/listings/{listing_id}` | get_current_user | 상품 상세 |
| POST | `/api/v1/marketplace/purchase` | manager | 콘텐츠 구매 |
| GET | `/api/v1/marketplace/my-purchases` | get_current_user | 구매 내역 |
| GET | `/api/v1/marketplace/my-sales` | manager | 판매 내역 |
| POST | `/api/v1/marketplace/subscriptions` | manager | 칼럼 구독 |
| DELETE | `/api/v1/marketplace/subscriptions/{sub_id}` | manager | 구독 취소 |
| GET | `/api/v1/marketplace/portfolio-access/{team_id}` | get_current_user | 포트폴리오 열람 |

**필요한 모델:**
- `ContentPurchase`: id, buyer_team_id, seller_team_id, content_type, content_id, price_credits, purchased_at, expires_at
- `ContentSubscription`: id, subscriber_team_id, publisher_team_id, plan, price_credits_per_period, auto_renew, started_at, next_billing_at, cancelled_at

**수익 정산**: 판매액의 80% 공급 팀, 20% 플랫폼 수수료

---

## Part 6: Spring Boot 매핑 가이드

### 6.1 프로젝트 구조 매핑

| FastAPI | Spring Boot |
|---------|------------|
| `app/api/*.py` (APIRouter) | `controller/*Controller.java` (@RestController) |
| `app/schemas/*.py` (Pydantic) | `dto/*Dto.java` (Jakarta Validation) |
| `app/models/*.py` (SQLAlchemy) | `entity/*Entity.java` (JPA @Entity) |
| `app/services/*.py` | `service/*Service.java` (@Service) |
| `app/dependencies.py` | `security/*` (Spring Security Filter) |
| `app/database.py` | `config/DatabaseConfig.java` + `repository/*Repository.java` |
| `app/config.py` | `application.yml` + `config/AppConfig.java` |
| `app/websocket/` | `config/WebSocketConfig.java` (STOMP) |
| `app/utils/security.py` | `security/JwtProvider.java` |
| Alembic (migrations) | Flyway 또는 Liquibase |

### 6.2 APIResponse -> ResponseEntity 래퍼

```java
// FastAPI
class APIResponse(BaseModel):
    success: bool = True
    data: Optional[Any] = None
    message: str = "Success"

// Spring Boot
@Getter @AllArgsConstructor
public class ApiResponse<T> {
    private boolean success;
    private T data;
    private String message;

    public static <T> ResponseEntity<ApiResponse<T>> ok(T data) {
        return ResponseEntity.ok(new ApiResponse<>(true, data, "Success"));
    }

    public static <T> ResponseEntity<ApiResponse<T>> ok(T data, String message) {
        return ResponseEntity.ok(new ApiResponse<>(true, data, message));
    }

    public static ResponseEntity<ApiResponse<Void>> error(HttpStatus status, String message) {
        return ResponseEntity.status(status)
            .body(new ApiResponse<>(false, null, message));
    }
}
```

### 6.3 Pydantic -> Jakarta Validation DTO

```python
# FastAPI (Pydantic)
class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: str = Field(..., min_length=2, max_length=100)
    role: str = Field(default="member", pattern="^(member|manager|admin)$")
```

```java
// Spring Boot (Jakarta Validation)
@Getter @Setter
public class SignupRequest {
    @NotBlank @Email
    private String email;

    @NotBlank @Size(min = 8)
    private String password;

    @NotBlank @Size(min = 2, max = 100)
    private String fullName;

    @Pattern(regexp = "^(member|manager|admin)$")
    private String role = "member";
}
```

### 6.4 인증 체계 매핑

```python
# FastAPI
@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    ...

@router.post("/approve")
async def approve(current_user: User = Depends(get_manager_or_admin)):
    ...
```

```java
// Spring Boot (Spring Security)
@GetMapping("/me")
@PreAuthorize("isAuthenticated()")
public ResponseEntity<ApiResponse<UserResponse>> getMe(
    @AuthenticationPrincipal UserDetails userDetails) {
    ...
}

@PostMapping("/approve")
@PreAuthorize("hasAnyRole('MANAGER', 'ADMIN')")
public ResponseEntity<ApiResponse<UserResponse>> approve(
    @AuthenticationPrincipal UserDetails userDetails) {
    ...
}
```

### 6.5 WebSocket -> STOMP 매핑

```python
# FastAPI (Raw WebSocket)
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    ...
```

```java
// Spring Boot (STOMP over WebSocket)
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic", "/queue");
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
            .setAllowedOrigins("*")
            .withSockJS();
    }
}

// STOMP 채널 매핑
// join_discussion  -> @SubscribeMapping("/discussion/{id}")
// send_message     -> @MessageMapping("/discussion/{id}/message")
//                     -> @SendTo("/topic/discussion/{id}")
// subscribe_price  -> @SubscribeMapping("/prices/{ticker}")
// price_update     -> messagingTemplate.convertAndSend("/topic/prices/{ticker}", data)
// notification     -> messagingTemplate.convertAndSendToUser(userId, "/queue/notifications", data)
```

### 6.6 SQLAlchemy -> JPA 매핑

```python
# SQLAlchemy
class Position(Base):
    __tablename__ = 'positions'
    id = Column(Integer, primary_key=True)
    ticker = Column(String(20), nullable=False)
    take_profit_targets = Column(JSON)  # JSON 컬럼
    requests = relationship("Request", back_populates="position")
```

```java
// JPA
@Entity
@Table(name = "positions")
@Getter @Setter
public class PositionEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 20, nullable = false)
    private String ticker;

    @Type(JsonType.class)           // Hibernate 6 + hypersistence-utils
    @Column(columnDefinition = "jsonb")
    private List<Map<String, Object>> takeProfitTargets;

    @OneToMany(mappedBy = "position")
    private List<RequestEntity> requests;
}
```

### 6.7 주요 변환 체크리스트

| 항목 | FastAPI 현재 | Spring Boot 목표 |
|------|-------------|-----------------|
| 라우터 등록 | `api_router.include_router(router, prefix="...")` | `@RestController` + `@RequestMapping("/api/v1/...")` |
| 의존성 주입 | `Depends(get_db)`, `Depends(get_current_user)` | `@Autowired`, Spring Security |
| 요청 검증 | Pydantic `Field(min_length=...)` | Jakarta `@Size(min=...)`, `@Valid` |
| DB 세션 | `Session = Depends(get_db)` | `@Transactional` + Repository 패턴 |
| 비동기 | `async def` + SQLAlchemy sync | 기본 동기 (WebFlux 선택 가능) |
| JSON 컬럼 | `Column(JSON)` | `@Type(JsonType.class)` + `@Column(columnDefinition = "jsonb")` |
| 시간대 | `datetime.now(KST)` 수동 변환 | `ZonedDateTime` + `@Column(columnDefinition = "timestamptz")` |
| 스케줄러 | APScheduler | `@Scheduled` + `@EnableScheduling` |
| 이메일 | 직접 SMTP | `spring-boot-starter-mail` + `JavaMailSender` |
| Push 알림 | pywebpush | web-push (Java) 또는 Firebase Cloud Messaging |
| 환율/시세 | yfinance | Yahoo Finance API (REST) 또는 한국투자 Open API |
| 파일 업로드 | `UploadFile` + 로컬 저장 | `MultipartFile` + S3 또는 로컬 |
| CORS | `CORSMiddleware` | `@CrossOrigin` 또는 `WebMvcConfigurer` |
| 에러 처리 | `HTTPException` | `@ControllerAdvice` + `@ExceptionHandler` |

### 6.8 마이그레이션 우선순위

1. **Phase 1**: 인증/사용자 (`auth`, `users`, `dependencies` -> Spring Security + JWT)
2. **Phase 2**: 핵심 도메인 (`positions`, `requests`, `discussions`)
3. **Phase 3**: 보조 도메인 (`trading_plans`, `decision_notes`, `columns`, `attendance`)
4. **Phase 4**: 외부 연동 (`prices`, `newsdesk`, `ai`, `uploads`)
5. **Phase 5**: 실시간 (`websocket` -> STOMP, `notifications` -> SSE 또는 STOMP)
6. **Phase 6**: 부가 기능 (`stats`, `reports`, `comments`)

---

## 부록 A: 엔드포인트 총 수 (현재 구현)

| 도메인 | 엔드포인트 수 |
|--------|-------------|
| Auth | 8 |
| Users | 10 |
| Positions | 14 |
| Requests | 9 |
| Discussions | 16 |
| Stats | 7 |
| Prices | 5 |
| Notifications | 9 |
| Decision Notes | 5 |
| Columns | 7 |
| Reports | 5 |
| Attendance | 8 |
| AI | 4 |
| Trading Plans | 6 |
| Uploads | 3 |
| NewsDesk | 4 |
| Comments | 4 |
| Health | 1 |
| WebSocket | 1 |
| **합계** | **약 126개** |

## 부록 B: 알림 타입 정리

| notification_type | 트리거 | 발송 대상 |
|------------------|--------|----------|
| `user_pending_approval` | 신규 회원가입 | 매니저 전원 |
| `new_request` | 매매 요청 생성 | 매니저 전원 |
| `request_approved` | 요청 승인 | 요청자 |
| `request_rejected` | 요청 거부 | 요청자 |
| `discussion_opened` | 토론 개시 | 요청자 |
| `discussion_requested` | 토론 요청 (팀원->매니저) | 매니저 전원 |
| `reopen_requested` | 토론 재개 요청 | 매니저 전원 |
| `discussion_requested` (포지션) | 포지션 토론 요청 | 매니저 전원 |
| `early_close_requested` | 조기종료 요청 | 매니저 전원 |
