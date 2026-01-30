# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

펀드팀 메신저 - 펀드팀의 매매 의사결정을 체계적으로 관리하는 웹 애플리케이션. 카카오톡 단톡방 기반의 비체계적인 운영을 대체하여 매수/매도 요청, 승인, 포지션 관리, 팀 성과 추적 기능 제공.

**핵심 비즈니스 플로우**: 팀원 요청 제출 → 팀장 승인/거부/토론 개시 → 팀장 거래 체결 → 포지션 추적 → 성과 기록

## 기술 스택

- **백엔드**: FastAPI (Python 3.11+), SQLAlchemy 2.0, PostgreSQL, python-socketio
- **프론트엔드**: React 18, Vite, Tailwind CSS, Socket.io-client, Zustand
- **인증**: JWT (PyJWT)
- **배포**: Docker, CloudType
- **시세 API**:
  - 한국 주식: 한국투자증권 API
  - 미국 주식: Yahoo Finance (yfinance)
  - 암호화폐: Binance API

## 주요 명령어

### 백엔드
```bash
cd backend

# 의존성 설치
pip install -r requirements.txt

# 개발 서버 실행
uvicorn app.main:app --reload --port 8000

# 마이그레이션 적용
alembic upgrade head

# 새 마이그레이션 생성
alembic revision --autogenerate -m "설명"
```

### 프론트엔드
```bash
cd frontend

# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build
```

### Docker 배포
```bash
# .env 파일 생성 (루트 디렉토리)
cp .env.example .env

# 컨테이너 빌드 및 실행
docker-compose up -d --build

# 로그 확인
docker-compose logs -f

# 중지
docker-compose down
```

### 환경 설정
`backend/`와 `frontend/` 각각에서 `.env.example`을 `.env`로 복사 후 값 설정.
Docker 배포 시 루트의 `.env.example`을 `.env`로 복사.

## 아키텍처

### 백엔드 구조 (backend/app/)
```
app/
├── main.py              # FastAPI 앱, WebSocket 엔드포인트, 시작 이벤트
├── config.py            # 환경 변수 설정
├── database.py          # SQLAlchemy 엔진 및 세션
├── dependencies.py      # FastAPI 의존성 (인증, DB 세션)
├── models/              # SQLAlchemy ORM 모델
├── schemas/             # Pydantic 요청/응답 스키마
├── api/                 # REST API 라우터
├── services/            # 비즈니스 로직 계층
├── websocket/           # WebSocket 연결 관리 및 핸들러
└── utils/               # JWT, 비밀번호 해싱 유틸리티
```

### 주요 모델
- **User**: 팀원 (역할: manager, admin, member)
- **Request**: 매수/매도 요청 (상태: pending, approved, rejected, discussion)
- **Position**: 활성/종료된 포지션, 수익률 추적
- **Discussion**: 요청 검토를 위한 실시간 채팅 세션
- **Message**: 토론 내 채팅 메시지

### 프론트엔드 구조 (frontend/src/)
```
src/
├── pages/           # 페이지 컴포넌트 (Dashboard, Positions, Requests 등)
├── components/      # 재사용 UI (common/, layout/, forms/)
├── context/         # React Context (AuthContext, WebSocketContext)
├── services/        # API 클라이언트 함수
├── hooks/           # 커스텀 React 훅
└── utils/           # 포맷팅 유틸리티
```

### API 엔드포인트
- 개발: `http://localhost:8000/api/v1`
- WebSocket: `ws://localhost:8000/ws?token=<jwt>`

### 사용자 역할
- **manager**: 팀장 - 요청 승인/거부, 거래 체결 권한
- **admin**: 관리자 - 사용자 관리 권한
- **member**: 팀원 - 매수/매도 요청 제출

### 초기 관리자 계정
최초 실행 시 자동 생성: `manager@fund.com` / `manager123!`

## 개발 참고사항

- 단계별 개발 진행 (상세 로드맵은 proposal.md 참조)
- Phase 1 (MVP): 인증, 요청, 포지션, 대시보드 - 대부분 구현됨
- Phase 2: 실시간 토론 - 일부 구현됨
- Phase 3: 한국투자증권 API 연동 (예정)
- Phase 4: 고급 분석, 바이낸스 지원 (예정)
- Phase 5: Vision LLM 연동 (예정)
  - 거래내역 캡처 이미지 인식하여 자동 데이터 입력
  - 포지션 정보 덮어쓰기 기능
  - 시스템 사용 전 거래 내역 일괄 등록 기능

## 포지션 정보 확인 플로우

1. 팀원이 매수 요청 제출
2. 팀장이 요청 승인 → 포지션 자동 생성 (is_info_confirmed = false)
3. 팀장이 실제 체결 내역 확인 후 평균 매입가/수량 수정 → 정보 확인 완료
4. 포지션 종료 시 팀장이 실제 청산 금액 입력 필수 → 수익률 자동 계산

포지션이 미확인 상태면 노란 느낌표 아이콘으로 표시됨.

## 시세 API 설정

### 한국투자증권 API
1. [한국투자증권 OpenAPI](https://apiportal.koreainvestment.com/) 가입
2. 앱 키/시크릿 발급
3. `.env`에 설정:
```
KIS_APP_KEY=your_app_key
KIS_APP_SECRET=your_app_secret
```

### Yahoo Finance / Binance
- Yahoo Finance: 별도 설정 불필요 (yfinance 라이브러리)
- Binance: 공개 API 사용 (키 불필요)

### 시세 API 엔드포인트
- `GET /api/v1/prices/quote?ticker=005930&market=KOSPI` - 단일 종목 시세
- `GET /api/v1/prices/positions` - 열린 포지션 시세 일괄 조회
