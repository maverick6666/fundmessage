# E2E 테스트 자동화 루프 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 로컬 환경에서 모든 기능을 테스트하고, 실패하는 테스트를 즉시 수정하며, 모든 테스트가 통과할 때까지 반복하는 완전한 테스트 루프 실행

**Architecture:** Docker PostgreSQL + 로컬 백엔드(8000) + 로컬 프론트엔드(5173). Playwright MCP를 사용하여 두 브라우저(팀장/팀원)를 동시에 조작. 테스트 실패 시 스크린샷 분석 → 원인 파악 → 코드 수정 → 재테스트 루프.

**Tech Stack:** Playwright MCP, Docker, FastAPI, Vite, PostgreSQL

---

## Phase 1: 환경 검증

### Task 1: 로컬 서버 상태 확인

**Step 1: Docker DB 확인**

Run: `docker ps --filter "name=fundmessage"`
Expected: `fundmessage-db` 컨테이너가 `Up` 상태

**Step 2: 백엔드 헬스체크**

Run: `curl http://localhost:8000/health`
Expected: `{"status":"healthy"}`

**Step 3: 프론트엔드 확인**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173`
Expected: `200`

**Step 4: 테스트 계정 로그인 확인**

Playwright MCP로 `http://localhost:5173/login` 접속:
1. 팀장 계정 (lhhh0420@naver.com / lhh0420!) 로그인 테스트
2. 팀원 계정 (test@naver.com / 12345678) 로그인 테스트

Expected: 둘 다 로그인 성공, 대시보드로 이동

---

## Phase 2: 기능별 테스트 실행 및 수정 루프

### Task 2: 인증 & 로그인 테스트 (A001-A015)

**테스트 시나리오:**
- A010: 올바른 자격증명으로 로그인 → 대시보드 이동
- A011: 잘못된 비밀번호 → 오류 메시지 표시
- A014: 로그아웃 후 재로그인

**Step 1: 팀장 로그인 테스트**

Playwright MCP 실행:
1. `http://localhost:5173/login` 이동
2. 이메일: `lhhh0420@naver.com`, 비밀번호: `lhh0420!` 입력
3. 로그인 버튼 클릭
4. 스크린샷 캡처

Expected: URL이 `/login`이 아닌 다른 페이지로 변경

**Step 2: 실패 시 수정**

IF 실패:
- 스크린샷 분석
- 오류 메시지 확인
- 백엔드 로그 확인: `docker logs fundmessage-db`
- 프론트엔드 코드 수정 (frontend-design 스킬 사용)
- 백엔드 코드 수정 (직접 수정)
- Step 1 재실행

**Step 3: 팀원 로그인 테스트**

동일 절차로 `test@naver.com` / `12345678` 테스트

---

### Task 3: 대시보드 테스트 (D001-D010)

**테스트 시나리오:**
- 대시보드 로드
- 팀 정보 탭 표시
- 뉴스데스크 표시 (있는 경우)

**Step 1: 대시보드 로드 테스트**

Playwright MCP 실행 (팀장 로그인 상태):
1. `http://localhost:5173/` 이동
2. 페이지 로드 대기
3. 스크린샷 캡처

Expected:
- 대시보드 레이아웃 표시
- 사이드바 메뉴 표시
- 오류 없음

**Step 2: 팀 정보 탭 테스트**

1. "팀 정보" 탭 클릭
2. 팀원 목록 표시 확인
3. 스크린샷 캡처

Expected: 팀원 목록 또는 "팀원이 없습니다" 메시지

**Step 3: 실패 시 수정**

IF 실패:
- 콘솔 오류 확인
- 네트워크 요청 실패 확인
- API 엔드포인트 확인
- 수정 후 재테스트

---

### Task 4: 포지션 페이지 테스트 (P001-P044)

**테스트 시나리오:**
- 포지션 목록 로드
- 포지션 상세 페이지
- 포지션 차트 표시

**Step 1: 포지션 목록 테스트**

Playwright MCP 실행:
1. `http://localhost:5173/positions` 이동
2. 페이지 로드 대기
3. 스크린샷 캡처

Expected:
- 포지션 카드 표시 또는 "포지션이 없습니다"
- 오류 없음

**Step 2: 포지션 상세 테스트 (포지션이 있는 경우)**

1. 첫 번째 포지션 카드 클릭
2. 상세 페이지 로드 대기
3. 차트 표시 확인
4. 스크린샷 캡처

Expected:
- 차트 렌더링
- 매매 계획 표시
- 의사결정노트 영역 표시

**Step 3: 실패 시 수정**

IF 차트 안 보임:
- lightweight-charts 로드 확인
- 시세 API 응답 확인
- 수정 후 재테스트

---

### Task 5: 요청 페이지 테스트 (R001-R041)

**테스트 시나리오:**
- 요청 목록 로드
- 매수 요청 폼
- 요청 승인/거부 (팀장)

**Step 1: 요청 목록 테스트**

Playwright MCP 실행 (팀원 로그인):
1. `http://localhost:5173/requests` 이동
2. 페이지 로드 대기
3. 스크린샷 캡처

Expected:
- 요청 목록 표시 또는 빈 상태
- "매수 요청" 버튼 표시

**Step 2: 매수 요청 폼 테스트**

1. "매수 요청" 버튼 클릭
2. 폼 표시 확인
3. 스크린샷 캡처

Expected:
- 종목, 수량, 목표가, 사유 입력 필드
- 제출 버튼

**Step 3: 매수 요청 제출 테스트**

1. 종목: `삼성전자` 입력
2. 수량: `10` 입력
3. 목표가: `70000` 입력
4. 사유: `테스트 요청` 입력
5. 제출 버튼 클릭
6. 스크린샷 캡처

Expected:
- 성공 토스트 메시지
- 요청 목록에 새 요청 표시

**Step 4: 팀장으로 승인 테스트**

팀장 계정으로 전환:
1. 로그아웃 → 팀장 로그인
2. `/requests` 이동
3. 대기중 요청 클릭
4. "승인" 버튼 클릭
5. 스크린샷 캡처

Expected:
- 승인 완료 메시지
- 요청 상태 변경
- 포지션 생성

**Step 5: 실패 시 수정**

IF 실패:
- API 응답 확인
- 폼 유효성 검사 확인
- 권한 확인
- 수정 후 재테스트

---

### Task 6: 토론방 테스트 (D001-D031)

**테스트 시나리오:**
- 토론방 목록
- 실시간 채팅 (두 브라우저)
- 차트 공유

**Step 1: 토론방 목록 테스트**

Playwright MCP 실행:
1. `http://localhost:5173/discussions` 이동
2. 스크린샷 캡처

Expected:
- 토론방 목록 또는 빈 상태

**Step 2: 실시간 채팅 테스트 (두 브라우저)**

IF 열린 토론방 있음:
1. 브라우저 1 (팀장): 토론방 입장
2. 브라우저 2 (팀원): 같은 토론방 입장
3. 팀원이 메시지 전송: "테스트 메시지"
4. 팀장 화면에서 메시지 표시 확인
5. 양쪽 스크린샷 캡처

Expected:
- 실시간으로 메시지 동기화

**Step 3: 실패 시 수정**

IF WebSocket 연결 실패:
- 백엔드 WebSocket 설정 확인
- CORS 설정 확인
- 수정 후 재테스트

---

### Task 7: 통계 페이지 테스트 (S001-S043)

**테스트 시나리오:**
- 통계 로드
- 수익률/승률 표시
- 차트 렌더링

**Step 1: 통계 페이지 테스트**

Playwright MCP 실행:
1. `http://localhost:5173/stats` 이동
2. 페이지 로드 대기
3. 스크린샷 캡처

Expected:
- 통계 카드 표시
- 차트 렌더링

**Step 2: 데이터 정합성 확인**

API 직접 호출로 검증:
```bash
curl -H "Authorization: Bearer {token}" http://localhost:8000/api/v1/stats/overview
```

Expected:
- 수익률, 승률이 숫자
- NaN이나 Infinity 아님

**Step 3: 실패 시 수정**

IF 데이터 불일치:
- 백엔드 계산 로직 확인
- DB 쿼리 확인
- 수정 후 재테스트

---

### Task 8: 설정 페이지 테스트 (ST001-ST012)

**테스트 시나리오:**
- 설정 페이지 로드
- 테마 변경
- 관리자 모드 토글 (팀장만)

**Step 1: 설정 페이지 테스트**

Playwright MCP 실행 (팀장):
1. `http://localhost:5173/settings` 이동
2. 스크린샷 캡처

Expected:
- 테마 설정 표시
- 관리자 모드 토글 표시 (팀장만)

**Step 2: 관리자 모드 토글 테스트**

1. 관리자 모드 토글 클릭
2. 스크린샷 캡처
3. `/positions` 이동
4. 삭제 버튼 표시 확인

Expected:
- 관리자 모드 ON 시 삭제 버튼 표시

**Step 3: 팀원 설정 페이지 테스트**

팀원 계정으로:
1. `/settings` 이동
2. 관리자 모드 섹션이 안 보여야 함

---

### Task 9: 뉴스데스크 테스트 (ND001-ND021)

**테스트 시나리오:**
- 뉴스데스크 페이지 로드
- 키워드 히트맵 표시
- AI 칼럼 표시

**Step 1: 뉴스데스크 페이지 테스트**

Playwright MCP 실행:
1. `http://localhost:5173/newsdesk` 또는 메인 페이지에서 뉴스데스크 탭 이동
2. 스크린샷 캡처

Expected:
- 뉴스데스크 레이아웃 표시
- 또는 "뉴스가 없습니다" + 생성 버튼

**Step 2: 뉴스 생성 테스트 (팀장, 뉴스 없을 때)**

IF 뉴스 없음:
1. "뉴스 생성" 버튼 클릭
2. 로딩 표시 확인
3. 완료 후 스크린샷

Expected:
- 뉴스 카드 표시
- 키워드 히트맵 표시
- AI 칼럼 표시

---

### Task 10: 팀 관리 테스트 (TM001-TM011)

**테스트 시나리오:**
- 팀 관리 페이지 (팀장만)
- 팀원 목록
- 팀 설정

**Step 1: 팀 관리 페이지 테스트**

Playwright MCP 실행 (팀장):
1. `http://localhost:5173/team` 이동
2. 스크린샷 캡처

Expected:
- 팀원 목록 표시
- 팀 설정 옵션

**Step 2: 팀원 접근 차단 테스트**

팀원 계정으로:
1. `/team` 이동
2. 접근 차단 확인

Expected:
- 접근 거부 또는 리다이렉트

---

## Phase 3: 전체 테스트 및 최종 검증

### Task 11: 전체 E2E 테스트 실행

**Step 1: Playwright 테스트 전체 실행**

Run: `cd frontend && TEST_ENV=local npx playwright test --reporter=list`

**Step 2: 실패 테스트 분석**

실패한 테스트 목록 확인:
- 스크린샷: `frontend/test-results/`
- HTML 리포트: `npx playwright show-report`

**Step 3: 실패 테스트 수정 루프**

각 실패 테스트에 대해:
1. 오류 메시지 분석
2. 스크린샷 확인
3. 코드 수정 (프론트엔드: frontend-design 스킬)
4. 해당 테스트만 재실행
5. 통과 확인

**Step 4: 전체 재실행**

모든 개별 수정 완료 후:
Run: `cd frontend && TEST_ENV=local npx playwright test --reporter=list`

Expected: 모든 테스트 통과

---

### Task 12: 수동 검증 체크리스트

**Step 1: 핵심 플로우 수동 확인**

Playwright MCP로 전체 플로우 실행:
1. 팀원 로그인 → 매수 요청 제출
2. 팀장 로그인 → 요청 승인
3. 포지션 생성 확인
4. 토론 개시 → 채팅
5. 포지션 종료 → 통계 반영

**Step 2: 최종 스크린샷 저장**

각 주요 페이지 스크린샷:
- 대시보드
- 포지션 목록
- 포지션 상세
- 요청 목록
- 토론방
- 통계
- 설정

---

## 수정 가이드라인

### 프론트엔드 수정 시
```
1. frontend-design 스킬 호출 필수
2. 수정 후 Playwright MCP로 즉시 확인
3. 스크린샷 캡처로 검증
```

### 백엔드 수정 시
```
1. 직접 코드 수정
2. 서버 자동 재시작 대기 (--reload 모드)
3. API 직접 호출로 검증
4. Playwright로 UI 검증
```

### 공통 디버깅
```
1. 브라우저 콘솔 오류 확인
2. 네트워크 탭에서 실패 요청 확인
3. 백엔드 로그 확인
4. DB 상태 확인: docker exec fundmessage-db psql -U funduser -d fundmessenger -c "SELECT * FROM ..."
```

---

## 완료 조건

- [ ] 모든 Playwright 테스트 통과
- [ ] 팀장/팀원 로그인 정상
- [ ] 매수/매도 요청 플로우 정상
- [ ] 실시간 채팅 동기화 정상
- [ ] 통계 데이터 정합성 확인
- [ ] 관리자 모드 토글 정상
- [ ] 뉴스데스크 표시 정상

---

## 예상 소요 시간

| Phase | 설명 | 예상 시간 |
|-------|------|----------|
| 1 | 환경 검증 | 5분 |
| 2 | 기능별 테스트 (10개 Task) | 60-120분 (오류 수에 따라) |
| 3 | 전체 테스트 및 검증 | 30분 |

**총 예상: 2-3시간** (발견되는 버그 수에 따라 변동)
