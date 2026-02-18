# 펀드메신저 비즈니스 로직 명세서
> Spring Boot 리팩토링 참조 문서 | 작성일: 2026-02-18
> 소스 기반: F:\fundmessage\backend\app\ (FastAPI + SQLAlchemy + Pydantic)

---

## Part 1: 인증/권한 체계

### 1.1 역할 정의 (UserRole Enum)

| 역할 | 값 | 설명 |
|------|-----|------|
| `MANAGER` | `"manager"` | 팀장. 최고 권한. 요청 승인/거부, 칼럼 검증, 사용자 승인, 포지션 종료 |
| `ADMIN` | `"admin"` | 관리자. MANAGER와 동일 권한 (is_manager_or_admin 체크 통과) |
| `MEMBER` | `"member"` | 팀원. 매수/매도 요청, 토론 참여, 칼럼 작성, 출석 |
| `VIEWER` | `"viewer"` | 보기 전용. 읽기만 가능. 쓰기 작업 불가 (get_writer_user에서 차단) |

### 1.2 권한 매트릭스

| 기능 | MANAGER | ADMIN | MEMBER | VIEWER |
|------|---------|-------|--------|--------|
| 매수/매도 요청 생성 | O | O | O | X |
| 요청 승인/거부 | O | X* | X | X |
| 토론 생성/참여 | O | O | O | X |
| 메시지 전송 | O | O | O | X |
| 포지션 정보 확인(confirm) | O | O** | X | X |
| 포지션 종료(close) | O | O** | X | X |
| 칼럼 작성 | O | O | O | X |
| 칼럼 검증(파란 체크) | O | X*** | X | X |
| 사용자 승인/비활성화 | O | O | X | X |
| 역할 변경 | O | O | X | X |
| 출석 복구 승인/거부 | O | X | X | X |
| AI 의사결정서/운용보고서 | O | O | O | X |
| 뉴스데스크 조회 | O | O | O | O |
| 알림 조회 | O | O | O | O |
| 댓글 작성 | O | O | O | X |

> \* 요청 승인/거부는 `get_manager_or_admin` 의존성으로 보호됨. ADMIN도 승인 가능.
> \*\* 포지션 confirm/close는 `get_manager_or_admin` 의존성 사용.
> \*\*\* 칼럼 검증은 `get_manager` 의존성으로 MANAGER만 가능.

### 1.3 인증 의존성 함수 (dependencies.py)

| 함수명 | 역할 요구 | 용도 |
|--------|-----------|------|
| `get_current_user` | 모든 활성 사용자 | JWT 토큰 검증 + is_active 체크 |
| `get_current_active_user` | 모든 활성 사용자 | get_current_user의 중복 래퍼 (하위 호환) |
| `get_manager_or_admin` | MANAGER 또는 ADMIN | 승인, 포지션 관리, 역할 변경 등 |
| `get_manager` | MANAGER만 | 칼럼 검증, 출석 복구 승인 |
| `get_writer_user` | VIEWER 제외 전부 | 쓰기 작업 (요청, 댓글, 칼럼 작성 등) |

### 1.4 인증 플로우

#### 회원가입 플로우
```
1. POST /api/v1/auth/send-verification {email}
   - 이메일 중복 확인
   - 6자리 인증 코드 생성 (10분 유효)
   - SMTP로 발송 (설정 없으면 콘솔 출력)

2. POST /api/v1/auth/verify-code {email, code}
   - 코드 일치 + 만료 확인
   - EmailVerification.is_verified = True

3. POST /api/v1/auth/signup {email, password, full_name}
   - 이메일 중복 재확인
   - username = full_name (동명이인 시 숫자 추가: "홍길동" → "홍길동1")
   - 첫 번째 사용자: role=MANAGER, is_active=True (즉시 로그인 가능)
   - 이후 사용자: role=MEMBER, is_active=False (팀장 승인 필요)
   - 팀장에게 "가입 승인 요청" 알림 전송

4. 팀장이 POST /api/v1/users/{user_id}/approve
   - user.is_active = True
```

#### 로그인 플로우
```
1. POST /api/v1/auth/login {email, password}
   - 사용자 존재 확인 → 비밀번호 검증 → is_active 확인
   - JWT 토큰 발급:
     - Access Token: HS256, sub=user_id, type="access", 만료=60분
     - Refresh Token: HS256, sub=user_id, type="refresh", 만료=30일
   - 자동 출석 체크: KST 기준 오늘 Attendance 레코드 없으면 생성 (status='present')
   - 반환: {access_token, refresh_token, token_type, expires_in, user}
```

#### 토큰 갱신 플로우
```
1. POST /api/v1/auth/refresh {refresh_token}
   - Refresh Token 디코드 → type="refresh" 확인
   - user_id로 사용자 조회 → is_active 확인
   - 새 Access Token + 새 Refresh Token 발급 (Rotation)
```

### 1.5 설정 (config.py)

```python
# JWT
secret_key: str          # 환경변수 SECRET_KEY 필수
algorithm: str = "HS256"
access_token_expire_minutes: int = 60
refresh_token_expire_days: int = 30

# SMTP (이메일 발송)
smtp_host: str = "smtp.gmail.com"
smtp_port: int = 587
smtp_user, smtp_password, smtp_from_email: str

# OpenAI API
openai_api_key: str
openai_model: str = "gpt-5-mini"
openai_temperature: float = 0.7

# AI별 설정 (verbosity, max_tokens, reasoning_effort)
newsdesk_*  / decision_*  / report_*

# Web Push (VAPID)
vapid_public_key, vapid_private_key, vapid_claims_email

# 환경변수 로드: pydantic_settings BaseSettings + .env 파일
```

---

## Part 2: 핵심 비즈니스 프로세스

### 2.1 매수/매도 요청 상태 머신

#### 상태 정의 (RequestStatus Enum)
- `PENDING` - 대기 중
- `DISCUSSION` - 토론 진행 중
- `APPROVED` - 승인됨
- `REJECTED` - 거부됨

#### 요청 타입 (RequestType Enum)
- `BUY` - 매수
- `SELL` - 매도

#### 상태 전환 다이어그램
```
                 ┌──────────────────────┐
                 │                      v
PENDING ──→ DISCUSSION ──→ APPROVED ──→ (포지션 생성/수정)
   │              │
   │              v
   └──────→ REJECTED
```

#### 전환 조건 및 처리 로직

| 전환 | 조건 | 권한 | 부수 효과 |
|------|------|------|-----------|
| PENDING → DISCUSSION | `start_discussion()` 호출 | 서비스 내부 | request.status = DISCUSSION |
| PENDING → APPROVED | `approve_request()` 호출 | get_manager_or_admin | 포지션 생성/추가매수, 알림 전송 |
| PENDING → REJECTED | `reject_request()` 호출 | get_manager_or_admin | rejection_reason 기록, 알림 전송 |
| DISCUSSION → APPROVED | `approve_request()` 호출 | get_manager_or_admin | 포지션 생성/추가매수, 알림 전송 |
| DISCUSSION → REJECTED | `reject_request()` 호출 | get_manager_or_admin | rejection_reason 기록, 알림 전송 |

#### 매수 요청 생성 (RequestService.create_buy_request)
```python
# 필수 입력
target_ticker, ticker_name, target_market, order_type, order_amount,
order_quantity, buy_price, target_ratio,
take_profit_targets: [{price, quantity}],  # 익절 목표
stop_loss_targets: [{price, quantity}],    # 손절 목표
memo

# 처리: Request 레코드 생성, status=PENDING
```

#### 매도 요청 생성 (RequestService.create_sell_request)
```python
# 필수 입력
position_id, sell_quantity, sell_price, sell_reason

# 검증
- position 존재 확인
- position.status == OPEN 확인

# 처리: Request 레코드 생성, status=PENDING
```

#### 승인 처리 (RequestService.approve_request)
```python
# 매수 승인 시:
1. 요청자의 희망가/수량 사용 (팀장이 별도 입력 안 하면)
2. 동일 종목+시장의 OPEN 포지션이 있으면 → add_to_position (추가 매수)
3. 없으면 → create_position_from_request (신규 포지션, is_info_confirmed=False)
4. take_profit_targets, stop_loss_targets에 completed=False 플래그 추가
5. buy_plan 생성 (분할매수면 첫 번째만 completed=True)

# 매도 승인 시:
1. 매도 수량이 보유 수량 이상이면 → close_position (전량 청산)
2. 미만이면 → reduce_position (부분 청산)
```

### 2.2 포지션 라이프사이클

#### 상태 정의 (PositionStatus Enum)
- `OPEN` - 보유 중
- `CLOSED` - 종료됨

#### 라이프사이클
```
생성 (매수 승인)
  → is_info_confirmed = False
  → 팀장이 confirm_position_info() → is_info_confirmed = True
  → 매매계획 설정 (buy_plan, take_profit_targets, stop_loss_targets)
  → 계획 항목 체결 (toggle_plan_item)
     - buy 체결: 수량 증가, 평균단가 재계산
     - take_profit 체결: 수량 감소, 실현손익 계산
     - stop_loss 체결: 수량 감소, 실현손익 계산
     - 체결 취소 불가 (HTTPException)
  → 추가 매수 (add_to_position) → 평균단가 가중평균 재계산
  → 부분 청산 (reduce_position)
  → 전량 청산 (close_position) → status = CLOSED
```

#### 수익률 계산 공식

**포지션 종료 시 (실현 수익률):**
```python
profit_loss = total_sell_amount - total_buy_amount
profit_rate = profit_loss / total_buy_amount  (total_buy_amount > 0)
holding_period_hours = (closed_at - opened_at).total_seconds() / 3600
```

**보유 중 (미실현 수익률) - PriceService._get_position_price_info:**
```python
unrealized = (current_price * remaining_quantity) - (avg_buy_price * remaining_quantity)
total_profit_loss = realized_profit_loss + unrealized
profit_rate = total_profit_loss / total_buy_amount
```

**계획 항목 체결 시 (toggle_plan_item):**
```python
# 익절/손절 체결 시 실현손익 누적
realized_pnl = (sell_price - average_buy_price) * sell_quantity
position.realized_profit_loss += realized_pnl
position.total_quantity -= sell_quantity
position.total_buy_amount = total_quantity * average_buy_price
```

**추가 매수 시 가중평균:**
```python
new_total_amount = old_total_amount + (additional_quantity * additional_price)
new_total_quantity = old_quantity + additional_quantity
average_buy_price = new_total_amount / new_total_quantity
```

#### 포지션 상태 정보 (get_position_status_info)
```python
# 잔량 0인데 열려있음 → alert: 'danger', message: '잔량 0 - 포지션 종료 필요'
# 매도 계획 전부 완료됨 → alert: 'warning', message: '매도 계획 없음'
# 매도 계획 자체 없음 → alert: 'warning', message: '매도 계획 없음'
# 그 외 → alert: None (정상)
```

#### 감사 로그 (AuditService)
- 매매계획 수정, 포지션 정보 확인 시 AuditLog 자동 기록
- `log_change()`: 단일 필드 변경
- `log_multiple_changes()`: 여러 필드 동시 변경 (old/new 값 JSON으로 저장)
- entity_type='position', entity_id=position.id

### 2.3 토론 시스템

#### 상태 정의 (DiscussionStatus Enum)
- `OPEN` - 진행 중
- `CLOSED` - 종료됨

#### 메시지 타입 (MessageType Enum)
- `TEXT` - 일반 텍스트
- `CHART` - 차트 데이터 (OHLCV 캔들)
- `SYSTEM` - 시스템 메시지 (세션 시작/종료)

#### 토론 생성 플로우
```
1. create_discussion(request_id 또는 position_id, title, agenda)
   - request_id가 있으면: request.status = DISCUSSION으로 변경
   - session_count = 1
   - 시스템 메시지 자동 생성: "Session 1 started\n의제: {agenda}"
```

#### 세션 관리
```
# 토론은 여러 세션을 가질 수 있음
# 세션 = 열기/닫기 사이의 메시지 그룹

1. create_discussion → Session 1 시작
2. close_discussion → Session N 종료 (summary 기록)
3. reopen_discussion → Session N+1 시작 (새 의제)
   - session_count 증가
   - request가 있으면 request.status = DISCUSSION으로 복원
   - 시스템 메시지: "Session {N} started\n의제: {agenda}"
```

#### 메시지 생성 규칙
- discussion.status == CLOSED이면 메시지 전송 불가 (400 에러)
- message_type='chart'이면 chart_data JSON 저장 (OHLCV 캔들 데이터)
- session_number = discussion.session_count (현재 세션 번호 자동 부여)

#### 토론 내보내기
- `export_discussion_txt()`: 세션별 텍스트 형식 내보내기
- `get_discussion_export()`: 참여자 + 메시지 목록 JSON

#### 세션 삭제
- `delete_session(session_number)`: 해당 세션의 모든 메시지 삭제 (매니저 전용)

### 2.4 AI 기능

#### 2.4.1 의사결정서 생성 (AIService.generate_decision_note)

**입력:**
- session_ids: 분석할 토론 세션 ID 목록
- position_id: (선택) 포지션 컨텍스트 추가

**처리 플로우:**
```
1. 메시지 수집 (session_ids → 토론 메시지 텍스트 변환)
   - 시스템 메시지: [시스템] 태그
   - 차트 메시지: OHLCV 데이터 포함 (최대 5개 캔들)
   - 일반 메시지: [시간] [작성자]: 내용
2. 포지션 컨텍스트 수집 (있으면)
   - 종목 정보, 평단가, 수량, 매매계획, 요청 이력
3. 사용량 원자적 예약 (_reserve_usage)
   - Row-level lock (with_for_update)
   - 날짜 변경 시 자동 리셋
   - 제한 초과 시 False 반환
4. AI 호출 (_call_ai)
   - 1차: Responses API (verbosity 지원)
   - 2차: Chat Completions fallback
5. 제목 추출 (정규식: **제목**: 패턴)
6. 실패 시 사용량 복원 (_rollback_usage)
```

**출력 구조 (마크다운):**
1. 개요 (종목, 참여자, 기간, 결론)
2. 참여자별 의견 (입장, 핵심 주장, 수치 근거)
3. 논의 흐름 (세션별 쟁점 + 합의)
4. 최종 결정 (투자 방향, 진입 전략, 목표가, 손절가)
5. 리스크 (유형, 내용, 대응)
6. 후속 조치

#### 2.4.2 운용보고서 생성 (AIService.generate_operation_report)

**입력:**
- position_id: 대상 포지션

**데이터 수집 (collect_position_data):**
- 포지션 기본 정보 (종목, 가격, 수량, 상태, 보유기간)
- 현재 매매계획 (buy_plan, take_profit, stop_loss + 완료 수)
- 관련 요청 이력 (모든 Request)
- 의사결정 노트 (모든 DecisionNote)
- 매매계획 이력 (모든 TradingPlan 버전)
- 토론 세션 + 메시지 (차트 데이터 포함, 캔들 수 제한)

**출력 구조 (마크다운):**
1. 포지션 개요
2. 매매 현황 (진입/현재 평가/청산)
3. 매매계획 및 실행
4. 요청 이력
5. 의사결정 기록
6. 토론 요약
7. 종합 평가 (투자 근거 일관성, 계획 대비 실행, 리스크 관리)

#### 2.4.3 일일 사용량 제한

```python
# TeamSettings 테이블에서 관리
ai_daily_limit = 3          # 하루 최대 사용 횟수
ai_usage_count = 0          # 오늘 사용 횟수
ai_usage_reset_date = today # 리셋 기준 날짜 (KST)

# 날짜가 바뀌면 자동 리셋 (KST 기준)
# Row-level lock으로 동시 요청 방지
# 실패 시 사용량 자동 복원 (_rollback_usage)
```

**AI 호출 방식 (_call_ai):**
```python
# 1차: OpenAI Responses API (verbosity 파라미터 지원)
client.responses.create(
    model, instructions, input,
    text={"verbosity": verbosity},  # "low" / "medium" / "high"
    max_output_tokens, reasoning={"effort": reasoning_effort}
)

# 2차: Chat Completions fallback (Responses API 실패 시)
client.chat.completions.create(
    model, messages, max_tokens, reasoning_effort,
    temperature  # gpt-5-mini/nano 제외
)
```

### 2.5 뉴스데스크

#### 스케줄러 (scheduler.py)
```python
# KST 05:30 - 뉴스데스크 자동 생성
scheduler.add_job(generate_newsdesk_job, CronTrigger(hour=5, minute=30, timezone=kst))

# KST 09:00 - 자산 스냅샷 자동 생성
scheduler.add_job(create_asset_snapshot_job, CronTrigger(hour=9, minute=0, timezone=kst))
```

#### 뉴스데스크 생성 플로우 (generate_newsdesk_job)
```
1. 이미 today의 status="ready" 뉴스데스크 존재 → 스킵
2. NewsDesk 레코드 생성/업데이트 (status="generating")
3. 뉴스 크롤링 (NewsCrawler.collect_for_morning_briefing)
   - 어제 전체 + 오늘 새벽 뉴스 수집
   - 네이버 검색 API (13개 카테고리, 170+ 키워드, 키워드당 10개)
   - yfinance (8개 해외 티커, 티커당 5개)
   - DB 중복 제거 (link + newsdesk_date 기준)
4. AI 분석 (NewsDeskAI.generate_newsdesk)
   - 원본 뉴스 최대 50개를 텍스트로 변환
   - 어제 뉴스데스크 제목 조회 (중복 방지)
   - OpenAI API 호출 (Responses API → Chat Completions fallback)
   - JSON 응답 파싱 (코드블록 추출, 첫{~마지막} 추출)
5. DB 저장 (NewsDeskAI.save_newsdesk)
   - status="ready", generation_count++
6. 실패 시 status="failed", error_message 기록
```

#### 뉴스데스크 콘텐츠 구조 (JSON)
```json
{
  "columns": [{id, title, summary, content, category, keywords, sentiment}],  // AI 칼럼 2개 (국내+해외)
  "news_cards": [{id, title, summary, content, source, category, keywords, sentiment}],  // 뉴스 6개 (국내3+해외3)
  "keywords": [{keyword, count, greed_score, category, top_greed, top_fear}],  // 키워드 8-12개
  "sentiment": {greed_ratio, fear_ratio, overall_score, top_greed, top_fear},  // 탐욕/공포 지수 0-100
  "top_stocks": [{rank, ticker, name, market, price_change, volume, mention_count, reason, detail, sentiment, related_news}]  // 주목 종목 3개
}
```

#### 뉴스 수집 키워드 카테고리 (NewsCrawler.KEYWORDS)
| 카테고리 | 키워드 수 | 예시 |
|----------|-----------|------|
| core | 10 | 증시, 코스피, 나스닥, 금리, 환율 |
| finance | 20 | 시중은행, 증권사, 카드사, 핀테크 |
| realestate | 17 | 아파트, 분양, 청약, GTX, 재개발 |
| consumer | 13 | 이마트, 쿠팡, 물가, 소비심리 |
| labor | 10 | 고용, 실업률, 임금, 노조 |
| entertainment | 11 | HYBE, 넥슨, 넷플릭스, OTT |
| crypto | 8 | 비트코인, 이더리움, 업비트 |
| ai_semi | 13 | AI 반도체, HBM, GPU, 엔비디아 |
| ev_mobility | 10 | 테슬라, 전기차, 배터리, 자율주행 |
| bio_health | 8 | 바이오, 신약, FDA 승인, GLP-1 |
| energy_infra | 8 | 원전, SMR, 방산, 데이터센터 |
| macro_policy | 12 | 연준, FOMC, 인플레이션, 금투세 |
| bigtech | 8 | 애플, 구글, 아마존, 네이버 |
| events | 11 | IPO, M&A, 트럼프, 관세 |

### 2.6 출석 시스템

#### 출석 상태
- `present` - 출석
- `absent` - 결석
- `recovered` - 복구됨 (칼럼 검증 또는 방패)
- `pending_recovery` - 복구 대기 중 (칼럼 제출, 매니저 승인 대기)

#### 로그인 자동 출석
```python
# auth.py login() 엔드포인트 내부
# KST 기준 오늘 날짜로 Attendance 레코드 없으면 자동 생성 (status='present')
# 출석 실패해도 로그인은 정상 진행 (try-except)
```

#### 수동 출석 체크인 (POST /attendance/check-in)
```
1. 이미 오늘 출석했으면 → "이미 출석 체크되었습니다"
2. 방패 자동 소모:
   - 어제 출석 상태가 'absent'이고 방패 > 0이면
   - 어제 상태를 'recovered'로 변경
   - attendance_shields -= 1
3. 오늘 출석 레코드 생성 (status='present')
```

#### 칼럼 검증 → 결석 복구 + 방패 (POST /columns/{id}/verify)
```
1. 팀장이 칼럼 검증 (본인 칼럼 검증 불가)
2. 작성자의 가장 최근 결석(absent) 조회
3-A. 결석이 있으면:
   - status = 'recovered'
   - recovered_by_column_id = column.id
   - approved_by = 검증자 ID
3-B. 결석이 없으면 (출석률 100%):
   - user.attendance_shields += 1
   - column.shield_granted = True
```

#### 칼럼 검증 취소 (POST /columns/{id}/unverify)
```
1. 복구된 출석이 있었다면 → 다시 'absent'로 되돌림
2. 방패가 적립되었다면 → attendance_shields -= 1
3. column.is_verified = False, shield_granted = False
```

#### 칼럼 기반 복구 요청 (POST /attendance/recover)
```
1. 본인 작성 칼럼만 사용 가능
2. 대상 날짜의 출석 기록이 'absent'인 경우만
3. status = 'pending_recovery', recovered_by_column_id 기록
4. 매니저가 approve → 'recovered' / reject → 'absent'로 복원
```

#### 방패 자동 소모
```
# 오늘 출석 체크 시:
# 어제가 'absent'이고 방패 > 0이면
# → 어제를 'recovered'로 자동 변경, 방패 -1
```

### 2.7 알림 시스템

#### 알림 발송 조건 목록

| 이벤트 | 알림 타입 | 수신자 | 제목 패턴 |
|--------|-----------|--------|-----------|
| 새 매수/매도 요청 | `new_request` | 모든 매니저/어드민 | "{이름}님이 {종목} 매수/매도 요청을 제출했습니다" |
| 요청 승인 | `request_approved` | 요청자 | "{종목} 매수 요청이 승인되었습니다" |
| 요청 거부 | `request_rejected` | 요청자 | "{종목} 매수 요청이 거부되었습니다" + 거부 사유 |
| 토론 개시 | `discussion_opened` | 요청자 | "토론이 시작되었습니다: {제목}" |
| 토론 요청 | `discussion_requested` | 모든 매니저/어드민 | "{이름}님이 {종목} 관련 토론을 요청했습니다" |
| 가입 승인 요청 | `user_pending_approval` | 모든 매니저/어드민 | "{이름}님이 가입 승인을 요청했습니다" |

#### 알림 전송 채널

**1. DB 저장 (Notification 테이블)**
```python
Notification(user_id, notification_type, title, message, related_type, related_id, is_read)
```

**2. WebSocket 실시간 전송 (best-effort)**
```python
# manager.send_personal_message()로 전송
# asyncio 이벤트 루프 접근 실패 시 무시
message = {
    "type": "notification",
    "data": {id, notification_type, title, message, related_type, related_id, is_read, created_at}
}
```

**3. Web Push 전송 (best-effort)**
```python
# PushService.send_push()
# pywebpush 라이브러리 사용
# VAPID 인증 (vapid_private_key + vapid_claims_email)
# 만료된 구독 자동 정리 (410 Gone / 404 → 삭제)
# URL 결정 로직:
#   - related_type="position" → /positions/{id}
#   - related_type="discussion" → /discussions/{id}
#   - user_pending_approval → /team
#   - 기본 → /notifications
```

#### Web Push 구독/해제 (PushService)
```python
subscribe(user_id, endpoint, p256dh, auth)
  # 같은 endpoint면 업데이트 (기기 변경 등)
  # PushSubscription(user_id, endpoint, p256dh, auth) 저장

unsubscribe(user_id, endpoint)
  # user_id + endpoint로 삭제
```

---

## Part 3: WebSocket 이벤트 명세

### 3.1 연결 관리 (ConnectionManager)

```python
# 자료 구조
active_connections: Dict[int, List[WebSocket]]  # user_id → [websocket, ...]
discussion_rooms: Dict[int, Set[int]]           # discussion_id → {user_id, ...}
price_subscriptions: Dict[str, Set[int]]        # ticker → {user_id, ...}

# 연결 시: /ws?token={access_token}
# 해제 시: 모든 토론방 + 가격 구독에서 자동 제거
```

### 3.2 클라이언트 → 서버 이벤트

| 이벤트명 | 페이로드 | 처리 로직 |
|----------|----------|-----------|
| `join_discussion` | `{discussion_id: int}` | manager.join_discussion(discussion_id, user_id) → 다른 참여자에게 user_joined 브로드캐스트 |
| `leave_discussion` | `{discussion_id: int}` | manager.leave_discussion(discussion_id, user_id) → user_left 브로드캐스트 |
| `send_message` | `{discussion_id: int, content: str, message_type?: str, chart_data?: object}` | DB에 메시지 저장 → 다른 참여자에게 message_received, 발신자에게 message_sent |
| `subscribe_price` | `{ticker: str}` | manager.subscribe_price(ticker, user_id) |
| `unsubscribe_price` | `{ticker: str}` | manager.unsubscribe_price(ticker, user_id) |

### 3.3 서버 → 클라이언트 이벤트

| 이벤트명 | 페이로드 | 발송 조건 |
|----------|----------|-----------|
| `user_joined` | `{discussion_id, user_id}` | 토론방 참가 시 (본인 제외) |
| `user_left` | `{discussion_id, user_id}` | 토론방 퇴장 시 |
| `message_received` | `{id, discussion_id, user: {id, username, full_name}, content, message_type, chart_data, created_at}` | 메시지 전송 시 (발신자 제외) |
| `message_sent` | (message_received와 동일) | 메시지 전송 확인 (발신자에게만) |
| `price_update` | `{type: "price_update", data: price_data}` | 시세 업데이트 시 (구독 종목) |
| `notification` | `{id, notification_type, title, message, related_type, related_id, is_read, created_at}` | NotificationService에서 알림 생성 시 (해당 사용자에게) |

---

## Part 4: 스케줄러/백그라운드 작업

### 4.1 APScheduler 설정

```python
# AsyncIOScheduler 사용
# init_scheduler()에서 등록, main.py lifespan에서 시작/종료
```

### 4.2 정기 작업 목록

| 작업 | 스케줄 | 함수 | 설명 |
|------|--------|------|------|
| 뉴스데스크 생성 | KST 05:30 매일 | `generate_newsdesk_job()` | 뉴스 크롤링 → AI 분석 → DB 저장. 이미 ready면 스킵 |
| 자산 스냅샷 | KST 09:00 매일 | `create_asset_snapshot_job()` | 열린 포지션 현재가 조회 → 통화별 평가액 계산 → AssetSnapshot 저장 |

### 4.3 자산 스냅샷 상세 (asset_service.py)

```python
# create_daily_snapshot_async()
1. 이미 오늘 스냅샷 존재 → 반환
2. TeamSettings에서 초기자본(KRW, USD) 조회
3. 열린 포지션 순회:
   - PriceService로 현재가 조회 (실패 시 매입가 대체)
   - 마켓별 분류: KRX→KRW, NASDAQ/NYSE→USD, CRYPTO→USDT
   - 평가액 = 현재가 * 수량
   - 마켓별 투자금/평가액 합산
4. 현금 = 초기자본 - 투자금액
5. 종료 포지션 실현손익 합계
6. 미실현손익 = 평가액 합 - 투자금 합
7. 환율 하드코딩: 1 USD = 1,350 KRW
8. 전체 KRW 환산 = KRW(현금+평가) + USD(현금+평가)*환율 + USDT*환율
9. AssetSnapshot 저장 (position_details JSON 포함)
```

### 4.4 시세 조회 서비스 (PriceService)

| 시장 | 소스 | 캐시 |
|------|------|------|
| KOSPI/KOSDAQ | Yahoo Finance (.KS/.KQ) | 1분 |
| NASDAQ/NYSE | Yahoo Finance | 1분 |
| CRYPTO | Binance API (USDT 페어) | 1분 |

**캔들 데이터 API:**
- 한국/미국: Yahoo Finance (1d, 1w, 1M, 1h)
- 암호화폐: Binance Klines API (1m~1M)
- lazy loading 지원 (before 타임스탬프 파라미터)
- Yahoo Finance 버그 보정: Low=0 → min(Open, Close)

### 4.5 종목 검색 서비스 (StockSearchService)

| 시장 | 소스 | 캐시 |
|------|------|------|
| KOSPI/KOSDAQ | PyKRX (전체 종목 목록) | 24시간 |
| NASDAQ/NYSE | 인기 종목 25개 + yfinance Search | - |
| CRYPTO | 정적 리스트 20개 | - |

- 퍼지 매칭: rapidfuzz 라이브러리 (partial_ratio >= 60)
- 점수 기준: 정확 매칭(100) > 시작 매칭(90) > 포함(70) > 퍼지(score*0.6)

---

## Part 5: 미래 확장 비즈니스 로직 (FUTURE_FEATURES.md 기반)

### B. 세션/기수 승계 프로세스

**핵심 모델:**
- `FundSession`: generation_number, start_date, end_date, initial_capital, status (active/closed/transitioning)
- `CapitalTransaction`: session_id, transaction_type (deposit/withdrawal/loan/investment), amount, currency

**승계 플로우:**
1. 32기 팀장이 33기 인원 회원가입 승인
2. 33기 인원은 초기 `member` 역할
3. 32기 팀장이 33기 중 한 명에게 `manager` 위임
4. 32기 팀장은 `viewer` (전관예우) 또는 `admin`으로 변경
5. 승계 완료 시 자본금 재계산

**미결 사항:** 승계 중 포지션 처리 (자동 청산 vs 승계), 과거 기수 통계 별도 조회

### C. 멀티테넌시 데이터 격리

**핵심 모델:**
- `Team`: code (UNIQUE), name, is_active
- User에 `team_id` FK 추가
- 모든 주요 테이블에 team_id 추가
- `SUPER_ADMIN` 역할 추가 (모든 팀 관리)

**데이터 격리:** 모든 쿼리에 current_user.team_id 자동 필터링

**팀 생성:** 관리자 발급 방식 권장 (계약 기반)

### D. 뉴스데스크 공유 캐시 & 구독

**핵심 모델:**
- `SharedNewsDesk`: publish_date (UNIQUE), 공유 콘텐츠
- `TeamNewsDeskAccess`: team_id, shared_newsdesk_id, was_cached
- `TeamNewsDeskSubscription`: team_id, is_active, plan_type (free/basic/premium), daily_past_request_limit

**캐시 플로우:**
- 팀 A가 생성 → SharedNewsDesk 저장
- 팀 B가 요청 → 캐시 히트! 즉시 반환 (AI 비용 0)

**과거 열람:**
- 달력에서 SharedNewsDesk에 존재하는 날짜만 선택 가능
- "AI 생성" 버튼 → 실제로는 캐시 조회 + 로딩 UI 연출
- 하루 3회 제한 (plan_type에 따라 변동)

**플랜 구조:** 미구독(무료) / Basic(월 N원, 매일 자동+과거 3회/일) / Premium(무제한)

### E. 커뮤니티 (리더보드, DM, 게시판)

**리더보드:** 팀별 수익률, 샤프지수, MDD 비교 (공개 동의 팀만)

**팀 간 DM:** TeamMessage, 팀장/부팀장만 발신 가능

**게시판:** Post(운용보고서/칼럼/분석리포트/자유/공지), PostComment, is_premium 플래그 (마켓 연동)

### F. 크레딧 시스템 (구매, 적립, 전환)

**핵심 모델:**
- `CreditAccount`: team_id, balance_credits, total_earned, total_spent
- `CreditTransaction`: transaction_type (purchase/spend/earn/subscription/refund), amount_credits, amount_krw

**순환 구조:**
- 현금 → 크레딧 구매
- 크레딧 → 콘텐츠 구매/구독료 결제
- 콘텐츠 판매 → 크레딧 적립
- 적립 크레딧 → 구독료 전환 가능

**PG사 연동 필요** (토스페이먼츠, 아임포트 등)

### G. 마켓플레이스 (판매, 구독, 정산)

**거래 가능 콘텐츠:**
1. 포트폴리오 열람권 (회당/월 구독)
2. 운용보고서/분석리포트 개별 판매
3. 칼럼 구독 (월/분기/연)

**수익 정산:** 공급 팀 80% / 운영사 20% (플랫폼 수수료)

**핵심 모델:**
- `ContentPurchase`: buyer_team_id, seller_team_id, content_type, price_credits
- `ContentSubscription`: subscriber_team_id, publisher_team_id, plan, auto_renew

**구현 순서:** B → C → D → E → F → G (의존성 순)

---

## Part 6: Spring Boot 매핑 가이드

### 6.1 인증/권한

| FastAPI (현재) | Spring Boot (목표) |
|---------------|-------------------|
| `dependencies.py` (Depends 기반 DI) | Spring Security FilterChain + @PreAuthorize |
| `get_current_user` (HTTPBearer + decode_token) | JwtAuthenticationFilter + SecurityContextHolder |
| `get_manager_or_admin` | `@PreAuthorize("hasAnyRole('MANAGER','ADMIN')")` |
| `get_manager` | `@PreAuthorize("hasRole('MANAGER')")` |
| `get_writer_user` (viewer 제외) | `@PreAuthorize("!hasRole('VIEWER')")` |
| JWT (python-jose HS256) | jjwt 또는 Spring Security OAuth2 Resource Server |
| UserRole (Python Enum, .value 사용) | Java Enum + @Enumerated(EnumType.STRING) |

### 6.2 검증/직렬화

| FastAPI (현재) | Spring Boot (목표) |
|---------------|-------------------|
| Pydantic BaseModel (스키마 50+ 개) | Jakarta Validation (@Valid, @NotBlank, @Size 등) + DTO 클래스 |
| `model_dump(exclude_unset=True)` | MapStruct 또는 ModelMapper |
| `response_model=APIResponse` | ResponseEntity<ApiResponse<T>> |
| `convert_targets()` (Decimal 변환) | BigDecimal + Custom Deserializer |
| pydantic_settings BaseSettings (.env) | @ConfigurationProperties + application.yml |

### 6.3 WebSocket

| FastAPI (현재) | Spring Boot (목표) |
|---------------|-------------------|
| 순수 WebSocket (JSON 메시지) | STOMP over SockJS |
| ConnectionManager (인메모리 Dict) | Spring MessageBroker + SimpMessagingTemplate |
| discussion_rooms (Dict[int, Set]) | STOMP destination: /topic/discussion/{id} |
| price_subscriptions (Dict[str, Set]) | STOMP destination: /topic/price/{ticker} |
| manager.broadcast_to_discussion() | messagingTemplate.convertAndSendToUser() |
| WebSocket 토큰 인증 (쿼리 파라미터) | STOMP CONNECT 프레임 + ChannelInterceptor |

### 6.4 스케줄러

| FastAPI (현재) | Spring Boot (목표) |
|---------------|-------------------|
| APScheduler (AsyncIOScheduler) | @Scheduled (Spring Scheduler) 또는 Quartz |
| CronTrigger(hour=5, minute=30) | `@Scheduled(cron = "0 30 5 * * *", zone = "Asia/Seoul")` |
| SessionLocal() (수동 세션 관리) | @Transactional + 자동 세션 관리 |

### 6.5 ORM/데이터 접근

| FastAPI (현재) | Spring Boot (목표) |
|---------------|-------------------|
| SQLAlchemy ORM (Session 기반) | JPA/Hibernate + Spring Data JPA |
| `db.query(Model).filter()` | JpaRepository + @Query 또는 QueryDSL |
| `with_for_update()` (Row-level lock) | `@Lock(LockModeType.PESSIMISTIC_WRITE)` |
| `flag_modified(position, 'buy_plan')` | @DynamicUpdate 또는 EntityManager.merge() |
| JSON 컬럼 (SQLAlchemy JSON type) | `@Type(JsonType.class)` (hibernate-types) |
| `convert_targets()` (리스트 → JSON) | @Convert + AttributeConverter<List, String> |
| Alembic 마이그레이션 | Flyway 또는 Liquibase |
| `db.commit()` / `db.refresh()` | @Transactional (자동 커밋) |

### 6.6 외부 서비스

| FastAPI (현재) | Spring Boot (목표) |
|---------------|-------------------|
| OpenAI Python SDK (openai) | OpenAI Java SDK 또는 Spring AI |
| yfinance (시세/뉴스/검색) | Yahoo Finance API (REST) 또는 marketstack |
| PyKRX (한국 주식 목록) | KRX Open API 또는 한국투자증권 API |
| httpx (Binance API, 비동기) | WebClient (Spring WebFlux) |
| pywebpush (Web Push) | web-push 라이브러리 (Java) |
| smtplib (이메일) | Spring Mail (JavaMailSender) |
| rapidfuzz (퍼지 검색) | Apache Lucene 또는 FuzzyWuzzy Java |

### 6.7 주요 서비스 → Spring Service 매핑

| Python 서비스 | Spring 대응 | 비고 |
|--------------|------------|------|
| AuthService | AuthService + Spring Security | UserDetailsService 구현 |
| RequestService | RequestService | @Transactional, 포지션 생성 연계 |
| PositionService | PositionService | BigDecimal 연산, 감사 로그 AOP |
| DiscussionService | DiscussionService | 세션 관리 복잡 → 도메인 이벤트 고려 |
| AIService | AIService | Responses API + Chat Completions 이중 호출 |
| NewsDeskAI | NewsDeskAIService | JSON 파싱 로직 주의 |
| NotificationService | NotificationService | @Async + WebSocket + Web Push |
| PriceService | PriceService | @Cacheable(1분), WebClient 비동기 |
| PushService | PushService | VAPID 인증, 만료 구독 정리 |
| StockSearchService | StockSearchService | @Cacheable(24시간), PyKRX → KRX API |
| AssetService | AssetService | 비동기 시세 조회 → CompletableFuture |
| StatsService | StatsService | 복잡한 집계 → QueryDSL 또는 Native Query |
| AuditService | AuditService | Spring AOP @Around로 자동화 가능 |
| EmailService | EmailService | JavaMailSender |
| NewsCrawler | NewsCrawlerService | RestTemplate/WebClient |
| Scheduler | @Scheduled 메서드들 | SchedulerConfig 클래스 |

### 6.8 특별 주의사항

1. **Decimal 처리**: Python `Decimal` → Java `BigDecimal`. SQLAlchemy JSON 안의 숫자도 Decimal로 처리됨
2. **KST 시간대**: 코드 전반에서 `datetime.now(KST)` 사용. Spring에서는 `ZonedDateTime.now(ZoneId.of("Asia/Seoul"))`
3. **JSON 컬럼**: buy_plan, take_profit_targets, stop_loss_targets, chart_data, position_details 등이 JSON 컬럼. JPA에서는 hibernate-types의 `@Type(JsonType.class)` 사용
4. **flag_modified**: SQLAlchemy에서 JSON 컬럼 변경 감지를 위해 필요. JPA에서는 불필요 (dirty checking 자동)
5. **with_for_update**: AI 사용량 동시성 제어에 사용. `@Lock(PESSIMISTIC_WRITE)` 대응
6. **서비스 간 의존**: RequestService → PositionService, NotificationService → PushService → WebSocket manager. Spring DI로 자연스럽게 처리
7. **Responses API**: OpenAI의 새 API. Java SDK 호환 여부 확인 필요. fallback 로직 유지 권장
8. **비동기 패턴**: FastAPI는 async/await 기본. Spring에서는 @Async + CompletableFuture 또는 WebFlux 고려
