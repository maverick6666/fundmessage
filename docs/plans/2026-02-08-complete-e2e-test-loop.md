# Complete E2E Test Loop Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 모든 시나리오(A~O, 165+)를 두 브라우저로 테스트하고, 오류 발견 시 즉시 수정하며, 100% 통과할 때까지 무한 반복

**Architecture:**
- Browser 1 (Main): 팀장 계정
- Browser 2 (Incognito): 팀원 계정
- 각 테스트마다: 실행 → 스크린샷 → 검증 → 실패시 수정 → 재테스트
- 스크린샷: `test-screenshots/2026-02-08/` 폴더에 저장

**Tech Stack:** Playwright MCP, Docker, FastAPI, Vite, PostgreSQL

---

## 핵심 원칙

### 1. 테스트 루프 구조
```
FOR each scenario:
  1. Execute test with Playwright MCP
  2. Capture screenshot → test-screenshots/2026-02-08/{scenario_id}.png
  3. Check browser console errors
  4. Check network request failures
  5. Verify expected result

  IF FAIL:
    a. Analyze error (screenshot + console + backend logs)
    b. IF UI issue → Use frontend-design skill
    c. IF Backend issue → Direct code fix
    d. GOTO step 1 (re-test)

  IF PASS:
    a. Update TEST_SCENARIOS.md (check off)
    b. Update docs/TEST_RESULTS.md (add result)
    c. Continue to next scenario
```

### 2. 두 브라우저 관리
- **mainPage**: 팀장 브라우저 (Playwright default context)
- **incognitoPage**: 팀원 브라우저 (separate context)
- 동시 테스트 시 양쪽 스크린샷 캡처

### 3. 오류 수집 코드
```javascript
// 각 테스트 전에 실행
const errors = [];
page.on('console', msg => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('requestfailed', req => {
  errors.push(`Request failed: ${req.url()} - ${req.failure()?.errorText}`);
});
```

---

## Phase 0: 환경 준비

### Task 0: 스크린샷 폴더 및 결과 파일 준비

**Step 1: 폴더 구조 확인**
```
test-screenshots/
└── 2026-02-08/
    ├── A_auth/
    ├── B_dashboard/
    ├── C_positions/
    ├── D_requests/
    ├── E_discussions/
    ├── F_reports/
    ├── G_stats/
    ├── H_notifications/
    ├── I_team_management/
    ├── J_settings/
    ├── K_ai/
    ├── L_attendance/
    ├── M_admin_mode/
    ├── N_integration/
    └── O_newsdesk/
```

**Step 2: 결과 파일 생성**
Create: `docs/TEST_RESULTS.md`
```markdown
# E2E 테스트 결과

> 테스트 일시: 2026-02-08
> 환경: 로컬 (Docker DB + Backend + Frontend)

## 요약
| 카테고리 | 총 시나리오 | 통과 | 실패 | 진행률 |
|----------|-------------|------|------|--------|
| A. 인증 | 3 | 0 | 0 | 0% |
| B. 대시보드 | 4 | 0 | 0 | 0% |
| ... | ... | ... | ... | ... |

## 상세 결과
### A. 인증 (Auth)
- [ ] A1. 회원가입 - 미테스트
- [ ] A2. 로그인 - 미테스트
- [ ] A3. 로그아웃 - 미테스트
```

**Step 3: 두 브라우저 세션 초기화**
```javascript
// Playwright MCP로 실행
async (page) => {
  const browser = page.context().browser();

  // 팀장 브라우저 (이미 로그인됨)
  const mainPage = page;

  // 팀원 브라우저 (incognito)
  const incognitoContext = await browser.newContext();
  const incognitoPage = await incognitoContext.newPage();

  // 팀원 로그인
  await incognitoPage.goto('http://localhost:3000/login');
  await incognitoPage.fill('[placeholder="email@example.com"]', 'test@naver.com');
  await incognitoPage.fill('[placeholder="********"]', '12345678');
  await incognitoPage.click('button:has-text("로그인")');
  await incognitoPage.waitForURL('**/*');

  return { mainUrl: await mainPage.url(), incognitoUrl: await incognitoPage.url() };
}
```

---

## Phase 1: 인증 테스트 (A1-A3)

### Task 1: A1. 회원가입 테스트

**Files:**
- Screenshot: `test-screenshots/2026-02-08/A_auth/A1_signup_*.png`
- Update: `docs/TEST_RESULTS.md`

**Step 1: 로그아웃 후 회원가입 페이지 접근**

Playwright MCP:
```javascript
async (page) => {
  // 새 컨텍스트로 비로그인 상태 테스트
  const browser = page.context().browser();
  const freshContext = await browser.newContext();
  const freshPage = await freshContext.newPage();

  await freshPage.goto('http://localhost:3000/signup');
  await freshPage.screenshot({ path: 'test-screenshots/2026-02-08/A_auth/A1_signup_form.png' });

  // 폼 요소 확인
  const hasEmailField = await freshPage.locator('input[placeholder*="email"]').isVisible();
  const hasNameField = await freshPage.locator('input[placeholder*="홍길동"]').isVisible();
  const hasPasswordField = await freshPage.locator('input[placeholder*="8자"]').isVisible();
  const hasSubmitBtn = await freshPage.locator('button:has-text("가입하기")').isVisible();

  await freshContext.close();

  return { hasEmailField, hasNameField, hasPasswordField, hasSubmitBtn };
}
```

Expected: 모든 필드 `true`

**Step 2: 실패 시 수정**

IF 실패:
1. 스크린샷 분석
2. UI 문제 → `Skill: frontend-design` 호출
3. 백엔드 문제 → 직접 수정
4. Step 1 재실행

**Step 3: 에러 케이스 테스트 - 비밀번호 불일치**

```javascript
async (page) => {
  const browser = page.context().browser();
  const ctx = await browser.newContext();
  const p = await ctx.newPage();

  await p.goto('http://localhost:3000/signup');
  await p.fill('input[placeholder*="email"]', 'error-test@test.com');
  await p.fill('input[placeholder*="홍길동"]', '에러테스트');
  await p.fill('input[placeholder*="8자"]', 'password1');
  await p.fill('input[placeholder*="다시 입력"]', 'password2'); // 불일치
  await p.click('button:has-text("가입하기")');

  await p.waitForTimeout(1000);
  await p.screenshot({ path: 'test-screenshots/2026-02-08/A_auth/A1_signup_password_mismatch.png' });

  const errorVisible = await p.locator('text=/불일치|일치하지|다릅니다/i').isVisible();
  await ctx.close();

  return { errorVisible };
}
```

Expected: `{ errorVisible: true }`

**Step 4: 결과 기록**

Update `docs/TEST_RESULTS.md`:
```markdown
- [x] A1. 회원가입 - PASS (2026-02-08 HH:MM)
  - 폼 표시: OK
  - 비밀번호 불일치 에러: OK
  - 스크린샷: A_auth/A1_*.png
```

---

### Task 2: A2. 로그인 테스트

**Step 1: 올바른 자격증명으로 로그인**

```javascript
async (page) => {
  const browser = page.context().browser();
  const ctx = await browser.newContext();
  const p = await ctx.newPage();

  // 콘솔 에러 수집
  const errors = [];
  p.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  await p.goto('http://localhost:3000/login');
  await p.screenshot({ path: 'test-screenshots/2026-02-08/A_auth/A2_login_form.png' });

  await p.fill('input[placeholder*="email"]', 'lhhh0420@naver.com');
  await p.fill('input[placeholder*="***"]', 'lhh0420!');
  await p.click('button:has-text("로그인")');

  await p.waitForURL('**/*', { timeout: 5000 });
  await p.screenshot({ path: 'test-screenshots/2026-02-08/A_auth/A2_login_success.png' });

  const url = p.url();
  const loggedIn = !url.includes('/login');

  await ctx.close();
  return { loggedIn, finalUrl: url, consoleErrors: errors };
}
```

Expected: `{ loggedIn: true, finalUrl: 'http://localhost:3000/', consoleErrors: [] }`

**Step 2: 잘못된 비밀번호 테스트**

```javascript
async (page) => {
  const browser = page.context().browser();
  const ctx = await browser.newContext();
  const p = await ctx.newPage();

  await p.goto('http://localhost:3000/login');
  await p.fill('input[placeholder*="email"]', 'lhhh0420@naver.com');
  await p.fill('input[placeholder*="***"]', 'wrongpassword');
  await p.click('button:has-text("로그인")');

  await p.waitForTimeout(2000);
  await p.screenshot({ path: 'test-screenshots/2026-02-08/A_auth/A2_login_wrong_password.png' });

  // 오류 메시지 또는 토스트 확인
  const errorVisible = await p.locator('text=/잘못|오류|실패|incorrect/i').isVisible();
  const stillOnLogin = p.url().includes('/login');

  await ctx.close();
  return { errorVisible, stillOnLogin };
}
```

Expected: `{ errorVisible: true, stillOnLogin: true }`

---

### Task 3: A3. 로그아웃 테스트

**Step 1: 로그아웃 버튼 클릭**

Playwright MCP (mainPage - 팀장):
```javascript
await page.click('button:has-text("로그아웃")');
await page.waitForURL('**/login');
await page.screenshot({ path: 'test-screenshots/2026-02-08/A_auth/A3_logout.png' });
return { url: page.url(), onLoginPage: page.url().includes('/login') };
```

Expected: `{ onLoginPage: true }`

**Step 2: 재로그인 (다음 테스트를 위해)**

```javascript
await page.fill('input[placeholder*="email"]', 'lhhh0420@naver.com');
await page.fill('input[placeholder*="***"]', 'lhh0420!');
await page.click('button:has-text("로그인")');
await page.waitForURL('**/*');
return { loggedIn: !page.url().includes('/login') };
```

---

## Phase 2: 대시보드 테스트 (B1-B4)

### Task 4: B1. 대시보드 조회

**Step 1: 대시보드 접속 및 기본 UI 확인**

```javascript
async (page) => {
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto('http://localhost:3000/dashboard');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'test-screenshots/2026-02-08/B_dashboard/B1_dashboard_main.png', fullPage: true });

  // 주요 섹션 확인
  const checks = {
    hasSidebar: await page.locator('nav').isVisible(),
    hasHeader: await page.locator('header').isVisible(),
    hasMainContent: await page.locator('main').isVisible(),
  };

  return { checks, consoleErrors: errors };
}
```

**Step 2: 백엔드 로그 확인**

Run: `docker logs fundmessage-backend --tail 20`

Expected: 500 에러 없음

---

### Task 5: B2. 팀 정보 탭 테스트

**Step 1: 팀 정보 탭 클릭**

```javascript
async (page) => {
  await page.goto('http://localhost:3000/dashboard');
  await page.waitForLoadState('networkidle');

  // 팀 정보 탭 찾기
  const teamTab = page.locator('button:has-text("팀 정보"), [role="tab"]:has-text("팀 정보")');
  if (await teamTab.isVisible()) {
    await teamTab.click();
    await page.waitForTimeout(500);
  }

  await page.screenshot({ path: 'test-screenshots/2026-02-08/B_dashboard/B2_team_info_tab.png', fullPage: true });

  // 팀원 목록 확인
  const hasTeamMembers = await page.locator('text=/팀원|멤버|member/i').isVisible();

  return { hasTeamMembers };
}
```

---

### Task 6: B3. 팀 설정 (팀장)

**Step 1: 팀 설정 버튼 확인 (팀장에게만 표시)**

```javascript
async (page) => {
  await page.goto('http://localhost:3000/dashboard');
  await page.waitForLoadState('networkidle');

  const settingsBtn = page.locator('button:has-text("팀 설정"), button:has-text("설정")');
  const isVisible = await settingsBtn.isVisible();

  await page.screenshot({ path: 'test-screenshots/2026-02-08/B_dashboard/B3_team_settings_btn.png' });

  return { settingsButtonVisible: isVisible };
}
```

**Step 2: 팀원 브라우저에서 팀 설정 버튼 숨김 확인**

```javascript
async (page) => {
  const browser = page.context().browser();
  const contexts = browser.contexts();
  const incognitoCtx = contexts.find(c => c !== page.context());

  if (!incognitoCtx) return { error: 'No incognito context found' };

  const incognitoPage = incognitoCtx.pages()[0];
  await incognitoPage.goto('http://localhost:3000/dashboard');
  await incognitoPage.waitForLoadState('networkidle');

  const settingsBtn = incognitoPage.locator('button:has-text("팀 설정")');
  const isVisible = await settingsBtn.isVisible();

  await incognitoPage.screenshot({ path: 'test-screenshots/2026-02-08/B_dashboard/B3_team_settings_member_view.png' });

  return { settingsButtonVisibleToMember: isVisible };
}
```

Expected: `{ settingsButtonVisibleToMember: false }`

---

## Phase 3: 포지션 테스트 (C1-C8)

### Task 7: C1. 포지션 목록 조회

**Step 1: 포지션 페이지 접속**

```javascript
async (page) => {
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('requestfailed', req => errors.push(`Failed: ${req.url()}`));

  await page.goto('http://localhost:3000/positions');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'test-screenshots/2026-02-08/C_positions/C1_positions_list.png', fullPage: true });

  // 포지션 카드 또는 빈 상태 메시지
  const hasPositions = await page.locator('[class*="position"], [class*="card"]').count() > 0;
  const hasEmptyMessage = await page.locator('text=/포지션이 없|비어 있|no positions/i').isVisible();

  return { hasPositions, hasEmptyMessage, errors };
}
```

---

## Phase 4: 요청 테스트 (D1-D6)

### Task 8: D1-D2. 요청 목록 및 승인 플로우

**두 브라우저 동시 테스트**

**Step 1: 팀원이 매수 요청 제출**

```javascript
// incognitoPage (팀원)
async (page) => {
  const browser = page.context().browser();
  const incognitoCtx = browser.contexts().find(c => c !== page.context());
  const memberPage = incognitoCtx.pages()[0];

  await memberPage.goto('http://localhost:3000/requests');
  await memberPage.waitForLoadState('networkidle');
  await memberPage.screenshot({ path: 'test-screenshots/2026-02-08/D_requests/D1_requests_member_view.png' });

  // 매수 요청 버튼 클릭
  const buyBtn = memberPage.locator('button:has-text("매수 요청"), button:has-text("+ 요청")');
  if (await buyBtn.isVisible()) {
    await buyBtn.click();
    await memberPage.waitForTimeout(500);
    await memberPage.screenshot({ path: 'test-screenshots/2026-02-08/D_requests/D1_buy_request_form.png' });
  }

  return { formOpened: true };
}
```

**Step 2: 팀장이 요청 확인 및 승인**

```javascript
// mainPage (팀장)
async (page) => {
  await page.goto('http://localhost:3000/requests');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'test-screenshots/2026-02-08/D_requests/D2_requests_manager_view.png' });

  // 대기중 요청 확인
  const pendingRequest = page.locator('text=/대기|pending/i').first();
  const hasPending = await pendingRequest.isVisible();

  return { hasPendingRequest: hasPending };
}
```

---

## Phase 5: 토론방 테스트 (E1-E6)

### Task 9: E2. 실시간 메시지 테스트 (두 브라우저)

**Step 1: 토론방 생성 또는 기존 토론방 접속**

```javascript
async (page) => {
  await page.goto('http://localhost:3000/discussions');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'test-screenshots/2026-02-08/E_discussions/E1_discussions_list.png' });

  // 토론방이 있으면 첫 번째 클릭
  const firstDiscussion = page.locator('[class*="discussion"], [class*="card"]').first();
  if (await firstDiscussion.isVisible()) {
    await firstDiscussion.click();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-screenshots/2026-02-08/E_discussions/E2_discussion_detail.png' });
    return { hasDiscussion: true };
  }

  return { hasDiscussion: false };
}
```

**Step 2: 두 브라우저에서 동시 메시지 테스트**

```javascript
async (page) => {
  // 팀장 메시지 전송
  const input = page.locator('input[placeholder*="메시지"], textarea');
  if (await input.isVisible()) {
    await input.fill('팀장 테스트 메시지 ' + Date.now());
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-screenshots/2026-02-08/E_discussions/E2_manager_sent.png' });
  }

  // 팀원 브라우저에서 메시지 수신 확인
  const browser = page.context().browser();
  const incognitoCtx = browser.contexts().find(c => c !== page.context());
  const memberPage = incognitoCtx.pages()[0];

  await memberPage.goto(page.url()); // 같은 토론방
  await memberPage.waitForTimeout(1000);
  await memberPage.screenshot({ path: 'test-screenshots/2026-02-08/E_discussions/E2_member_received.png' });

  return { testComplete: true };
}
```

---

## Phase 6: 나머지 시나리오 (F-O)

### Task 10-20: 동일한 패턴으로 진행

각 시나리오에 대해:
1. Playwright MCP로 테스트 실행
2. 스크린샷 저장
3. 검증
4. 실패 시 → frontend-design 스킬 또는 백엔드 수정 → 재테스트
5. 성공 시 → TEST_RESULTS.md 업데이트

---

## Phase 7: 통합 테스트 (N1-N8)

### Task 21: N1. 요청 → 토론 → 승인 전체 플로우

**Step 1-8: 전체 플로우 실행**

이 테스트는 두 브라우저를 번갈아 사용:
1. 팀원: 매수 요청 제출
2. 팀장: 알림 확인
3. 팀장: 토론 시작
4. 팀원: 토론 참여
5. 팀장: 토론 종료
6. 팀장: 요청 승인
7. 팀원: 알림 확인
8. 양쪽: 포지션 생성 확인

각 단계마다 스크린샷 캡처

---

## 오류 발생 시 수정 가이드

### UI 문제 (프론트엔드)
```
1. 스크린샷 분석
2. Skill 호출: frontend-design
3. 수정 사항 전달
4. 수정 완료 후 해당 테스트 재실행
```

### API 오류 (백엔드)
```
1. docker logs fundmessage-backend --tail 50
2. 오류 분석
3. 백엔드 코드 직접 수정
4. docker restart fundmessage-backend
5. 해당 테스트 재실행
```

### 데이터 문제 (DB)
```
1. docker exec fundmessage-db psql -U funduser -d fundmessenger -c "SELECT ..."
2. 필요시 데이터 수정/삽입
3. 해당 테스트 재실행
```

---

## 완료 조건

모든 항목이 통과해야 완료:

- [ ] A. 인증 (3개 시나리오)
- [ ] B. 대시보드 (4개 시나리오)
- [ ] C. 포지션 (8개 시나리오)
- [ ] D. 요청 (6개 시나리오)
- [ ] E. 토론방 (6개 시나리오)
- [ ] F. 문서 (6개 시나리오)
- [ ] G. 통계 (2개 시나리오)
- [ ] H. 알림 (4개 시나리오)
- [ ] I. 팀 관리 (5개 시나리오)
- [ ] J. 설정 (1개 시나리오)
- [ ] K. AI 기능 (2개 시나리오)
- [ ] L. 출석 (3개 시나리오)
- [ ] M. 관리자 모드 (1개 시나리오)
- [ ] N. 통합 플로우 (8개 시나리오)
- [ ] O. 뉴스데스크 (7개 시나리오)

**총 66개 시나리오**

---

## 예상 소요 시간

| Phase | 설명 | 예상 시간 |
|-------|------|----------|
| 0 | 환경 준비 | 5분 |
| 1 | 인증 (A) | 10분 |
| 2 | 대시보드 (B) | 15분 |
| 3 | 포지션 (C) | 30분 |
| 4 | 요청 (D) | 20분 |
| 5 | 토론방 (E) | 25분 |
| 6 | 나머지 (F-M, O) | 60분 |
| 7 | 통합 테스트 (N) | 40분 |

**총 예상: 3-4시간** (오류 수정 포함 시 5-6시간)
