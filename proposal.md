# 펀드팀 메신저 (Fund Team Messenger) - 상세 기획서

**작성일**: 2026-01-26
**개발 도구**: Claude Code Opus
**목표**: 체계적인 펀드팀 매매 의사결정 관리 시스템

---

# 1. 프로젝트 개요

## 1.1 배경 및 목적

### 현재 문제점
- 펀드팀 운영이 카카오톡 단톡방에서 비체계적으로 이루어짐
- 매수/매도 요청 형식이 정해지지 않아 혼란 발생
- 누가 언제 어떤 종목을 요구했는지 추적 불가능
- 의사결정 과정이 문서화되지 않아 복기 및 학습 어려움
- 팀원별 성과 측정 및 평가 기준 부재

### 프로젝트 목적
1. **체계화**: 매매 요청부터 승인, 실행, 정리까지 전 과정 구조화
2. **투명성**: 모든 의사결정 과정 기록 및 추적 가능
3. **데이터 수집**: 팀원별 매매 패턴 및 성과 데이터 체계적 축적
4. **학습 기반**: 수집된 데이터로 향후 AI 모델 학습용 dataset 구축
5. **성과 관리**: 객관적 데이터 기반 팀원 평가 및 공과 논의

### 핵심 가치 제안
- **펀드 팀장**: 체계적인 의사결정 프로세스, 리스크 관리 용이
- **팀원**: 투명한 성과 평가, 학습 기회 제공
- **데이터 수집자**: 고품질 트레이딩 의사결정 dataset 확보

## 1.2 운영 방식

현재 펀드팀 운영 구조:
- **팀장**: 공금 보유 및 실제 거래 집행
- **팀원**: 매수/매도 의견 제시
- **프로세스**: 팀원 요청 → 팀장 승인 → 팀장 거래 체결 → 성과 기록

---

# 2. 기술 스택

## 2.1 확정된 기술 스택

```yaml
Frontend:
  Framework: React 18
  Build Tool: Vite
  Styling: Tailwind CSS
  State Management: React Context API (or Zustand)
  Real-time: Socket.io-client
  
Backend:
  Language: Python 3.11+
  Framework: FastAPI
  ORM: SQLAlchemy 2.0
  Real-time: python-socketio
  Auth: JWT (PyJWT)
  Validation: Pydantic
  
Database:
  RDBMS: PostgreSQL 15+
  Migration: Alembic
  
External APIs:
  Primary: 한국투자증권 OpenAPI (국장)
  Future: Binance API (해외 선물)
  
Deployment:
  Platform: 클라우드타입 (CloudType)
  CI/CD: GitHub Actions
  
Development:
  IDE: PyCharm
  Version Control: Git
```

## 2.2 프로젝트 구조

```
fund-team-messenger/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI 엔트리포인트
│   │   ├── config.py               # 설정 (DB, API Keys 등)
│   │   ├── database.py             # DB 연결 설정
│   │   ├── dependencies.py         # 의존성 주입
│   │   │
│   │   ├── models/                 # SQLAlchemy 모델
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── position.py
│   │   │   ├── request.py
│   │   │   ├── discussion.py
│   │   │   └── message.py
│   │   │
│   │   ├── schemas/                # Pydantic 스키마
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── position.py
│   │   │   ├── request.py
│   │   │   ├── discussion.py
│   │   │   └── auth.py
│   │   │
│   │   ├── api/                    # API 라우터
│   │   │   ├── __init__.py
│   │   │   ├── auth.py
│   │   │   ├── users.py
│   │   │   ├── positions.py
│   │   │   ├── requests.py
│   │   │   ├── discussions.py
│   │   │   └── stats.py
│   │   │
│   │   ├── services/               # 비즈니스 로직
│   │   │   ├── __init__.py
│   │   │   ├── auth_service.py
│   │   │   ├── position_service.py
│   │   │   ├── request_service.py
│   │   │   ├── discussion_service.py
│   │   │   ├── kis_api_service.py  # 한투 API
│   │   │   └── stats_service.py
│   │   │
│   │   ├── websocket/              # WebSocket 핸들러
│   │   │   ├── __init__.py
│   │   │   ├── connection_manager.py
│   │   │   ├── discussion_handler.py
│   │   │   └── price_monitor.py
│   │   │
│   │   └── utils/                  # 유틸리티
│   │       ├── __init__.py
│   │       ├── security.py
│   │       ├── validators.py
│   │       └── calculators.py
│   │
│   ├── alembic/                    # DB 마이그레이션
│   │   └── versions/
│   ├── tests/                      # 테스트
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── main.jsx                # React 엔트리포인트
│   │   ├── App.jsx
│   │   │
│   │   ├── components/             # 재사용 컴포넌트
│   │   │   ├── common/
│   │   │   │   ├── Button.jsx
│   │   │   │   ├── Input.jsx
│   │   │   │   ├── Modal.jsx
│   │   │   │   └── Card.jsx
│   │   │   ├── layout/
│   │   │   │   ├── Header.jsx
│   │   │   │   ├── Sidebar.jsx
│   │   │   │   └── Layout.jsx
│   │   │   └── forms/
│   │   │       ├── BuyRequestForm.jsx
│   │   │       └── SellRequestForm.jsx
│   │   │
│   │   ├── pages/                  # 페이지 컴포넌트
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Positions.jsx
│   │   │   ├── PositionDetail.jsx
│   │   │   ├── Requests.jsx
│   │   │   ├── Discussion.jsx
│   │   │   └── Stats.jsx
│   │   │
│   │   ├── hooks/                  # Custom Hooks
│   │   │   ├── useAuth.js
│   │   │   ├── useWebSocket.js
│   │   │   └── usePositions.js
│   │   │
│   │   ├── services/               # API 호출
│   │   │   ├── api.js
│   │   │   ├── authService.js
│   │   │   ├── positionService.js
│   │   │   └── discussionService.js
│   │   │
│   │   ├── context/                # React Context
│   │   │   ├── AuthContext.jsx
│   │   │   └── WebSocketContext.jsx
│   │   │
│   │   └── utils/                  # 유틸리티
│   │       ├── formatters.js
│   │       └── validators.js
│   │
│   ├── public/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── .env.example
│
└── README.md
```

---

# 3. 데이터베이스 설계

## 3.1 ERD (Entity Relationship Diagram)

```
[Users] 1───N [Requests] N───1 [Positions]
   │                              │
   │                              │
   └─────N [Messages] N───────────┘
                │
                │
                N
          [Discussions]
```

## 3.2 테이블 상세 설계

### 3.2.1 users (사용자)

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'member',  -- 'manager', 'admin', 'member'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

COMMENT ON COLUMN users.role IS '권한: manager(팀장), admin(관리자), member(팀원)';
```

**비즈니스 규칙**:
- 팀장(manager)은 기본적으로 admin 권한 보유
- 팀장이 다른 사용자에게 admin 권한 부여 가능
- email은 로그인 ID로 사용

### 3.2.2 positions (포지션)

```sql
CREATE TABLE positions (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(20) NOT NULL,
    ticker_name VARCHAR(100),
    market VARCHAR(20) NOT NULL,  -- 'KRX', 'BINANCE'
    
    -- 포지션 상태
    status VARCHAR(20) NOT NULL DEFAULT 'open',  -- 'open', 'closed'
    
    -- 매수 정보
    average_buy_price DECIMAL(20, 4),
    total_quantity DECIMAL(20, 8) DEFAULT 0,
    total_buy_amount DECIMAL(20, 2) DEFAULT 0,
    
    -- 목표가 (JSONB로 복수 설정 가능)
    take_profit_targets JSONB,  -- [{"price": 55000, "ratio": 0.5}, ...]
    stop_loss_targets JSONB,    -- [{"price": 45000, "ratio": 1.0}]
    
    -- 매도 정보
    average_sell_price DECIMAL(20, 4),
    total_sell_amount DECIMAL(20, 2),
    
    -- 성과
    profit_loss DECIMAL(20, 2),
    profit_rate DECIMAL(10, 4),
    holding_period_hours INTEGER,
    
    -- 감사 정보
    opened_at TIMESTAMP,
    closed_at TIMESTAMP,
    opened_by INTEGER REFERENCES users(id),
    closed_by INTEGER REFERENCES users(id),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_positions_ticker ON positions(ticker);
CREATE INDEX idx_positions_status ON positions(status);
CREATE INDEX idx_positions_opened_by ON positions(opened_by);

COMMENT ON COLUMN positions.take_profit_targets IS '익절가 목표: [{"price": 가격, "ratio": 비중}]';
COMMENT ON COLUMN positions.stop_loss_targets IS '손절가 목표: [{"price": 가격, "ratio": 비중}]';
```

**비즈니스 규칙**:
- 하나의 종목(ticker)에는 하나의 활성(open) 포지션만 존재
- 여러 팀원의 매수 요청이 승인되면 동일 포지션에 합산
- JSONB 타입으로 분할 익절/손절 유연하게 관리

### 3.2.3 requests (매수/매도 요청)

```sql
CREATE TABLE requests (
    id SERIAL PRIMARY KEY,
    position_id INTEGER REFERENCES positions(id) ON DELETE CASCADE,
    requester_id INTEGER NOT NULL REFERENCES users(id),
    
    -- 요청 유형
    request_type VARCHAR(20) NOT NULL,  -- 'buy', 'sell'
    
    -- 매수 요청 정보
    target_ticker VARCHAR(20),
    target_market VARCHAR(20),
    buy_orders JSONB,  -- [{"price": 50000, "ratio": 0.3}, {"price": 48000, "ratio": 0.7}]
    target_ratio DECIMAL(5, 4),  -- 포트폴리오 비중 (0.05 = 5%)
    take_profit_targets JSONB,
    stop_loss_targets JSONB,
    
    -- 매도 요청 정보
    sell_quantity DECIMAL(20, 8),
    sell_price DECIMAL(20, 4),
    sell_reason TEXT,
    
    -- 승인 정보
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- 'pending', 'approved', 'rejected', 'discussion'
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMP,
    rejection_reason TEXT,
    
    -- 실제 체결 정보 (팀장이 입력)
    executed_price DECIMAL(20, 4),
    executed_quantity DECIMAL(20, 8),
    executed_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_requests_position_id ON requests(position_id);
CREATE INDEX idx_requests_requester_id ON requests(requester_id);
CREATE INDEX idx_requests_status ON requests(status);

COMMENT ON COLUMN requests.buy_orders IS '분할매수 계획: [{"price": 가격, "ratio": 비중}]';
COMMENT ON COLUMN requests.target_ratio IS '목표 포트폴리오 비중 (0~1)';
```

**비즈니스 규칙**:
- request_type='buy'이고 status='approved'면 position 생성 또는 합산
- request_type='sell'이고 status='approved'면 position 수량 감소 또는 종료
- executed_price는 팀장이 실제 체결 후 입력

### 3.2.4 discussions (토론 세션)

```sql
CREATE TABLE discussions (
    id SERIAL PRIMARY KEY,
    request_id INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    
    title VARCHAR(200) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open',  -- 'open', 'closed'
    
    -- 세션 요약 (LLM 생성 또는 수동 입력)
    summary TEXT,
    summary_by_participant JSONB,  -- {"user_id": "요약 내용", ...}
    
    opened_by INTEGER NOT NULL REFERENCES users(id),
    closed_by INTEGER REFERENCES users(id),
    
    opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_discussions_request_id ON discussions(request_id);
CREATE INDEX idx_discussions_status ON discussions(status);

COMMENT ON COLUMN discussions.summary_by_participant IS '참여자별 대화 요약: {user_id: "요약"}';
```

**비즈니스 규칙**:
- 팀장이 request를 'discussion' 상태로 변경 시 자동 생성
- 팀장 또는 관리자만 세션 종료 가능
- 종료 시 채팅 로그를 기반으로 요약 생성 (초기엔 JSON export만)

### 3.2.5 messages (채팅 메시지)

```sql
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    discussion_id INTEGER NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text',  -- 'text', 'system'
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_messages_discussion_id ON messages(discussion_id);
CREATE INDEX idx_messages_user_id ON messages(user_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
```

**비즈니스 규칙**:
- discussion이 'closed' 상태여도 메시지는 조회 가능 (읽기 전용)
- message_type='system'은 자동 생성 메시지 ("토론 시작", "토론 종료" 등)

### 3.2.6 price_alerts (가격 알림 로그)

```sql
CREATE TABLE price_alerts (
    id SERIAL PRIMARY KEY,
    position_id INTEGER NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
    
    alert_type VARCHAR(20) NOT NULL,  -- 'take_profit', 'stop_loss'
    target_price DECIMAL(20, 4) NOT NULL,
    current_price DECIMAL(20, 4) NOT NULL,
    
    notified_users JSONB,  -- [user_id, ...]
    is_read BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_price_alerts_position_id ON price_alerts(position_id);
CREATE INDEX idx_price_alerts_is_read ON price_alerts(is_read);
```

**비즈니스 규칙**:
- 실시간 가격이 익절가/손절가 도달 시 자동 생성
- 팀장과 포지션 발의자에게 알림

---

## 3.3 샘플 데이터 예시

### positions 테이블 예시

```json
{
  "id": 1,
  "ticker": "005930",
  "ticker_name": "삼성전자",
  "market": "KRX",
  "status": "open",
  "average_buy_price": 71500.00,
  "total_quantity": 150,
  "total_buy_amount": 10725000.00,
  "take_profit_targets": [
    {"price": 75000, "ratio": 0.5},
    {"price": 78000, "ratio": 0.5}
  ],
  "stop_loss_targets": [
    {"price": 68000, "ratio": 1.0}
  ],
  "opened_at": "2026-01-20T09:30:00Z",
  "opened_by": 2
}
```

### requests 테이블 예시 (매수)

```json
{
  "id": 1,
  "position_id": null,
  "requester_id": 2,
  "request_type": "buy",
  "target_ticker": "005930",
  "target_market": "KRX",
  "buy_orders": [
    {"price": 72000, "ratio": 0.3},
    {"price": 71000, "ratio": 0.4},
    {"price": 70000, "ratio": 0.3}
  ],
  "target_ratio": 0.05,
  "take_profit_targets": [
    {"price": 75000, "ratio": 0.5},
    {"price": 78000, "ratio": 0.5}
  ],
  "stop_loss_targets": [
    {"price": 68000, "ratio": 1.0}
  ],
  "status": "approved",
  "approved_by": 1,
  "approved_at": "2026-01-20T09:15:00Z",
  "executed_price": 71500.00,
  "executed_quantity": 100,
  "executed_at": "2026-01-20T09:30:00Z"
}
```

---

# 4. API 설계

## 4.1 API 규칙

### Base URL
```
Production: https://fund-messenger.cloudtype.app/api/v1
Development: http://localhost:8000/api/v1
```

### 인증
- **방식**: JWT (Bearer Token)
- **헤더**: `Authorization: Bearer <token>`
- **토큰 만료**: Access Token 1시간, Refresh Token 7일

### 응답 형식

**성공 응답**:
```json
{
  "success": true,
  "data": { ... },
  "message": "Success"
}
```

**에러 응답**:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": { ... }
  }
}
```

### 에러 코드
- `400` - Bad Request (유효성 검증 실패)
- `401` - Unauthorized (인증 실패)
- `403` - Forbidden (권한 없음)
- `404` - Not Found (리소스 없음)
- `409` - Conflict (중복, 상태 충돌)
- `500` - Internal Server Error

## 4.2 엔드포인트 상세

### 4.2.1 인증 (Auth)

#### POST /auth/register
**설명**: 신규 사용자 등록 (관리자만 가능)

**Request**:
```json
{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "SecurePass123!",
  "full_name": "John Doe",
  "role": "member"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 3,
      "email": "user@example.com",
      "username": "johndoe",
      "full_name": "John Doe",
      "role": "member",
      "created_at": "2026-01-26T10:00:00Z"
    }
  },
  "message": "User registered successfully"
}
```

#### POST /auth/login
**설명**: 로그인

**Request**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "access_token": "eyJ0eXAiOiJKV1QiLC...",
    "refresh_token": "eyJ0eXAiOiJKV1QiLC...",
    "token_type": "bearer",
    "expires_in": 3600,
    "user": {
      "id": 3,
      "email": "user@example.com",
      "username": "johndoe",
      "full_name": "John Doe",
      "role": "member"
    }
  }
}
```

#### POST /auth/refresh
**설명**: Access Token 갱신

**Request**:
```json
{
  "refresh_token": "eyJ0eXAiOiJKV1QiLC..."
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "access_token": "eyJ0eXAiOiJKV1QiLC...",
    "token_type": "bearer",
    "expires_in": 3600
  }
}
```

### 4.2.2 사용자 (Users)

#### GET /users/me
**설명**: 현재 로그인한 사용자 정보 조회

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": 3,
    "email": "user@example.com",
    "username": "johndoe",
    "full_name": "John Doe",
    "role": "member",
    "is_active": true,
    "created_at": "2026-01-26T10:00:00Z"
  }
}
```

#### GET /users
**설명**: 전체 사용자 목록 조회 (관리자만)

**Query Parameters**:
- `role` (optional): 역할 필터 (manager, admin, member)
- `is_active` (optional): 활성 상태 필터

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": 1,
        "username": "manager",
        "full_name": "펀드 매니저",
        "role": "manager",
        "is_active": true
      },
      {
        "id": 2,
        "username": "trader1",
        "full_name": "트레이더 A",
        "role": "member",
        "is_active": true
      }
    ],
    "total": 2
  }
}
```

#### PATCH /users/{user_id}/role
**설명**: 사용자 권한 변경 (팀장만)

**Request**:
```json
{
  "role": "admin"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": 3,
    "username": "johndoe",
    "role": "admin"
  },
  "message": "User role updated successfully"
}
```

### 4.2.3 매수/매도 요청 (Requests)

#### POST /requests/buy
**설명**: 매수 요청 생성

**Request**:
```json
{
  "target_ticker": "005930",
  "target_market": "KRX",
  "buy_orders": [
    {"price": 72000, "ratio": 0.3},
    {"price": 71000, "ratio": 0.7}
  ],
  "target_ratio": 0.05,
  "take_profit_targets": [
    {"price": 75000, "ratio": 0.5},
    {"price": 78000, "ratio": 0.5}
  ],
  "stop_loss_targets": [
    {"price": 68000, "ratio": 1.0}
  ]
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "request": {
      "id": 5,
      "request_type": "buy",
      "target_ticker": "005930",
      "status": "pending",
      "requester": {
        "id": 3,
        "username": "johndoe",
        "full_name": "John Doe"
      },
      "created_at": "2026-01-26T14:30:00Z"
    }
  },
  "message": "Buy request created successfully"
}
```

**비즈니스 규칙**:
- `buy_orders`가 비어있으면 시장가 매수 의도 (팀장이 체결 후 가격 입력)
- `buy_orders`의 ratio 합계는 1.0이어야 함
- `take_profit_targets`, `stop_loss_targets`의 ratio 합계도 각각 1.0

#### POST /requests/sell
**설명**: 매도(정리) 요청 생성

**Request**:
```json
{
  "position_id": 1,
  "sell_quantity": 50,
  "sell_price": null,  // null이면 시장가
  "sell_reason": "익절가 도달"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "request": {
      "id": 6,
      "request_type": "sell",
      "position_id": 1,
      "sell_quantity": 50,
      "status": "pending",
      "requester": {
        "id": 3,
        "username": "johndoe"
      },
      "created_at": "2026-01-26T15:00:00Z"
    }
  },
  "message": "Sell request created successfully"
}
```

#### GET /requests
**설명**: 요청 목록 조회

**Query Parameters**:
- `status` (optional): pending, approved, rejected, discussion
- `request_type` (optional): buy, sell
- `requester_id` (optional): 요청자 ID
- `page` (default: 1)
- `limit` (default: 20)

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "requests": [
      {
        "id": 5,
        "request_type": "buy",
        "target_ticker": "005930",
        "status": "pending",
        "requester": {
          "id": 3,
          "username": "johndoe",
          "full_name": "John Doe"
        },
        "created_at": "2026-01-26T14:30:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 20
  }
}
```

#### GET /requests/{request_id}
**설명**: 요청 상세 조회

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": 5,
    "request_type": "buy",
    "target_ticker": "005930",
    "target_market": "KRX",
    "buy_orders": [
      {"price": 72000, "ratio": 0.3},
      {"price": 71000, "ratio": 0.7}
    ],
    "target_ratio": 0.05,
    "take_profit_targets": [
      {"price": 75000, "ratio": 0.5},
      {"price": 78000, "ratio": 0.5}
    ],
    "stop_loss_targets": [
      {"price": 68000, "ratio": 1.0}
    ],
    "status": "pending",
    "requester": {
      "id": 3,
      "username": "johndoe",
      "full_name": "John Doe"
    },
    "created_at": "2026-01-26T14:30:00Z"
  }
}
```

#### POST /requests/{request_id}/approve
**설명**: 요청 승인 (팀장/관리자만)

**Request** (매수 승인 시 체결 정보 입력):
```json
{
  "executed_price": 71500.00,
  "executed_quantity": 100,
  "executed_at": "2026-01-26T15:30:00Z"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "request": {
      "id": 5,
      "status": "approved",
      "approved_by": 1,
      "approved_at": "2026-01-26T15:30:00Z",
      "executed_price": 71500.00,
      "executed_quantity": 100
    },
    "position": {
      "id": 1,
      "ticker": "005930",
      "status": "open",
      "average_buy_price": 71500.00,
      "total_quantity": 100
    }
  },
  "message": "Request approved and position opened"
}
```

**비즈니스 로직**:
- 매수 승인: position 생성 또는 기존 position에 합산
- 매도 승인: position 수량 감소, 수량 0되면 자동 종료 및 성과 계산

#### POST /requests/{request_id}/reject
**설명**: 요청 거부 (팀장/관리자만)

**Request**:
```json
{
  "rejection_reason": "현재 시장 상황이 적절하지 않음"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "request": {
      "id": 5,
      "status": "rejected",
      "rejection_reason": "현재 시장 상황이 적절하지 않음",
      "approved_by": 1,
      "approved_at": "2026-01-26T15:30:00Z"
    }
  },
  "message": "Request rejected"
}
```

#### POST /requests/{request_id}/discuss
**설명**: 토론 세션 개시 (팀장/관리자만)

**Request**:
```json
{
  "title": "삼성전자 매수 타이밍 논의"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "request": {
      "id": 5,
      "status": "discussion"
    },
    "discussion": {
      "id": 1,
      "request_id": 5,
      "title": "삼성전자 매수 타이밍 논의",
      "status": "open",
      "opened_by": 1,
      "opened_at": "2026-01-26T15:45:00Z"
    }
  },
  "message": "Discussion session started"
}
```

### 4.2.4 포지션 (Positions)

#### GET /positions
**설명**: 포지션 목록 조회

**Query Parameters**:
- `status` (optional): open, closed
- `ticker` (optional): 종목 코드
- `opened_by` (optional): 개설자 ID
- `page` (default: 1)
- `limit` (default: 20)

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "positions": [
      {
        "id": 1,
        "ticker": "005930",
        "ticker_name": "삼성전자",
        "status": "open",
        "average_buy_price": 71500.00,
        "total_quantity": 150,
        "current_price": 73000.00,  // 실시간 가격 (API 연동)
        "unrealized_pnl": 225000.00,
        "unrealized_pnl_rate": 0.0210,
        "opened_by": {
          "id": 2,
          "username": "trader1"
        },
        "opened_at": "2026-01-20T09:30:00Z"
      }
    ],
    "total": 1
  }
}
```

#### GET /positions/{position_id}
**설명**: 포지션 상세 조회

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "ticker": "005930",
    "ticker_name": "삼성전자",
    "market": "KRX",
    "status": "open",
    "average_buy_price": 71500.00,
    "total_quantity": 150,
    "total_buy_amount": 10725000.00,
    "take_profit_targets": [
      {"price": 75000, "ratio": 0.5},
      {"price": 78000, "ratio": 0.5}
    ],
    "stop_loss_targets": [
      {"price": 68000, "ratio": 1.0}
    ],
    "current_price": 73000.00,
    "unrealized_pnl": 225000.00,
    "unrealized_pnl_rate": 0.0210,
    "contributors": [
      {
        "user": {"id": 2, "username": "trader1"},
        "quantity": 100,
        "contribution_ratio": 0.67
      },
      {
        "user": {"id": 3, "username": "trader2"},
        "quantity": 50,
        "contribution_ratio": 0.33
      }
    ],
    "related_requests": [
      {"id": 1, "request_type": "buy", "requester": "trader1", "quantity": 100},
      {"id": 3, "request_type": "buy", "requester": "trader2", "quantity": 50}
    ],
    "opened_by": {"id": 2, "username": "trader1"},
    "opened_at": "2026-01-20T09:30:00Z"
  }
}
```

#### PATCH /positions/{position_id}
**설명**: 포지션 수정 (평단가, 수량, 목표가 등)

**Request**:
```json
{
  "average_buy_price": 71600.00,
  "take_profit_targets": [
    {"price": 76000, "ratio": 0.5},
    {"price": 79000, "ratio": 0.5}
  ]
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "average_buy_price": 71600.00,
    "take_profit_targets": [
      {"price": 76000, "ratio": 0.5},
      {"price": 79000, "ratio": 0.5}
    ]
  },
  "message": "Position updated successfully"
}
```

#### POST /positions/{position_id}/close
**설명**: 포지션 수동 종료 및 성과 입력 (팀장/관리자만)

**Request**:
```json
{
  "average_sell_price": 74500.00,
  "total_sell_amount": 11175000.00,
  "closed_at": "2026-01-26T16:00:00Z",
  "profit_loss": 450000.00,  // 수정 가능 (수수료, 환차익 반영)
  "profit_rate": 0.0420
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "status": "closed",
    "average_sell_price": 74500.00,
    "profit_loss": 450000.00,
    "profit_rate": 0.0420,
    "holding_period_hours": 150,
    "closed_at": "2026-01-26T16:00:00Z",
    "closed_by": 1
  },
  "message": "Position closed successfully"
}
```

### 4.2.5 토론 (Discussions)

#### GET /discussions/{discussion_id}
**설명**: 토론 세션 상세 조회

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "request_id": 5,
    "title": "삼성전자 매수 타이밍 논의",
    "status": "open",
    "request": {
      "id": 5,
      "request_type": "buy",
      "target_ticker": "005930"
    },
    "participants": [
      {"id": 1, "username": "manager"},
      {"id": 2, "username": "trader1"},
      {"id": 3, "username": "trader2"}
    ],
    "message_count": 15,
    "opened_by": {"id": 1, "username": "manager"},
    "opened_at": "2026-01-26T15:45:00Z"
  }
}
```

#### GET /discussions/{discussion_id}/messages
**설명**: 토론 메시지 조회

**Query Parameters**:
- `page` (default: 1)
- `limit` (default: 50)

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": 1,
        "user": {"id": 1, "username": "manager", "full_name": "펀드 매니저"},
        "content": "현재 삼성전자 기술적 지표 어떻게 보시나요?",
        "message_type": "text",
        "created_at": "2026-01-26T15:46:00Z"
      },
      {
        "id": 2,
        "user": {"id": 2, "username": "trader1", "full_name": "트레이더 A"},
        "content": "RSI가 50선 돌파했고, MACD도 골든크로스 나왔습니다.",
        "message_type": "text",
        "created_at": "2026-01-26T15:47:30Z"
      }
    ],
    "total": 15,
    "page": 1
  }
}
```

#### POST /discussions/{discussion_id}/messages
**설명**: 메시지 전송 (WebSocket으로도 가능)

**Request**:
```json
{
  "content": "동의합니다. 지금이 적기인 것 같습니다."
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": 16,
    "discussion_id": 1,
    "user": {"id": 3, "username": "trader2"},
    "content": "동의합니다. 지금이 적기인 것 같습니다.",
    "created_at": "2026-01-26T15:50:00Z"
  }
}
```

#### POST /discussions/{discussion_id}/close
**설명**: 토론 세션 종료 (팀장/관리자만)

**Request** (선택 사항):
```json
{
  "summary": "대다수 의견이 매수 찬성. 기술적 지표 호전 확인."
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "status": "closed",
    "summary": "대다수 의견이 매수 찬성. 기술적 지표 호전 확인.",
    "closed_by": 1,
    "closed_at": "2026-01-26T16:00:00Z",
    "export_url": "/api/v1/discussions/1/export"  // JSON 다운로드 링크
  },
  "message": "Discussion closed successfully"
}
```

#### GET /discussions/{discussion_id}/export
**설명**: 토론 데이터 JSON 다운로드

**Response** (200 OK):
```json
{
  "discussion": {
    "id": 1,
    "title": "삼성전자 매수 타이밍 논의",
    "opened_at": "2026-01-26T15:45:00Z",
    "closed_at": "2026-01-26T16:00:00Z"
  },
  "participants": [
    {"id": 1, "username": "manager"},
    {"id": 2, "username": "trader1"},
    {"id": 3, "username": "trader2"}
  ],
  "messages": [
    {
      "timestamp": "2026-01-26T15:46:00Z",
      "user": "manager",
      "content": "현재 삼성전자 기술적 지표 어떻게 보시나요?"
    },
    {
      "timestamp": "2026-01-26T15:47:30Z",
      "user": "trader1",
      "content": "RSI가 50선 돌파했고, MACD도 골든크로스 나왔습니다."
    }
  ]
}
```

### 4.2.6 통계 (Stats)

#### GET /stats/users/{user_id}
**설명**: 특정 팀원 성과 조회

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 2,
      "username": "trader1",
      "full_name": "트레이더 A"
    },
    "overall": {
      "total_trades": 25,
      "winning_trades": 18,
      "losing_trades": 7,
      "win_rate": 0.72,
      "total_profit_loss": 1250000.00,
      "avg_profit_rate": 0.0385,
      "avg_holding_hours": 120,
      "profit_factor": 2.3,  // 총 수익 / 총 손실
      "sharpe_ratio": 1.45
    },
    "monthly": [
      {
        "month": "2026-01",
        "trades": 8,
        "profit_loss": 420000.00,
        "win_rate": 0.75
      }
    ],
    "best_trade": {
      "ticker": "005930",
      "profit_rate": 0.125,
      "closed_at": "2026-01-15T14:00:00Z"
    },
    "worst_trade": {
      "ticker": "035720",
      "profit_rate": -0.053,
      "closed_at": "2026-01-22T11:30:00Z"
    }
  }
}
```

#### GET /stats/team
**설명**: 팀 전체 통계

**Query Parameters**:
- `start_date` (optional): YYYY-MM-DD
- `end_date` (optional): YYYY-MM-DD

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "period": {
      "start": "2026-01-01",
      "end": "2026-01-26"
    },
    "overall": {
      "total_trades": 75,
      "total_profit_loss": 3250000.00,
      "avg_win_rate": 0.68,
      "total_volume": 125000000.00
    },
    "leaderboard": [
      {
        "rank": 1,
        "user": {"id": 2, "username": "trader1"},
        "total_profit_loss": 1250000.00,
        "win_rate": 0.72,
        "trades": 25
      },
      {
        "rank": 2,
        "user": {"id": 3, "username": "trader2"},
        "total_profit_loss": 980000.00,
        "win_rate": 0.65,
        "trades": 20
      }
    ],
    "by_ticker": [
      {
        "ticker": "005930",
        "ticker_name": "삼성전자",
        "trades": 12,
        "profit_loss": 680000.00,
        "avg_holding_hours": 96
      }
    ]
  }
}
```

---

# 5. 실시간 통신 (WebSocket)

## 5.1 WebSocket 연결

### 연결 URL
```
ws://localhost:8000/ws
```

### 인증
- Query Parameter로 JWT 토큰 전달
```
ws://localhost:8000/ws?token=<access_token>
```

## 5.2 이벤트 타입

### 클라이언트 → 서버

#### join_discussion
**설명**: 토론방 입장

```json
{
  "type": "join_discussion",
  "data": {
    "discussion_id": 1
  }
}
```

#### leave_discussion
**설명**: 토론방 퇴장

```json
{
  "type": "leave_discussion",
  "data": {
    "discussion_id": 1
  }
}
```

#### send_message
**설명**: 메시지 전송

```json
{
  "type": "send_message",
  "data": {
    "discussion_id": 1,
    "content": "동의합니다."
  }
}
```

#### subscribe_price
**설명**: 특정 종목 실시간 가격 구독

```json
{
  "type": "subscribe_price",
  "data": {
    "ticker": "005930",
    "market": "KRX"
  }
}
```

#### unsubscribe_price
**설명**: 가격 구독 해제

```json
{
  "type": "unsubscribe_price",
  "data": {
    "ticker": "005930"
  }
}
```

### 서버 → 클라이언트

#### message_received
**설명**: 새 메시지 수신

```json
{
  "type": "message_received",
  "data": {
    "id": 16,
    "discussion_id": 1,
    "user": {
      "id": 3,
      "username": "trader2",
      "full_name": "트레이더 B"
    },
    "content": "동의합니다.",
    "created_at": "2026-01-26T15:50:00Z"
  }
}
```

#### user_joined
**설명**: 사용자 토론방 입장

```json
{
  "type": "user_joined",
  "data": {
    "discussion_id": 1,
    "user": {
      "id": 4,
      "username": "trader3"
    }
  }
}
```

#### user_left
**설명**: 사용자 토론방 퇴장

```json
{
  "type": "user_left",
  "data": {
    "discussion_id": 1,
    "user": {
      "id": 4,
      "username": "trader3"
    }
  }
}
```

#### price_update
**설명**: 실시간 가격 업데이트

```json
{
  "type": "price_update",
  "data": {
    "ticker": "005930",
    "price": 73500.00,
    "change": 500.00,
    "change_rate": 0.0068,
    "volume": 12500000,
    "timestamp": "2026-01-26T16:05:23Z"
  }
}
```

#### price_alert
**설명**: 익절가/손절가 도달 알림

```json
{
  "type": "price_alert",
  "data": {
    "alert_id": 5,
    "position_id": 1,
    "ticker": "005930",
    "alert_type": "take_profit",
    "target_price": 75000.00,
    "current_price": 75200.00,
    "message": "삼성전자 익절가(75,000원) 도달"
  }
}
```

#### request_status_changed
**설명**: 요청 상태 변경 알림

```json
{
  "type": "request_status_changed",
  "data": {
    "request_id": 5,
    "old_status": "pending",
    "new_status": "approved",
    "changed_by": {
      "id": 1,
      "username": "manager"
    },
    "timestamp": "2026-01-26T15:30:00Z"
  }
}
```

---

# 6. 한국투자증권 API 연동

## 6.1 API 개요

### 인증 방식
- **OAuth 2.0** 방식
- **APP_KEY**, **APP_SECRET** 필요
- Access Token 발급 후 사용 (유효기간 24시간)

### 필요한 API

1. **OAuth 인증** - 토큰 발급
2. **국내주식 현재가 시세** - 실시간 가격 조회
3. **국내주식 주문** - 매수/매도 (실제 체결용, Phase 4)
4. **웹소켓 실시간 시세** - 실시간 호가/체결 구독

## 6.2 환경 변수 설정

```bash
# .env 파일
KIS_APP_KEY=your_app_key_here
KIS_APP_SECRET=your_app_secret_here
KIS_ACCOUNT_NUMBER=12345678-01  # 실제 거래 시 필요 (Phase 4)
KIS_CANO=your_cano  # 종합계좌번호
KIS_ACNT_PRDT_CD=01  # 계좌상품코드
```

## 6.3 주요 함수 구현 가이드

### 6.3.1 토큰 발급 (`kis_api_service.py`)

```python
import requests
from datetime import datetime, timedelta

class KISAPIService:
    BASE_URL = "https://openapi.koreainvestment.com:9443"
    
    def __init__(self, app_key: str, app_secret: str):
        self.app_key = app_key
        self.app_secret = app_secret
        self.access_token = None
        self.token_expires_at = None
    
    def get_access_token(self) -> str:
        """OAuth 토큰 발급"""
        if self.access_token and self.token_expires_at > datetime.now():
            return self.access_token
        
        url = f"{self.BASE_URL}/oauth2/tokenP"
        headers = {"content-type": "application/json"}
        body = {
            "grant_type": "client_credentials",
            "appkey": self.app_key,
            "appsecret": self.app_secret
        }
        
        response = requests.post(url, headers=headers, json=body)
        data = response.json()
        
        self.access_token = data["access_token"]
        # 토큰은 24시간 유효, 23시간 후 재발급
        self.token_expires_at = datetime.now() + timedelta(hours=23)
        
        return self.access_token
```

### 6.3.2 현재가 조회

```python
def get_current_price(self, ticker: str, market: str = "KRX") -> dict:
    """국내주식 현재가 시세 조회
    
    Args:
        ticker: 종목코드 (예: "005930")
        market: 시장 구분 (기본값: "KRX")
    
    Returns:
        {
            "ticker": "005930",
            "price": 73500.00,
            "change": 500.00,
            "change_rate": 0.0068,
            "volume": 12500000,
            "timestamp": "2026-01-26T16:05:23Z"
        }
    """
    token = self.get_access_token()
    
    url = f"{self.BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price"
    headers = {
        "content-type": "application/json",
        "authorization": f"Bearer {token}",
        "appkey": self.app_key,
        "appsecret": self.app_secret,
        "tr_id": "FHKST01010100"  # 현재가 시세 조회 TR_ID
    }
    params = {
        "fid_cond_mrkt_div_code": "J",  # 주식
        "fid_input_iscd": ticker
    }
    
    response = requests.get(url, headers=headers, params=params)
    data = response.json()
    
    if data["rt_cd"] != "0":
        raise Exception(f"KIS API Error: {data['msg1']}")
    
    output = data["output"]
    return {
        "ticker": ticker,
        "price": float(output["stck_prpr"]),  # 현재가
        "change": float(output["prdy_vrss"]),  # 전일대비
        "change_rate": float(output["prdy_ctrt"]) / 100,  # 전일대비율
        "volume": int(output["acml_vol"]),  # 누적거래량
        "timestamp": datetime.now().isoformat()
    }
```

### 6.3.3 실시간 가격 모니터링 (WebSocket)

```python
import websocket
import json
import threading

class KISWebSocketService:
    WS_URL = "ws://ops.koreainvestment.com:21000"
    
    def __init__(self, app_key: str, app_secret: str, on_price_update):
        self.app_key = app_key
        self.app_secret = app_secret
        self.on_price_update = on_price_update  # 콜백 함수
        self.ws = None
        self.subscriptions = set()  # 구독 중인 종목 set
    
    def connect(self):
        """웹소켓 연결"""
        self.ws = websocket.WebSocketApp(
            self.WS_URL,
            on_message=self._on_message,
            on_error=self._on_error,
            on_close=self._on_close
        )
        self.ws.on_open = self._on_open
        
        # 별도 스레드에서 실행
        wst = threading.Thread(target=self.ws.run_forever)
        wst.daemon = True
        wst.start()
    
    def subscribe(self, ticker: str):
        """종목 구독"""
        if ticker in self.subscriptions:
            return
        
        subscribe_data = {
            "header": {
                "approval_key": self._get_approval_key(),
                "custtype": "P",  # 개인
                "tr_type": "1",  # 등록
                "content-type": "utf-8"
            },
            "body": {
                "input": {
                    "tr_id": "H0STCNT0",  # 실시간 체결 TR_ID
                    "tr_key": ticker
                }
            }
        }
        
        self.ws.send(json.dumps(subscribe_data))
        self.subscriptions.add(ticker)
    
    def unsubscribe(self, ticker: str):
        """종목 구독 해제"""
        if ticker not in self.subscriptions:
            return
        
        unsubscribe_data = {
            "header": {
                "approval_key": self._get_approval_key(),
                "custtype": "P",
                "tr_type": "2",  # 해제
                "content-type": "utf-8"
            },
            "body": {
                "input": {
                    "tr_id": "H0STCNT0",
                    "tr_key": ticker
                }
            }
        }
        
        self.ws.send(json.dumps(unsubscribe_data))
        self.subscriptions.remove(ticker)
    
    def _on_message(self, ws, message):
        """메시지 수신 처리"""
        data = json.loads(message)
        
        if "body" in data and "output" in data["body"]:
            output = data["body"]["output"]
            ticker = output.get("MKSC_SHRN_ISCD")  # 종목코드
            
            price_data = {
                "ticker": ticker,
                "price": float(output.get("STCK_PRPR", 0)),  # 현재가
                "change": float(output.get("PRDY_VRSS", 0)),  # 전일대비
                "change_rate": float(output.get("PRDY_CTRT", 0)) / 100,
                "volume": int(output.get("ACML_VOL", 0)),
                "timestamp": datetime.now().isoformat()
            }
            
            # 콜백 호출
            self.on_price_update(price_data)
    
    def _get_approval_key(self) -> str:
        """웹소켓 접속키 발급"""
        url = f"{KISAPIService.BASE_URL}/oauth2/Approval"
        headers = {"content-type": "application/json"}
        body = {
            "grant_type": "client_credentials",
            "appkey": self.app_key,
            "secretkey": self.app_secret
        }
        
        response = requests.post(url, headers=headers, json=body)
        return response.json()["approval_key"]
```

## 6.4 가격 알림 로직 (`price_monitor.py`)

```python
from sqlalchemy.orm import Session
from app.models.position import Position
from app.models.price_alert import PriceAlert
from app.services.kis_api_service import KISWebSocketService
from app.websocket.connection_manager import manager
import asyncio
from datetime import datetime, timedelta

class PriceMonitor:
    def __init__(self, db: Session, kis_service: KISWebSocketService):
        self.db = db
        self.kis_service = kis_service
        self.monitored_positions = {}  # {ticker: [position_ids]}
    
    def start_monitoring(self, position_id: int):
        """포지션 모니터링 시작"""
        position = self.db.query(Position).filter(
            Position.id == position_id,
            Position.status == "open"
        ).first()
        
        if not position:
            return
        
        ticker = position.ticker
        
        # 이미 구독 중이 아니면 구독 시작
        if ticker not in self.monitored_positions:
            self.kis_service.subscribe(ticker)
            self.monitored_positions[ticker] = []
        
        if position_id not in self.monitored_positions[ticker]:
            self.monitored_positions[ticker].append(position_id)
    
    def stop_monitoring(self, position_id: int):
        """포지션 모니터링 중지"""
        position = self.db.query(Position).get(position_id)
        if not position:
            return
        
        ticker = position.ticker
        
        if ticker in self.monitored_positions:
            if position_id in self.monitored_positions[ticker]:
                self.monitored_positions[ticker].remove(position_id)
            
            # 더 이상 모니터링할 포지션이 없으면 구독 해제
            if not self.monitored_positions[ticker]:
                self.kis_service.unsubscribe(ticker)
                del self.monitored_positions[ticker]
    
    def handle_price_update(self, price_data: dict):
        """가격 업데이트 처리 (KIS WebSocket 콜백)"""
        ticker = price_data["ticker"]
        current_price = price_data["price"]
        
        # 해당 종목 모니터링 중인 포지션들 확인
        if ticker not in self.monitored_positions:
            return
        
        position_ids = self.monitored_positions[ticker]
        positions = self.db.query(Position).filter(
            Position.id.in_(position_ids),
            Position.status == "open"
        ).all()
        
        for position in positions:
            # 익절가 체크
            if position.take_profit_targets:
                for target in position.take_profit_targets:
                    target_price = target["price"]
                    if current_price >= target_price:
                        self._create_alert(
                            position, "take_profit", 
                            target_price, current_price
                        )
            
            # 손절가 체크
            if position.stop_loss_targets:
                for target in position.stop_loss_targets:
                    target_price = target["price"]
                    if current_price <= target_price:
                        self._create_alert(
                            position, "stop_loss", 
                            target_price, current_price
                        )
        
        # 모든 연결된 클라이언트에게 가격 업데이트 브로드캐스트
        asyncio.create_task(
            manager.broadcast({
                "type": "price_update",
                "data": price_data
            })
        )
    
    def _create_alert(self, position: Position, alert_type: str, 
                      target_price: float, current_price: float):
        """가격 알림 생성 및 전송"""
        # 중복 알림 방지 (5분 이내 동일 알림 무시)
        recent_alert = self.db.query(PriceAlert).filter(
            PriceAlert.position_id == position.id,
            PriceAlert.alert_type == alert_type,
            PriceAlert.target_price == target_price,
            PriceAlert.created_at >= datetime.now() - timedelta(minutes=5)
        ).first()
        
        if recent_alert:
            return
        
        # 알림 DB 저장
        alert = PriceAlert(
            position_id=position.id,
            alert_type=alert_type,
            target_price=target_price,
            current_price=current_price,
            notified_users=[position.opened_by]  # 발의자와 팀장에게 알림
        )
        self.db.add(alert)
        self.db.commit()
        
        # WebSocket으로 알림 전송
        alert_message = {
            "type": "price_alert",
            "data": {
                "alert_id": alert.id,
                "position_id": position.id,
                "ticker": position.ticker,
                "alert_type": alert_type,
                "target_price": target_price,
                "current_price": current_price,
                "message": f"{position.ticker_name} {alert_type} 도달 (목표: {target_price:,.0f}원, 현재: {current_price:,.0f}원)"
            }
        }
        
        asyncio.create_task(
            manager.send_to_users(alert.notified_users, alert_message)
        )
```

---

# 7. 프론트엔드 설계

## 7.1 페이지 구조

### 7.1.1 레이아웃

```
┌─────────────────────────────────────────┐
│ Header (로고, 사용자명, 로그아웃)        │
├──────┬──────────────────────────────────┤
│      │                                  │
│ Side │                                  │
│ bar  │         Main Content             │
│      │                                  │
│ Menu │                                  │
│      │                                  │
└──────┴──────────────────────────────────┘
```

**Sidebar 메뉴**:
- 대시보드
- 포지션 (열림/닫힘)
- 요청 관리 (팀장용)
- 내 요청 (팀원용)
- 토론 세션
- 통계 & 분석
- 설정 (관리자만)

### 7.1.2 대시보드 (Dashboard)

**레이아웃**:
```
┌─────────────────────────────────────────────┐
│  Summary Cards (총 수익, 열린 포지션 수 등)  │
├──────────────────┬──────────────────────────┤
│                  │                          │
│  최근 요청 목록   │   열린 포지션 목록        │
│                  │                          │
└──────────────────┴──────────────────────────┘
│                                             │
│  가격 알림 (익절/손절 도달)                  │
│                                             │
└─────────────────────────────────────────────┘
```

**구성 요소**:
1. **Summary Cards**:
   - 총 수익/손실
   - 열린 포지션 수
   - 대기 중인 요청 수 (팀장에게만)
   - 평균 수익률

2. **최근 요청 목록**: 5개
   - 매수/매도 요청
   - 상태 (pending, approved, rejected, discussion)
   - 요청자, 종목, 시간

3. **열린 포지션 목록**: 전체
   - 종목명, 평단가, 현재가, 수익률
   - 실시간 가격 업데이트 (WebSocket)
   - 클릭 시 상세 페이지 이동

4. **가격 알림**:
   - 익절가/손절가 도달 알림
   - 읽음 처리 기능

### 7.1.3 포지션 목록 (Positions)

**필터링**:
- 상태: 열림(open) / 닫힘(closed)
- 종목 검색
- 개설자 필터

**테이블 컬럼** (열린 포지션):
- 종목명 (티커)
- 평균 매수가
- 현재가 (실시간)
- 수량
- 미실현 수익/손실
- 수익률 (%)
- 보유 시간
- 개설자
- 액션 (상세보기, 정리요청)

**테이블 컬럼** (닫힌 포지션):
- 종목명
- 평균 매수가
- 평균 매도가
- 수익/손실
- 수익률
- 보유 시간
- 개설자 / 종료자
- 종료 날짜

### 7.1.4 포지션 상세 (Position Detail)

```
┌─────────────────────────────────────────────┐
│  종목 정보                                   │
│  - 티커, 종목명, 시장                        │
│  - 현재가 (실시간)                           │
├─────────────────────────────────────────────┤
│  포지션 정보                                 │
│  - 평균 매수가, 수량, 총 매수 금액            │
│  - 목표 익절가 / 손절가                      │
│  - 미실현 손익                               │
├─────────────────────────────────────────────┤
│  기여 팀원                                   │
│  - 팀원별 매수 수량 및 비율                  │
├─────────────────────────────────────────────┤
│  관련 요청 내역                              │
│  - 매수/매도 요청 목록                       │
├─────────────────────────────────────────────┤
│  액션 버튼                                   │
│  - [정리 요청] (모든 팀원)                   │
│  - [수정] (팀장/관리자)                      │
│  - [수동 종료] (팀장/관리자)                 │
└─────────────────────────────────────────────┘
```

**정리 요청 버튼 클릭 시**:
- 모달 열림
- 매도 수량, 가격(선택), 사유 입력
- 제출 → POST /requests/sell

### 7.1.5 요청 관리 (Requests - 팀장용)

**탭 구성**:
- 대기 중 (pending)
- 토론 중 (discussion)
- 승인됨 (approved)
- 거부됨 (rejected)

**요청 카드**:
```
┌─────────────────────────────────────────┐
│ [매수] 삼성전자 (005930)                 │
│ 요청자: trader1 | 2026-01-26 14:30      │
├─────────────────────────────────────────┤
│ 매수 계획:                               │
│  - 72,000원 30%                         │
│  - 71,000원 70%                         │
│ 목표 비중: 5%                            │
│ 익절: 75,000원 (50%), 78,000원 (50%)    │
│ 손절: 68,000원 (100%)                   │
├─────────────────────────────────────────┤
│ [승인] [거부] [토론 개시]                │
└─────────────────────────────────────────┘
```

**승인 버튼 클릭 시**:
- 모달 열림
- 실제 체결 정보 입력:
  - 체결 가격
  - 체결 수량
  - 체결 시간
- 제출 → POST /requests/{id}/approve

**토론 개시 클릭 시**:
- 토론 제목 입력 모달
- 제출 → POST /requests/{id}/discuss
- 자동으로 토론 세션 페이지로 이동

### 7.1.6 토론 세션 (Discussion)

**레이아웃**:
```
┌─────────────────────────────────────────┐
│  토론 제목                               │
│  관련 요청: [매수] 삼성전자              │
├─────────────────────────────────────────┤
│                                         │
│  채팅 영역 (스크롤 가능)                 │
│                                         │
│  [manager] 10:30                        │
│  현재 기술적 지표 어떻게 보시나요?       │
│                                         │
│  [trader1] 10:32                        │
│  RSI 50 돌파했고 MACD 골든크로스입니다.  │
│                                         │
├─────────────────────────────────────────┤
│  [메시지 입력창]              [전송]     │
├─────────────────────────────────────────┤
│  [토론 종료] (팀장/관리자만)             │
└─────────────────────────────────────────┘
```

**기능**:
- 실시간 채팅 (WebSocket)
- 참여자 목록 표시
- 토론 종료 시 JSON export 제공
- 종료된 토론은 읽기 전용

### 7.1.7 통계 & 분석 (Stats)

**탭 구성**:
- 내 성과
- 팀 전체
- 리더보드
- 포지션 분석

**내 성과 탭**:
- 총 거래 수, 승률, 총 손익
- 평균 수익률, 평균 보유 기간
- 월별 성과 차트
- 최고/최악 거래

**팀 전체 탭**:
- 팀 총 손익, 평균 승률
- 기간별 필터링 (일/주/월/전체)
- 종목별 성과

**리더보드 탭**:
- 팀원별 수익률 순위
- 승률 순위
- 거래 횟수

**포지션 분석 탭**:
- 보유 기간 분포
- 수익 분포
- 토론 유무에 따른 성과 비교

## 7.2 반응형 디자인 (Mobile)

### Tailwind CSS Breakpoints
```css
sm: 640px   /* 모바일 가로 */
md: 768px   /* 태블릿 */
lg: 1024px  /* 데스크탑 */
xl: 1280px  /* 와이드 */
```

### 모바일 레이아웃 변경

**데스크탑 (≥1024px)**:
- Sidebar 항상 표시
- 테이블 형태로 데이터 표시
- 2~3단 레이아웃 가능

**태블릿 (768px~1023px)**:
- Sidebar 토글 가능 (햄버거 메뉴)
- 테이블 → 카드 형태로 변환
- 2단 레이아웃

**모바일 (<768px)**:
- Sidebar 완전 숨김 (햄버거 메뉴로 오버레이)
- 모든 콘텐츠 1단 세로 배치
- 카드 형태로 모든 정보 표시
- 큰 터치 타겟 (버튼 최소 44x44px)
- Bottom Navigation 고려

### 주요 컴포넌트 반응형 예시

```jsx
// 포지션 카드 (모바일)
<div className="p-4 md:p-6 lg:p-8">
  <h3 className="text-lg md:text-xl lg:text-2xl">삼성전자</h3>
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {/* 콘텐츠 */}
  </div>
</div>

// 버튼
<button className="w-full md:w-auto px-4 py-2">
  승인
</button>
```

---

# 8. 개발 단계 (Phased Approach)

## Phase 1: MVP (Core 기능)

**목표**: 기본적인 요청-승인-포지션 관리 시스템

**구현 범위**:
1. 사용자 인증 및 권한 관리
   - 로그인/로그아웃
   - JWT 토큰 관리
   - 역할 기반 접근 제어

2. 매수/매도 요청 생성
   - 매수 요청 폼 (종목, 가격, 비중, 목표가)
   - 매도 요청 폼 (수량, 가격, 사유)

3. 팀장 승인/거부 기능
   - 요청 목록 조회
   - 승인 시 체결 정보 입력
   - 거부 시 사유 입력

4. 포지션 관리
   - 포지션 생성 (매수 승인 시)
   - 포지션 조회 (목록, 상세)
   - 포지션 종료 (매도 승인 시)

5. 기본 대시보드
   - Summary Cards
   - 최근 요청 목록
   - 열린 포지션 목록

**검증 기준**:
- 사용자가 매수 요청을 생성할 수 있다
- 팀장이 요청을 승인/거부할 수 있다
- 승인된 요청이 포지션으로 전환된다
- 포지션 정보를 조회할 수 있다

## Phase 2: 협업 기능

**목표**: 토론 세션 및 실시간 통신

**구현 범위**:
1. 토론 세션 생성 및 채팅
   - 팀장이 요청에 대한 토론 개시
   - 실시간 채팅 (WebSocket)
   - 참여자 표시

2. 토론 종료 및 데이터 내보내기
   - 팀장/관리자가 세션 종료
   - 채팅 로그 JSON export

3. 포지션 정리 요청 워크플로우
   - 모든 팀원이 정리 요청 가능
   - 정리 요청 승인/거부

4. 팀원별 성과 조회
   - 개인 통계 페이지
   - 월별 성과

**검증 기준**:
- 팀장이 토론을 개시할 수 있다
- 팀원들이 실시간으로 메시지를 주고받을 수 있다
- 토론이 종료되면 JSON으로 데이터를 다운로드할 수 있다

## Phase 3: 자동화 및 분석

**목표**: 실시간 가격 모니터링 및 통계

**구현 범위**:
1. 한국투자증권 API 연동
   - OAuth 인증
   - 현재가 조회 API
   - WebSocket 실시간 시세

2. 실시간 가격 모니터링
   - 열린 포지션 자동 구독
   - 익절가/손절가 알림

3. 수익률 자동 계산
   - 포지션 종료 시 자동 계산
   - 수동 수정 가능

4. 팀 전체 통계 대시보드
   - 리더보드
   - 종목별 성과
   - 기간별 필터링

**검증 기준**:
- 실시간으로 가격이 업데이트된다
- 익절가/손절가 도달 시 알림을 받는다
- 팀원별 성과를 비교할 수 있다

## Phase 4: 고도화

**목표**: 추가 시장 지원 및 고급 기능

**구현 범위**:
1. 바이낸스 API 연동
   - 해외 선물 시장 지원
   - 실시간 가격 구독

2. LLM 기반 토론 요약
   - 토론 종료 시 자동 요약 생성
   - 참여자별 요약

3. 외부 알림 (선택사항)
   - 카카오톡 플러스친구
   - 텔레그램 봇
   - 이메일

4. 고급 분석 및 인사이트
   - 토론 유무에 따른 성과 차이
   - 매수/매도 타이밍 분석
   - 보유 기간 최적화

5. 데이터 export 기능 강화
   - CSV, Excel 다운로드
   - API를 통한 데이터 접근

**검증 기준**:
- 바이낸스 선물 거래를 관리할 수 있다
- 토론 종료 시 자동으로 요약이 생성된다
- 데이터를 다양한 형식으로 내보낼 수 있다

---

# 9. 주요 고려사항

## 9.1 데이터 무결성

- 모든 요청 및 승인 내역 감사 로그 저장
- 포지션 수정 이력 추적
- 삭제된 데이터 복구 가능성 (soft delete 고려)
- 트랜잭션 처리로 일관성 보장

## 9.2 보안

- 사용자 인증 (JWT)
- API 키 안전한 저장 (환경 변수, Secrets)
- 권한별 엔드포인트 접근 제어
- SQL Injection 방지 (ORM 사용)
- XSS 방지 (입력 검증, 출력 인코딩)

## 9.3 확장성

- 다중 펀드팀 지원 가능성
- 팀 규모 확대 대응
- 데이터 증가에 따른 성능 최적화
  - 인덱스 최적화
  - 페이지네이션
  - 캐싱 (Redis 고려)

## 9.4 사용성

- 직관적인 UI/UX
- 모바일 환경 최적화
- 빠른 응답 속도
- 에러 메시지 명확하게 표시
- 로딩 상태 표시

## 9.5 모니터링 및 로깅

- 애플리케이션 로그 (Python logging)
- 에러 추적 (Sentry 고려)
- 성능 모니터링
- API 호출 로그

---

# 10. 클라우드타입 배포 가이드

## 10.1 사전 준비

1. **GitHub 저장소 생성**
   - 프로젝트 코드 푸시

2. **클라우드타입 계정 생성**
   - https://cloudtype.io 가입

3. **환경 변수 준비**
   ```
   DATABASE_URL=postgresql://...
   SECRET_KEY=your-secret-key
   KIS_APP_KEY=your-kis-app-key
   KIS_APP_SECRET=your-kis-app-secret
   ```

## 10.2 백엔드 배포

1. **클라우드타입에서 새 프로젝트 생성**
   - GitHub 저장소 연결
   - 브랜치 선택 (main)

2. **빌드 설정**
   ```yaml
   # cloudtype.yml (backend)
   name: fund-messenger-backend
   app:
     - type: python
       port: 8000
       build_command: pip install -r requirements.txt
       start_command: uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```

3. **환경 변수 설정**
   - 클라우드타입 대시보드에서 설정

4. **PostgreSQL 추가**
   - 클라우드타입 "추가 서비스"에서 PostgreSQL 선택

## 10.3 프론트엔드 배포

1. **별도 프로젝트로 배포** (또는 동일 저장소 monorepo)

2. **빌드 설정**
   ```yaml
   # cloudtype.yml (frontend)
   name: fund-messenger-frontend
   app:
     - type: static
       build_command: npm run build
       publish_directory: dist
   ```

3. **환경 변수**
   ```
   VITE_API_URL=https://fund-messenger-backend.cloudtype.app
   ```

## 10.4 배포 후 확인

- API Health Check: `GET /health`
- 프론트엔드 접속 확인
- WebSocket 연결 테스트
- 한투 API 연동 확인

---

# 11. 개발 순서 제안 (Claude Code Opus용)

## 11.1 Phase 1 구현 순서

### Step 1: 프로젝트 초기 설정
1. 프로젝트 구조 생성
2. requirements.txt 작성 (FastAPI, SQLAlchemy, Alembic 등)
3. .env.example 작성
4. 기본 config.py 작성

### Step 2: 데이터베이스 설정
1. database.py 작성 (PostgreSQL 연결)
2. Alembic 초기화 및 설정
3. SQLAlchemy 모델 작성 (users, positions, requests)
4. 첫 마이그레이션 생성 및 실행

### Step 3: 인증 시스템
1. JWT 유틸리티 함수 (utils/security.py)
2. User 스키마 (schemas/user.py, schemas/auth.py)
3. 인증 서비스 (services/auth_service.py)
4. 인증 API 라우터 (api/auth.py)
   - POST /auth/register
   - POST /auth/login
   - POST /auth/refresh

### Step 4: 요청 관리
1. Request 스키마 (schemas/request.py)
2. Request 서비스 (services/request_service.py)
3. Request API 라우터 (api/requests.py)
   - POST /requests/buy
   - POST /requests/sell
   - GET /requests
   - GET /requests/{id}
   - POST /requests/{id}/approve (팀장만)
   - POST /requests/{id}/reject (팀장만)

### Step 5: 포지션 관리
1. Position 스키마 (schemas/position.py)
2. Position 서비스 (services/position_service.py)
   - 요청 승인 시 포지션 생성/합산 로직
   - 매도 승인 시 포지션 종료 로직
3. Position API 라우터 (api/positions.py)
   - GET /positions
   - GET /positions/{id}
   - PATCH /positions/{id}
   - POST /positions/{id}/close

### Step 6: 프론트엔드 기본 구조
1. Vite + React 프로젝트 초기화
2. Tailwind CSS 설정
3. 라우팅 설정 (React Router)
4. Auth Context 및 API 서비스
5. 로그인 페이지
6. 기본 레이아웃 (Header, Sidebar)

### Step 7: 프론트엔드 핵심 페이지
1. 대시보드 (간단한 버전)
2. 매수/매도 요청 폼
3. 요청 관리 페이지 (팀장용)
4. 포지션 목록 및 상세

---

