# 테스트 정보

> 이 파일은 세션 시작 시 자동으로 로드됩니다.
> 테스트 계정, URL 등 자주 필요한 정보를 담고 있습니다.

---

## 테스트 계정

| 역할 | 이름 | 이메일 | 비밀번호 |
|------|------|--------|----------|
| 팀장 (Manager) | 이학현 | lhhh0420@naver.com | lhh0420! |
| 팀원 (Member) | 테스터 | test@naver.com | 12345678 |

---

## 배포 URL

| 환경 | URL |
|------|-----|
| Frontend (Vercel) | https://fundmessage.vercel.app |
| Backend API (CloudType) | https://port-0-fundmessage-backend-ml0uw7x1b9f1617c.sel3.cloudtype.app |

---

## 기술 스택

### Backend
- FastAPI (Python 3.11+)
- SQLAlchemy 2.0
- PostgreSQL
- python-socketio (WebSocket)
- JWT 인증 (PyJWT)

### Frontend
- React 18
- Vite
- Tailwind CSS
- Socket.io-client
- Zustand (상태 관리)

---

## 개발 서버

| 서비스 | 명령어 | 포트 |
|--------|--------|------|
| Backend | `cd backend && uvicorn app.main:app --reload` | 8000 |
| Frontend | `cd frontend && npm run dev` | 5173 |

---

## 중요 규칙

### UI 알림 규칙
- ❌ `window.alert()`, `window.confirm()`, `window.prompt()` 사용 금지
- ✅ `toast.success()`, `toast.error()`, `toast.warning()` 사용
- ✅ 확인 대화상자는 `ConfirmModal` 컴포넌트 사용

### 테스트 시나리오
- 상세 테스트 시나리오: `docs/TEST_SCENARIOS.md`
- 기능 개발/수정 후 반드시 테스트 시나리오 업데이트!
