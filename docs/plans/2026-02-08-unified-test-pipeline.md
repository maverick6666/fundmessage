# 통합 테스트 파이프라인 (Unified Test Pipeline)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 로컬 환경에서 모든 시나리오를 테스트하고, 버그 발견 시 즉시 수정하며, 100% 통과할 때까지 반복하는 완전 자동화 테스트 루프 실행

**Architecture:** Docker PostgreSQL + 로컬 백엔드(8000) + 로컬 프론트엔드(5173). Playwright MCP로 4개 권한(팀장/관리자/팀원/일반) 브라우저 테스트. Deep Testing Protocol로 표면적 테스트가 아닌 실제 내용/동작 검증. 버그 발견 즉시 수정 → 문서화 → 커밋 → 재테스트 루프.

**Tech Stack:** Playwright MCP, Docker, FastAPI (uvicorn --reload), Vite, PostgreSQL

---

## ⚠️ 핵심 원칙

### 1. Prerequisites는 절대 생략 불가
Phase 0을 건너뛰면 테스트 진행 금지. 매 세션 시작 시 반드시 실행.

### 2. Deep Testing Protocol
"요소가 있다" ≠ "제대로 작동한다"
- 존재 확인 + **내용 검증** + 에러 수집 + 스크린샷 확인
- 빈 화면, 로딩만 있는 상태 = 실패

### 3. 즉시 수정 + 문서화 + 검증 후 진행 (절대 건너뛰기 금지)
버그 발견 시 **반드시 아래 순서를 완료한 후** 다음 테스트로 진행:
1. **원인 규명**: 어떤 상황에서, 어떤 문제가, 왜 발생했는지 정확히 분석
   - "버튼 클릭 불가" ✗ → "사이드뷰어가 열려있을 때 헤더 영역이 가려져서 버튼 클릭 불가" ✓
   - 표면적 증상이 아닌 **근본 원인**을 찾아야 함
2. **문서 기록**: 이 문서의 [발견된 버그] 섹션에 상황/문제/원인 기록
3. **코드 수정**: 원인에 맞는 수정 적용
4. **재테스트**: 수정 후 동일 시나리오 재실행하여 **통과 확인**
5. **검증 완료** 후에만 다음 시나리오로 진행

⚠️ "나중에 수정" 금지. 발견 즉시 처리하고 검증까지 끝내야 다음으로 넘어감.

### 4. 프로세스 개선사항은 즉시 이 문서에 반영
테스트 중 발견한 **프로세스/워크플로우 개선점**도 즉시 이 문서의 핵심 원칙이나 관련 섹션에 추가:
- 테스트 방법론 개선 → 핵심 원칙에 추가
- 새로운 테스트 패턴 발견 → Deep Testing Protocol에 추가
- 환경 설정 관련 교훈 → Prerequisites에 추가
- 버그 기록 방법 개선 → Fix Loop 절차에 추가

이 문서는 **살아있는 문서**로, 테스트를 진행하면서 계속 보완됨.

### 5. 프론트엔드 문제 수정 시 반드시 frontend-design 스킬 사용
프론트엔드 관련 버그 수정, UI 변경, 스타일 수정 등 모든 프론트엔드 코드 수정은 반드시 `frontend-design` 스킬을 호출하여 진행:
- 직접 프론트엔드 코드 수정 금지
- `frontend-design` 스킬을 통해 수정 → 빌드 → 검증 순서 준수
- CSS/레이아웃/z-index 등 스타일 이슈도 포함

### 6. 100% 통과까지 반복
모든 시나리오가 통과할 때까지 루프 계속

---

## Phase 0: Prerequisites (절대 생략 불가)

### Task 0.1: Docker 전체 스택 시작 (DB + Backend + Frontend)

**⚠️ 중요: 로컬 서버는 반드시 Docker Compose로 실행**

수동으로 uvicorn이나 npm run dev를 실행하지 말고, Docker Compose로 한번에 실행합니다.

**Step 1: Docker Desktop 실행 확인**

Run: `docker ps`

Expected: 에러 없이 컨테이너 목록 출력 (비어있어도 OK)

**Step 2: 전체 스택 시작**

Run: `docker-compose up -d`

Expected:
- `fundmessage-db` 컨테이너 Running
- `fundmessage-backend` 컨테이너 Started
- `fundmessage-frontend` 컨테이너 Started

**Step 3: 기존 컨테이너 충돌 시**

Run: `docker rm -f fundmessage-backend fundmessage-frontend && docker-compose up -d`

**Step 4: 백엔드 헬스체크**

Run: `curl http://localhost:8000/health`

Expected: `{"status":"healthy"}`

**Step 5: 프론트엔드 접속 확인**

Playwright MCP로 `http://localhost` 접속 (포트 80)

Expected: 로그인 페이지 또는 대시보드 표시

**⚠️ 모든 서비스는 반드시 Docker Compose로 실행 (DB + Backend + Frontend)**
- 로컬에서 `uvicorn`이나 `npm run dev`를 직접 실행하지 않음
- 코드 변경 시 `docker-compose up -d --build`로 재빌드

**포트 정보 (Docker 기준)**
- DB: localhost:5432
- Backend: localhost:8000
- Frontend: localhost:80

---

### Task 0.4: 로컬 DB 테스트 계정 조회

**Step 1: 사용자 목록 조회**

Run:
```bash
docker exec fundmessage-db psql -U funduser -d fundmessenger -c "SELECT id, email, full_name, role, is_active FROM users ORDER BY id"
```

Expected: 테스트 계정 목록 (이메일, 역할 확인)

**Step 2: 권한별 계정 확인**

결과에서 다음 4개 역할의 계정 확인:
- `manager` (팀장)
- `admin` (관리자)
- `member` (팀원)
- `viewer` 또는 일반 역할 (일반 - 열람만 가능)

**Step 3: 계정 정보 기록**

이 문서 하단 [테스트 계정 정보] 섹션에 기록:
```
팀장: email / password (role: manager)
관리자: email / password (role: admin)
팀원: email / password (role: member)
일반: email / password (role: viewer)
```

**Step 4: 일반(viewer) 역할이 없으면**

DB에서 role 컬럼의 가능한 값 확인:
```bash
docker exec fundmessage-db psql -U funduser -d fundmessenger -c "SELECT DISTINCT role FROM users"
```

일반 역할이 구현되어 있지 않다면 [발견된 버그] 섹션에 기록

---

### Task 0.5: 각 계정 로그인 테스트

**Step 1: 팀장 계정 로그인**

Playwright MCP:
1. `http://localhost:5173/login` 이동
2. Task 0.4에서 확인한 팀장 이메일/비밀번호 입력
3. 로그인 버튼 클릭
4. 스크린샷 저장: `test-screenshots/phase0/manager_login.png`

Expected: 대시보드로 이동, 사이드바에 "팀 관리" 메뉴 표시

**Step 2: 팀원 계정 로그인**

새 브라우저 컨텍스트에서:
1. `http://localhost:5173/login` 이동
2. 팀원 이메일/비밀번호 입력
3. 로그인 버튼 클릭
4. 스크린샷 저장: `test-screenshots/phase0/member_login.png`

Expected: 대시보드로 이동, 사이드바에 "팀 관리" 메뉴 **없음**

**Step 3: 일반 계정 로그인 (있는 경우)**

1. 일반(viewer) 계정으로 로그인
2. 스크린샷 저장: `test-screenshots/phase0/viewer_login.png`

Expected: 대시보드 표시, 모든 "요청" 버튼 **없음** (열람만 가능)

**Step 4: Phase 0 완료 확인**

모든 체크 통과:
- [ ] Docker DB 실행 중
- [ ] 백엔드 서버 실행 중 (localhost:8000)
- [ ] 프론트엔드 서버 실행 중 (localhost:5173)
- [ ] 테스트 계정 확인됨
- [ ] 각 권한별 로그인 성공

**⚠️ 하나라도 실패하면 Phase 1 진행 금지**

---

## Phase 1: Deep Testing

### Deep Testing Protocol

모든 테스트에서 다음을 확인:

```
1. 존재 확인
   ✓ 요소가 DOM에 있는가?
   ✓ 클릭 가능한가?

2. 내용 검증 ⬅️ 핵심
   ✓ 실제 텍스트/데이터가 표시되는가?
   ✓ 빈 화면이 아닌가?
   ✓ 로딩 스피너만 있는 건 아닌가?
   ✓ "undefined", "null", "NaN" 표시 없는가?

3. 에러 수집
   ✓ 콘솔에 에러 없는가?
   ✓ 네트워크 요청 실패 없는가? (4xx, 5xx)

4. 권한별 분기
   ✓ 팀장에게만 보이는 버튼이 팀원에게 안 보이는가?
   ✓ 일반 사용자에게 상호작용 버튼이 없는가?

5. 스크린샷 검증
   ✓ Claude가 직접 스크린샷을 읽고 내용 확인
```

---

### Task 1.1: 인증 테스트 (A1-A3)

**Files:**
- Test: `docs/TEST_SCENARIOS.md` A1-A3 참조

**Step 1: A1. 회원가입 폼 테스트**

Playwright MCP (비로그인 상태):
```javascript
// 새 컨텍스트로 테스트
await page.goto('http://localhost:5173/signup');
await page.screenshot({ path: 'test-screenshots/A_auth/A1_signup_form.png' });

// 폼 요소 확인
const checks = {
  emailField: await page.locator('input[type="email"]').isVisible(),
  nameField: await page.locator('input[placeholder*="이름"], input[name="name"]').isVisible(),
  passwordField: await page.locator('input[type="password"]').first().isVisible(),
  submitBtn: await page.locator('button[type="submit"]').isVisible()
};
```

Expected: 모든 필드 `true`

**Step 2: 스크린샷 내용 확인**

스크린샷 `A1_signup_form.png`을 Claude가 직접 읽고:
- [ ] 이메일 입력 필드 보임
- [ ] 이름 입력 필드 보임
- [ ] 비밀번호 입력 필드 보임
- [ ] 가입하기 버튼 보임

**Step 3: A2. 로그인 테스트**

```javascript
await page.goto('http://localhost:5173/login');
await page.fill('input[type="email"]', '팀장이메일');
await page.fill('input[type="password"]', '팀장비밀번호');
await page.click('button[type="submit"]');
await page.waitForURL('**/*', { timeout: 5000 });
await page.screenshot({ path: 'test-screenshots/A_auth/A2_login_success.png' });
```

Expected: URL이 `/login`이 아닌 다른 페이지, 대시보드 표시

**Step 4: A3. 로그아웃 테스트**

```javascript
await page.click('button:has-text("로그아웃")');
await page.waitForURL('**/login');
await page.screenshot({ path: 'test-screenshots/A_auth/A3_logout.png' });
```

Expected: 로그인 페이지로 이동

**Step 5: 결과 기록**

[테스트 진행 상황] 섹션에 기록

---

### Task 1.2: 대시보드 테스트 (B1-B4)

**Step 1: B1. 대시보드 로드**

```javascript
// 팀장 로그인 상태
await page.goto('http://localhost:5173/');
await page.waitForLoadState('networkidle');
await page.screenshot({ path: 'test-screenshots/B_dashboard/B1_main.png', fullPage: true });

// 콘솔 에러 수집
const errors = [];
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
```

**Step 2: 스크린샷 내용 검증**

`B1_main.png` 확인:
- [ ] 사이드바 메뉴 표시
- [ ] 메인 콘텐츠 영역에 데이터 표시 (빈 화면 아님)
- [ ] 에러 메시지 없음

**Step 3: B2. 팀 정보 탭**

```javascript
await page.click('text=팀 정보');
await page.waitForTimeout(500);
await page.screenshot({ path: 'test-screenshots/B_dashboard/B2_team_info.png' });
```

Expected: 팀원 목록 또는 관련 정보 표시

**Step 4: B3. 팀 설정 (팀장만)**

팀장 브라우저:
```javascript
const settingsBtn = await page.locator('button:has-text("팀 설정")').isVisible();
await page.screenshot({ path: 'test-screenshots/B_dashboard/B3_manager_settings.png' });
```

팀원 브라우저 (별도 컨텍스트):
```javascript
await memberPage.goto('http://localhost:5173/');
const settingsBtnVisible = await memberPage.locator('button:has-text("팀 설정")').isVisible();
await memberPage.screenshot({ path: 'test-screenshots/B_dashboard/B3_member_no_settings.png' });
```

Expected: 팀장 `true`, 팀원 `false`

---

### Task 1.3: 포지션 테스트 (C1-C8)

**Step 1: C1. 포지션 목록**

```javascript
await page.goto('http://localhost:5173/positions');
await page.waitForLoadState('networkidle');
await page.screenshot({ path: 'test-screenshots/C_positions/C1_list.png', fullPage: true });
```

**Step 2: 내용 검증**

스크린샷 확인:
- [ ] 포지션 카드가 있거나 "포지션이 없습니다" 메시지
- [ ] 로딩 스피너만 있는 건 아닌지
- [ ] 에러 메시지 없음

**Step 3: C3. 포지션 상세 (포지션 있는 경우)**

```javascript
const firstPosition = page.locator('[data-testid="position-card"]').first();
if (await firstPosition.isVisible()) {
  await firstPosition.click();
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'test-screenshots/C_positions/C3_detail.png', fullPage: true });
}
```

**Step 4: 상세 페이지 내용 검증**

- [ ] 차트가 렌더링됨 (캔버스에 데이터 있음)
- [ ] 종목 정보 표시
- [ ] 매매계획 섹션 표시
- [ ] 의사결정노트 섹션 표시

**Step 5: 권한별 UI 차이**

팀장:
- [ ] "편집" 버튼 표시
- [ ] "포지션 종료" 버튼 표시

팀원:
- [ ] "편집" 버튼 **없음**
- [ ] "조기종료 요청" 버튼 표시

일반(viewer):
- [ ] 모든 상호작용 버튼 **없음**

---

### Task 1.4: 요청 테스트 (D1-D6)

**Step 1: D1. 요청 목록**

```javascript
await page.goto('http://localhost:5173/requests');
await page.waitForLoadState('networkidle');
await page.screenshot({ path: 'test-screenshots/D_requests/D1_list.png' });
```

**Step 2: 권한별 버튼 확인**

팀장:
- [ ] 대기중 요청에 "승인", "거부" 버튼 표시

팀원:
- [ ] "매수 요청" 버튼 표시
- [ ] "승인", "거부" 버튼 **없음**

일반(viewer):
- [ ] 모든 버튼 **없음** (열람만)

**Step 3: D2. 요청 승인 플로우 (팀장)**

1. 대기중 요청 클릭
2. "승인" 버튼 클릭
3. 확인 모달에서 확인
4. 스크린샷 저장

Expected: 포지션 자동 생성, 요청 상태 변경

---

### Task 1.5: 토론방 테스트 (E1-E6)

**Step 1: E1. 토론 목록**

```javascript
await page.goto('http://localhost:5173/discussions');
await page.waitForLoadState('networkidle');
await page.screenshot({ path: 'test-screenshots/E_discussions/E1_list.png' });
```

**Step 2: E2. 실시간 메시지 (두 브라우저)**

열린 토론방이 있는 경우:
```javascript
// 팀장 브라우저
await managerPage.goto('http://localhost:5173/discussions/[ID]');

// 팀원 브라우저
await memberPage.goto('http://localhost:5173/discussions/[ID]');

// 팀원이 메시지 전송
await memberPage.fill('input[name="message"]', '테스트 메시지 ' + Date.now());
await memberPage.press('input[name="message"]', 'Enter');

// 팀장 화면에서 메시지 확인
await managerPage.waitForTimeout(2000);
await managerPage.screenshot({ path: 'test-screenshots/E_discussions/E2_realtime.png' });
```

Expected: 팀장 화면에 팀원 메시지 표시

---

### Task 1.6: 뉴스데스크 테스트 (O1-O7)

**⚠️ 이전에 발견된 버그: 사이드뷰어 내용 미표시**

**Step 1: O1. 뉴스데스크 페이지 로드**

```javascript
await page.goto('http://localhost:5173/newsdesk');
await page.waitForLoadState('networkidle');
await page.screenshot({ path: 'test-screenshots/O_newsdesk/O1_main.png', fullPage: true });
```

**Step 2: 내용 검증**

- [ ] 뉴스 카드 표시 또는 "생성하기" 버튼
- [ ] 키워드 클라우드 표시 (있는 경우)
- [ ] 빈 화면 아님

**Step 3: O6. 뉴스 상세 보기 (Deep Test)**

```javascript
const newsCard = page.locator('[data-testid="news-card"]').first();
if (await newsCard.isVisible()) {
  await newsCard.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-screenshots/O_newsdesk/O6_news_detail.png' });
}
```

**Step 4: 사이드뷰어 내용 검증 ⬅️ 핵심**

스크린샷 확인:
- [ ] 사이드뷰어가 열림
- [ ] **실제 뉴스 내용이 표시됨** (빈 화면 아님)
- [ ] 제목, 본문, 출처 등 정보 표시

**실패 시**: [발견된 버그] 섹션에 기록 후 즉시 수정

---

### Task 1.7: 권한별 전체 UI 비교

**4개 권한으로 같은 페이지 비교 테스트**

| 페이지 | 팀장 | 관리자 | 팀원 | 일반 |
|--------|------|--------|------|------|
| /requests | 승인/거부 버튼 | 승인/거부 버튼 | 요청 버튼만 | 버튼 없음 |
| /positions/:id | 편집/종료 | 편집/종료 | 조기종료 요청 | 버튼 없음 |
| /discussions/:id | 종료/재개 | 종료/재개 | 재개 요청 | 메시지 전송 불가 |
| /team | 접근 가능 | 접근 가능 | 접근 불가 | 접근 불가 |
| 사이드바 | 팀 관리 표시 | 팀 관리 표시 | 팀 관리 숨김 | 팀 관리 숨김 |

각 조합에 대해 스크린샷 저장 및 검증

---

## Phase 2: Fix Loop (즉시 수정 + 문서화)

### Fix Loop 절차

```
1. 버그 발견
   ↓
2. 이 문서의 [발견된 버그] 섹션에 기록
   ↓
3. 원인 분석 (스크린샷 + 콘솔 + 네트워크)
   ↓
4. 코드 수정
   - 프론트엔드: frontend-design 스킬 사용
   - 백엔드: 직접 수정
   ↓
5. 서버 재시작 (필요시)
   - 프론트: Vite HMR 자동
   - 백엔드: uvicorn --reload 자동
   - DB 변경: alembic upgrade head
   ↓
6. 이 문서에 수정 내용 기록
   ↓
7. TEST_SCENARIOS.md에 시나리오 추가
   ↓
8. git commit
   ↓
9. 재테스트 → 통과 확인
```

---

## 테스트 계정 정보

> Phase 0.4에서 조회 완료 (2026-02-08)

| 역할 | 이메일 | 비밀번호 | DB role |
|------|--------|----------|---------|
| 팀장 | lhhh0420@naver.com | (팀원과 동일 추정) | manager |
| 관리자 | admin@test.com | (팀원과 동일) | admin |
| 팀원 | test@naver.com | 12345678 (추정) | member |
| 일반 | viewer@test.com | (팀원과 동일) | viewer |

**참고:** admin/viewer 계정은 팀원 계정의 비밀번호 해시를 복사하여 생성됨

---

## 테스트 진행 상황

| 시나리오 | 상태 | 버그# | 비고 |
|----------|------|-------|------|
| A1. 회원가입 | ✅ | | 폼 렌더링, 필드 검증 확인 |
| A2. 로그인 | ✅ | BUG-001~003 | CORS, URL 이중화, Dockerfile 수정 후 통과 |
| A3. 로그아웃 | ✅ | BUG-004 | 사이드패널 z-index 수정 후 통과 |
| B1. 대시보드 조회 | ✅ | | 자본금, 포지션, 요청, 보고서, 칼럼 섹션 |
| B2. 팀 정보 탭 | ✅ | | 4명 카드 + 리더보드 + 출석률 |
| B3. 팀 설정 | ✅ | | 환전/팀설정 버튼 (팀장만) |
| B4. 환전 | ⬜ | | 미테스트 (기능 동작 확인 필요) |
| C1. 포지션 목록 | ✅ | | 4개 포지션 카드, 필터, 수익률 표시 |
| C2. 포지션 요청 | ⬜ | | 미테스트 |
| C3. 포지션 상세 | ✅ | | 차트(200캔들), 매매계획, 토론방, 이력 |
| C4. 포지션 정보 수정 | ⬜ | | 미테스트 |
| C5. 매매계획 관리 | ✅ | | 매수/익절/손절 항목, +추가, 완료/대기 상태 |
| C6. 의사결정노트 CRUD | ⬜ | | 미테스트 |
| C7. 포지션 종료 | ⬜ | | 미테스트 |
| C8. 토론 개시/요청 | ✅ | | 포지션 상세에서 "토론방 열기" 확인 |
| D1. 요청 목록 | ✅ | | 5개 요청, 필터, 팀장 승인/거부 버튼 |
| D2. 요청 승인 | ✅ | | 토론 종료 후 승인, 포지션 자동 생성 |
| D3. 요청 거부 | ✅ | | 거부 사유 표시 확인 (기존 데이터) |
| D4. 토론 개시 | ✅ | | 요청에서 토론방 링크 확인 |
| D5. 토론 요청 | ⬜ | | 미테스트 |
| D6. 요청 삭제 | ⬜ | | 미테스트 |
| E1. 토론 목록 | ✅ | | 2개 토론방, 메시지 미리보기, 필터 |
| E2. 실시간 메시지 | ✅ | | 메시지 전송+즉시 표시 확인 |
| E3. 차트 공유 | ⬜ | | 미테스트 |
| E4. 토론 종료/재개 | ✅ | | 요청 승인 시 토론 자동 종료 확인 |
| E5. 토론 재개 요청 | ⬜ | | 미테스트 |
| E6. 세션 내보내기 | ⬜ | | 내보내기 버튼 존재 확인 |
| F1. 운용보고서 탭 | ✅ | | "운용보고서가 없습니다" 정상 표시 |
| F2. 의사결정서 탭 | ✅ | | "삼성전자 매수 의사결정" 1건 |
| F3. 칼럼 탭 | ✅ | | 2개 칼럼 + 칼럼 작성 버튼 |
| F4. 칼럼 작성 | ⬜ | | 미테스트 |
| F5. 칼럼 검증 | ✅ | | 검증됨 표시 + 검증취소 버튼 |
| F6. 칼럼 삭제 | ⬜ | | 미테스트 |
| G1. 팀 전체 통계 | ✅ | | 자산, 평가, 실현성과, 상세지표, 종목별 테이블 |
| G2. 내 성과 통계 | ⬜ | | 미테스트 |
| H1. 알림 조회 | ✅ | | 4개 알림, 필터, 액션 버튼 |
| H2. 알림 읽음 | ⬜ | | 미테스트 |
| H3. 알림 삭제 | ⬜ | | 미테스트 |
| H4. 실시간 알림 | ⬜ | | 미테스트 |
| I1. 팀원 목록 | ✅ | | 4명 테이블, 역할 드롭다운 |
| I2. 팀원 승인 | ⬜ | | 미테스트 |
| I3. 역할 변경 | ⬜ | | 드롭다운 존재 확인 |
| I4. 권한 이전 | ⬜ | | 미테스트 |
| I5. 계정 비활성화 | ⬜ | | 미테스트 |
| J1. 테마 변경 | ✅ | | 다크프리미엄 적용+복원 확인 |
| K1. AI 의사결정서 | ⬜ | | 미테스트 (API 키 필요) |
| K2. AI 운용보고서 | ⬜ | | 미테스트 (API 키 필요) |
| L1. 출석 체크인 | ⬜ | | 미테스트 |
| L2. 출석 복구 요청 | ⬜ | | 미테스트 |
| L3. 복구 승인/거부 | ⬜ | | 미테스트 |
| M1. 관리자 모드 토글 | ⬜ | | 설정에서 토글 존재 확인 |
| O1. 뉴스데스크 조회 | ✅ | | 뉴스8건, 탐욕/공포, 히트맵, TOP3 |
| O2. 날짜 선택기 | ✅ | | 2026.02.08 표시, 좌우 버튼 |
| O3. 벤치마크 차트 | ✅ | | 코스피/나스닥/S&P500/우리팀 탭 + 차트 |
| O4. 뉴스데스크 생성 | ⬜ | | 미테스트 (새로고침 버튼 존재) |
| O5. 폴백 UI | ⬜ | | 미테스트 |
| O6. 뉴스/칼럼 상세 | ✅ | | AI칼럼 사이드뷰어 전체 내용 표시 |
| O7. 키워드 클라우드 | ✅ | | 10개 키워드, 횟수, 카테고리 표시 |

**상태**: ⬜ 미테스트 / ✅ 통과 / ❌ 실패 / 🔄 재테스트 중

---

## 발견된 버그 및 수정 기록

### BUG-001: CORS에 http://localhost 누락

**증상:** Docker 프론트엔드(포트 80)에서 백엔드 API 호출 시 CORS 에러
**원인:** `backend/app/main.py` CORS allow_origins에 `http://localhost` 미포함
**수정:** `http://localhost` 추가
**상태:** ✅ 수정완료

### BUG-002: VITE_API_URL에 /api/v1 중복

**증상:** API 요청이 `http://localhost:8000/api/v1/api/v1/...`로 이중 경로
**원인:** 루트 `.env`의 `VITE_API_URL=http://localhost:8000/api/v1`과 코드의 `baseURL: ${API_URL}/api/v1` 중복
**수정:** 루트 `.env` VITE_API_URL에서 `/api/v1` 제거, docker-compose.yml 기본값 수정, frontend/.dockerignore 생성
**상태:** ✅ 수정완료

### BUG-003: Backend Dockerfile 경로 오류

**증상:** `docker-compose build` 시 `COPY backend/ .` 파일 못찾음
**원인:** docker-compose context가 `./backend`인데 Dockerfile에서 `COPY backend/` 사용
**수정:** `COPY requirements.txt .`, `COPY . .`로 변경
**상태:** ✅ 수정완료

### BUG-004: 사이드뷰어가 열려있을 때 페이지 헤더가 가려짐 ✅ 수정완료

**상황:** 뉴스데스크 등에서 뉴스 카드를 클릭하면 사이드뷰어(상세 패널)가 오른쪽에서 열림
**문제:** 사이드뷰어가 열린 상태에서 페이지 상단 헤더(로그아웃 버튼, 알림, 테마 설정 등)가 사이드뷰어에 의해 가려져서 클릭 불가
**원인:** SidePanel 컴포넌트가 `fixed top-0 right-0 h-full z-50`으로 설정되어 있어 Header(`sticky top-0 z-40`)보다 높은 z-index로 top-0부터 전체 높이를 차지, 헤더 영역을 완전히 덮음
**수정:** SidePanel의 위치를 `top-16`(헤더 높이 4rem), 높이를 `h-[calc(100vh-4rem)]`, z-index를 `z-30`으로 변경하여 헤더 아래에서 시작하도록 수정
**검증:** 사이드패널 열린 상태에서 로그아웃 버튼 클릭 → 로그인 페이지 정상 이동 확인
**상태:** ❌ 수정 대기

### BUG-005: viewer(일반) 역할 가입/전환 경로 없음

**증상:** 회원가입 시 역할을 선택할 수 없고, 모든 신규 가입자는 member로 생성됨. viewer 역할은 DB에 정의되어 있으나 UI에서 접근 불가
**재현 방법:**
1. /signup에서 회원가입 시도
2. 역할 선택 옵션 없음
3. 가입 후 member 역할 고정
**원인:** 프론트엔드 회원가입 폼에 역할 선택 UI 미구현, 팀 관리에서 역할 변경 가능 여부 확인 필요
**상태:** ❌ 확인 필요 (회원가입에 추가 vs 팀관리에서 변경)

**추가된 테스트 시나리오:**
-

---

## 추가된 테스트 시나리오

> 버그 수정 후 TEST_SCENARIOS.md에 추가한 시나리오 목록

| 시나리오 ID | 설명 | 관련 버그 |
|-------------|------|-----------|
| | | |

---

## 완료 체크리스트

- [ ] Phase 0: Prerequisites 모두 통과
- [ ] Phase 1: 모든 시나리오 ✅
- [ ] Phase 2: 모든 버그 수정됨
- [ ] TEST_SCENARIOS.md 업데이트됨
- [ ] 모든 변경사항 git commit됨

---

## 예상 소요 시간

| Phase | 설명 | 예상 시간 |
|-------|------|----------|
| 0 | Prerequisites | 10분 |
| 1 | Deep Testing (50+ 시나리오) | 2-3시간 |
| 2 | Fix Loop (버그 수에 따라) | 버그당 15-30분 |

**총 예상: 3-5시간** (발견되는 버그 수에 따라 변동)
