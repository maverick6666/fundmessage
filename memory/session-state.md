# 현재 세션 상태
> 마지막 업데이트: 2026-02-20 (클라우드타입 배포 준비 중)

## 개발 환경
- **배포 전환 중**: 로컬 Docker → 클라우드타입(백엔드+DB) + Vercel(프론트엔드)
- 프론트엔드: React + Vite → **Vercel** (https://fundmessage.vercel.app)
- **백엔드: Spring Boot** (`spring-backend/`) — FastAPI 완전 폐기, Spring Boot 단독
- DB: PostgreSQL — **클라우드타입 기존 인스턴스 재사용** (FastAPI 때 쓰던 것)
- 로컬 빌드/테스트: `docker-compose up -d --build`
- **푸쉬 규칙**: 사용자가 지시할 때만 git push (로컬 작업 우선)
- **PWA 지원**: manifest.json + sw.js + Web Push (VAPID)

## GitHub 레포 구조
| 레포 | 용도 | 내용 |
|------|------|------|
| `maverick6666/fundmessage` (개인) | **작업용** — 모든 것 포함 | spring-backend/ + frontend/ + memory/ + docs/ 등 |
| `Maverixxk/FundMassagenger` (조직) | **서버 배포용** — 클린 | backend/ + frontend/ (클라우드타입 연결) |

## 전체 로드맵

### Phase A: Spring Boot 리팩토링 완성 ✅ 완료
### Phase B: 뉴스데스크 v2 프론트엔드 ✅ 완료
### Phase C: 뉴스데스크 파이프라인 Spring Boot 병합 ✅ 완료
### Phase D: 클라우드타입 배포 + 실데이터 연동 🟡 진행중

## ───────────────────────────────────────
## 🔴 다음 작업: 클라우드타입 Spring Boot 배포
## ───────────────────────────────────────

### 배포 아키텍처
```
[Vercel] ← 프론트엔드 (React, 이미 배포됨)
   ↓ VITE_API_URL
[클라우드타입] ← Spring Boot 백엔드 (조직레포 backend/ 폴더)
   ↓ JDBC
[클라우드타입] ← PostgreSQL (기존 인스턴스, FastAPI 때부터 사용)
```

### 배포 순서
1. **DB 마이그레이션** (기존 FastAPI 스키마 → Spring Boot 스키마)
2. **클라우드타입 기존 FastAPI 서비스 → Spring Boot로 교체**
3. **환경변수 설정**
4. **파이프라인 실행** (POST /api/v1/newsdesk/v2/run-pipeline)
5. **프론트엔드 USE_MOCK = false 전환**

### Step 1: DB 마이그레이션 상세

**현재 설정**: `spring.jpa.hibernate.ddl-auto: update`
→ Hibernate가 자동으로 새 테이블/컬럼 추가하지만, 타입 변환은 수동 필요

#### 신규 테이블 5개 (Hibernate 자동 생성)
- `universities` — 대학교 관리
- `market_stocks` — 종목 마스터 (ticker, market, sector)
- `stock_news` — 뉴스-종목 커플링 (N:M 브릿지)
- `stock_daily_price` — 종목별 일일 OHLCV
- `market_summary` — 시장별 AI 브리핑

#### 신규 컬럼 8개 (Hibernate 자동 추가)
- `users`: `university_id` (FK→universities), `position_title`
- `raw_news`: `media_name`, `full_content`, `language`, `coupling_status`, `original_title`, `rewritten`

#### ⚠️ 수동 마이그레이션 필요 (timestamp 타입)
~9개 테이블에서 `timestamp` → `timestamptz` 변환 필요:
```sql
-- decision_notes, trading_plans, attendances, team_columns, comments,
-- notifications, news_desks, raw_news, asset_snapshots

-- 예시 (각 테이블의 created_at/updated_at 등):
ALTER TABLE decision_notes ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE decision_notes ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';
-- (comments만 'Asia/Seoul' 사용, 나머지는 'UTC')
```

#### 선택: json → jsonb 변환 (~7개 테이블, 성능 개선)
```sql
ALTER TABLE positions ALTER COLUMN buy_plan TYPE JSONB USING buy_plan::jsonb;
-- ... (기능적으로는 호환되므로 긴급하지 않음)
```

**판단 포인트**: 기존 DB에 중요한 데이터가 있으면 마이그레이션 SQL 먼저 실행. 테스트 데이터뿐이면 `ddl-auto: update`로 바로 배포해도 됨.

### Step 2: 클라우드타입 Spring Boot 서비스 설정
- **GitHub 연결**: `Maverixxk/FundMassagenger` 레포
- **Root Directory**: `backend`
- **빌드팩**: Java (Gradle 자동 감지)
- **포트**: `8000` (application.yaml의 server.port)

### Step 3: 환경변수 설정 (클라우드타입)
```
# DB (클라우드타입 PostgreSQL 내부 주소)
DATABASE_URL=jdbc:postgresql://<host>:5432/<dbname>
DB_USERNAME=<user>
DB_PASSWORD=<password>

# JWT
SECRET_KEY=<기존 JWT 시크릿 재사용>

# AI 파이프라인 (신규)
CEREBRAS_API_KEY=<키>
CEREBRAS_MODEL=gpt-oss-120b
MARKETAUX_API_KEY=<키>
NAVER_CLIENT_ID=<키>
NAVER_CLIENT_SECRET=<키>

# OpenAI (기존 기능: 의사결정서/운용보고서)
OPENAI_API_KEY=<키>
OPENAI_MODEL=gpt-5-mini

# VAPID (Push 알림)
VAPID_PUBLIC_KEY=<키>
VAPID_PRIVATE_KEY=<키>

# 기타
ENVIRONMENT=production
```

### Step 4: 파이프라인 실행
```bash
curl -X POST "https://<백엔드URL>/api/v1/newsdesk/v2/run-pipeline" \
  -H "Authorization: Bearer <JWT토큰>" \
  -H "Content-Type: application/json"
```
→ 뉴스 수집 → AI 재작성 → 종목 커플링 → 시장 요약 자동 실행
→ DB에 데이터 저장 → 프론트엔드 API로 조회 가능

### Step 5: 프론트엔드 전환
- `frontend/src/pages/NewsDesk.jsx`에서 `USE_MOCK = false`로 변경
- Vercel 재배포 (git push하면 자동)

## ───────────────────────────────────────

## Spring Boot 프로젝트 정보
- **로컬 위치**: `F:/fundmessage/spring-backend/`
- **조직 레포**: https://github.com/Maverixxk/FundMassagenger.git
- **개인 레포**: https://github.com/maverick6666/fundmessage.git
- **스택**: Java 21, Spring Boot 3.5.10, Gradle 8.14.4, PostgreSQL
- **구현 완료**: 인증, 포지션, 요청, 토론, 의사결정, 알림, 출석, 팀칼럼, 댓글, 감사로그, 매매계획, 통계/랭킹, AI호출(OpenAI), 시세(Yahoo+Binance), WebSocket, 리포트, 업로드, 뉴스데스크 v1+v2, **뉴스데스크 파이프라인**, **대학교 관리**
- **인프라**: JWT(JJWT), JSONB(hypersistence-utils), Web Push(VAPID), CORS, KstUtil

## 알려진 이슈
- Spring Boot 테스트 코드 0개
- Stats overview API 500 에러 (경로 또는 내부 로직 이슈)
- **🔴 텍스트 overflow (불구대천의 원수)**: Layout.jsx 1차 수정만 완료. 전수 점검 필요.
- AdminUniversities.jsx에서 `window.confirm()` 사용 중 (프로젝트 규칙 위반, ConfirmModal로 교체 필요)

## 프로젝트 비전 (확정)
- **대상**: 전국 50개 대학 투자동아리, 1,500~2,000명
- **성격**: 투자 커뮤니티 정보교환 플랫폼
- **AI 전략**: Cerebras API + GPT-OSS-120B → 트래픽 증가 시 자체 GPU 서버 전환
- **뉴스데스크**: 24시간 자동 운영 서비스 (서버 상시 가동)
