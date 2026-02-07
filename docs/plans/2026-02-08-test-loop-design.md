# 테스트 루프 설계 문서

> 작성일: 2026-02-08
> 목표: 모든 기능이 모든 경우의 수에서 의도한 대로 작동하는지 검증

---

## 1. 개요

### 테스트 범위
- **데이터 정합성**: 삭제/수정 후 연산 결과(손익, 자산변화율 등)가 정확한지
- **기능 동작**: 165개 이상의 테스트 시나리오 (E2E_TEST_SCENARIOS.md 참조)
- **역할별 접근 권한**: viewer/member/manager/admin이 각자 할 수 있는 것만 하는지

### 테스트 환경
- 로컬 백엔드 (localhost:8000)
- Docker PostgreSQL (테스트용 DB)
- Playwright (E2E 테스트)
- 두 브라우저 동시 실행 (팀장/팀원 상호작용)

---

## 2. 환경 설정

### 2.1 필수 환경변수 (.env)

```bash
# 루트 폴더에 .env 파일 생성
cp .env.example .env

# 필수 항목 입력:
DATABASE_URL=postgresql://funduser:fundpass123@localhost:5432/fundmessenger
SECRET_KEY=your-secret-key
CORS_ORIGINS=http://localhost:5173
OPENAI_API_KEY=sk-xxx  # AI 기능 테스트용
NAVER_CLIENT_ID=xxx    # 뉴스 크롤링 테스트용
NAVER_CLIENT_SECRET=xxx
```

### 2.2 Docker DB 시작

```bash
docker-compose up -d db
```

### 2.3 백엔드 시작

```bash
cd backend
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### 2.4 프론트엔드 시작

```bash
cd frontend
npm install
npm run dev
```

---

## 3. 테스트 실행

### 3.1 명령어

```bash
cd frontend

# 프로덕션 (Vercel) 대상 테스트
npm test

# 로컬 대상 테스트
npm run test:local

# UI 모드 (시각적 디버깅)
npm run test:ui

# 디버그 모드
npm run test:debug

# 팀장+팀원 동시 테스트만
npm run test:dual

# 데이터 정합성 테스트만
npm run test:integrity

# 권한 테스트만
npm run test:permissions
```

### 3.2 두 브라우저 동시 테스트

팀장/팀원 상호작용 테스트 (`.dual.spec.js` 파일):

```javascript
test('팀원 요청 → 팀장 알림', async ({ managerPage, memberPage }) => {
  // 팀원이 요청 제출
  await memberPage.click('button:text("매수 요청")');

  // 팀장 화면에서 실시간 알림 확인
  await expect(managerPage.locator('.notification-badge')).toBeVisible();
});
```

---

## 4. 테스트 구조

```
frontend/tests/
├── fixtures/
│   ├── auth.fixture.js         # 로그인 헬퍼
│   └── dual-browser.fixture.js # 팀장+팀원 동시 테스트
├── helpers/
│   ├── api.helper.js           # API 직접 호출
│   └── data-integrity.helper.js # 정합성 검증
├── e2e/
│   ├── auth-permissions.spec.js     # A020-A028
│   ├── data-integrity.spec.js       # S001-S043
│   └── realtime-interaction.dual.spec.js # 실시간
└── E2E_TEST_SCENARIOS.md            # 165개 시나리오
```

---

## 5. 디버깅 루프

```
1. 테스트 실행 (npm run test:ui)
     ↓
2. 실패 발견
     ↓
3. 오류 분석
   - 스크린샷 확인 (test-results/)
   - 콘솔 로그 확인
   - 네트워크 탭 확인
     ↓
4. 수정
   - 프론트엔드: frontend-design 플러그인 필수!
   - 백엔드: 직접 수정
     ↓
5. 재테스트
     ↓
6. 통과 → 다음 테스트
```

---

## 6. 테스트 계정

| 역할 | 이메일 | 비밀번호 |
|------|--------|----------|
| 팀장 | lhhh0420@naver.com | lhh0420! |
| 팀원 | test@naver.com | 12345678 |
| viewer | (생성 필요) | - |

---

## 7. 우선순위

### P0: 크리티컬 (먼저 테스트)
- S040-S043: 삭제 후 데이터 정합성
- S001-S003: 수익률 계산
- A020-A028: 역할별 접근 권한

### P1: 높음
- R020-R023: 요청 승인/거부
- D001-D005: 실시간 채팅
- N001-N004: 알림 발송

### P2-P3: 중간-낮음
- 나머지 시나리오들

---

## 8. 참고 문서

- `tests/E2E_TEST_SCENARIOS.md` - 165개 테스트 시나리오 상세
- `docs/plans/FUTURE_FEATURES.md` - 세션/기수 관리, 멀티테넌시 계획
