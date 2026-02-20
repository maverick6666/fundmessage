# 뉴스데스크 종합 맥락 문서

> 작성일: 2026-02-19
> 목적: 새로운 세션에서도 동일한 맥락을 유지할 수 있도록 모든 설계 결정, 고려사항, 작업 이력을 종합 정리
> 대상 독자: Claude Code (새 세션), 프로젝트 팀원

---

## 1. 프로젝트 전체 그림

### 1.1 세 개의 프로젝트

| 프로젝트 | 위치 | 역할 | 기술 스택 |
|----------|------|------|-----------|
| **펀드메신저** | `F:/fundmessage` | 메인 웹앱 (프론트+백엔드+DB) | React 18 + Spring Boot + PostgreSQL |
| **뉴스데스크 센터** | `F:/newsdesk` | 뉴스 수집 + AI 분석 파이프라인 | FastAPI + Ollama + PostgreSQL |
| **뉴스데스크 센터 (리팩토링 대상)** | `F:/newsdesk` | Phase C에서 대폭 수정 예정 | Cerebras API + Qwen3-235B |

### 1.2 데이터 플로우

```
[뉴스데스크 센터 (로컬)]
├─ 뉴스 수집 (MarketAux, 네이버, CryptoCompare)
├─ AI 종목 커플링 (Cerebras API → Qwen3-235B)
├─ 관련도 점수 산출 (EMA + min-max 정규화)
├─ 기술적 분석 생성 (OHLCV → AI 분석)
└─ fundmessage API로 업로드
        │
        ▼
[펀드메신저 Spring Boot]
├─ 데이터 수신 + DB 저장
├─ KIS API로 증시 데이터 수집 (자동 스케줄러)
└─ API 제공
        │
        ▼
[펀드메신저 React 프론트엔드]
├─ 지수 카드 4개 (코스피/코스닥/NASDAQ/BTC)
├─ 증시 브리핑 패널
├─ 섹터 히트맵 (Finviz 스타일, 로그 스케일)
└─ 종목 상세 사이드 패널 (차트 + AI 분석 + 뉴스 타래)
```

---

## 2. 뉴스데스크 버전 이력

### 2.1 v1 (기존, 폐기 예정)

- **방식**: 날짜 기반 일일 브리핑
- **AI**: 단일 GPT 호출로 11개 JSON 필드 한꺼번에 생성
- **문제점**:
  - 단일 호출 병목 → 뒤쪽 항목 품질 저하 (-26%)
  - 키워드 기반 수집 → 예상치 못한 이슈 누락
  - 뉴스-종목 관계 없음
  - 시세 데이터와 연결 안 됨
- **프롬프트 최적화 이력** (Iter 0~4):
  - verbosity 파라미터가 출력 길이에 가장 큰 영향
  - 글자수 목표 → LLM이 못 지킴, 문단/문장 수가 효과적
  - 데이터 전처리 > 프롬프트 지시 (소형 모델일수록)
  - Few-shot 예시가 길이 변동성 감소에 가장 효과적
  - 오버슈트(목표의 1.3배 이상 요구)는 역효과 가능

### 2.2 v2 (현재, Phase B 완료)

- **방식**: 종목 중심 뉴스 인텔리전스
- **핵심 전환**: 날짜 기반 → 종목 기반, 단일 GPT → 뉴스데스크 센터 파이프라인
- **AI**: Cerebras API + Qwen3-235B (Phase C에서 적용)
- **프론트엔드**: 히트맵 + 사이드 패널 + 뉴스 아코디언 (구현 완료, 목업 데이터)

---

## 3. 현재 완료 상태 (Phase A + B)

### Phase A: Spring Boot 리팩토링 ✅

친구(Maverixxk)가 FastAPI → Spring Boot 리팩토링을 ~95% 완료한 상태에서, 나머지 수정 작업:

1. **WebSocket 메시지 포맷 수정** — `data` 필드 unwrap 로직 추가
2. **Stats API 경로 4개 통일** — 프론트엔드 호환
3. **Price API candles 파라미터** — `timeframe`, `limit`, `before` 통일
4. **LocalDateTime → OffsetDateTime** — 19개 파일 일괄 수정
5. **뉴스데스크 v2 엔티티 + API** — 4개 엔티티, 4개 레포, 서비스, DTO, 컨트롤러
6. **Docker 빌드 + 실행 검증** — 3개 서비스 정상 기동 확인

**Spring Boot v2 DB 엔티티 (신규 4개)**:
- `MarketStock` — 종목 마스터 (ticker, name, market, sector, exchange)
- `StockDailyPrice` — 일별 시세 (stock_id, date, OHLCV, change_pct)
- `StockNews` — 종목-뉴스 커플링 N:M (stock_id, relevance_score, coupled_by)
- `MarketSummary` — 시장 요약 (date, market_type, index_value, ai_summary)

**Spring Boot v2 API 엔드포인트**:
```
GET  /api/v1/newsdesk/v2/stocks              — 종목 목록 (뉴스 개수 포함)
GET  /api/v1/newsdesk/v2/stocks/{stockId}    — 종목 상세 (뉴스 포함)
GET  /api/v1/newsdesk/v2/market-summary      — 시장 요약
POST /api/v1/newsdesk/v2/upload              — 뉴스데스크 센터에서 데이터 수신
```

### Phase B: 프론트엔드 ✅

**구현 완료 (목업 데이터)**:

#### 지수 카드 4개
- 코스피, 코스닥, NASDAQ, BTC
- 클릭 시 해당 장 브리핑 패널 펼침 + 히트맵 전환

#### 증시 브리핑 패널
- AI 생성 장 요약, 상승/하락 업종, 거래 통계

#### 섹터 히트맵 (Finviz 스타일)
- **로그 스케일 적용**: `Math.log(cap + 1)` → 시총 35x 차이를 2.4x로 시각적 압축
- ResizeObserver로 컨테이너 크기 감지
- 4개 시장 탭 전환
- 종목 블록 색상: 등락률 기반 (빨강=상승, 파랑=하락)

#### 종목 상세 사이드 패널 (완전 재설계)
- **닫기 버튼**: custom 타입에 직접 X 버튼 + `closePanel` 호출
- **30일 SVG 가격 차트**: viewBox + preserveAspectRatio="none" + vectorEffect="non-scaling-stroke"
- **AI 기술적 분석**: analysis.technical 텍스트 + signals 배지 (매수/매도/관망 등)
- **종목 소개**: 회사가 뭘 하는 곳인지 설명 (시총/PER/PBR 대신)
- **뉴스 아코디언**: 클릭으로 펼치기/접기, expandedId state
- **관련도순 정렬**: relevance_score 내림차순, % 없이 숫자만, 100+ 빨간 배지

#### 목업 데이터 구조 (`newsdeskService.js`)
```javascript
MOCK_STOCK_DETAIL = {
  ohlcv: [{ date, open, high, low, close, volume }, ...],  // 30일
  analysis: {
    technical: "기술적 분석 텍스트...",
    signals: ["20일선 골든크로스", "RSI 과매수 근접", ...]
  },
  profile: {
    description: "삼성전자는 세계 최대 메모리 반도체 제조업체로..."
  },
  news: [
    { id, title, summary, source, date, relevance_score },  // 관련도순
    ...
  ]
}
```

---

## 4. Phase C: 뉴스데스크 센터 재설계 (다음 작업)

### 4.1 핵심 변경: 클러스터링 → 종목 커플링

**기존** (현재 `F:/newsdesk`):
- 뉴스를 주제별로 클러스터링 (HDBSCAN, 임베딩 기반)
- 클러스터 → 인사이트 → 관계도 → 감성 분석
- Ollama Qwen3-14B (로컬 GPU)

**변경 후**:
- 뉴스를 **종목에 직접 커플링** (N:M 관계)
- 관련도 점수 산출 (EMA + min-max 정규화)
- OHLCV 데이터 → AI 기술적 분석 생성
- **Cerebras API + Qwen3-235B** (클라우드, 무료 티어)

### 4.2 AI 인프라 결정: Cerebras API

**왜 Cerebras인가**:

| 항목 | Cerebras | 자체 GPU 서버 |
|------|----------|---------------|
| 초기 비용 | $0 | 2,000만원+ (RTX 5090 × 4) |
| 무료 한도 | 하루 1M 토큰 | 무제한 |
| 유료 가격 | 입력 $0.60/M, 출력 $1.20/M | 전기세 + 유지비 |
| 속도 | ~1,400 tok/s | 모델/하드웨어 의존 |
| 모델 | Qwen3-235B | 선택 자유 |
| 컨텍스트 | 무료 64K / 유료 131K | 모델 의존 |
| 전환 시점 | API 비용 월 $500+ 또는 파인튜닝 필요 시 | - |

**결론**: 현재 단계에서 자체 서버 불필요. Cerebras 무료 티어로 시작, 사용자가 모이면 전환.

**64K 컨텍스트 윈도우 충분한 이유**:
- 뉴스-종목 커플링: 건당 ~3.5K 토큰 (뉴스 본문 + 종목 리스트 + 프롬프트)
- 10건 배치: ~12K 토큰
- 기술적 분석: 종목당 ~3K 토큰
- **파이프라인으로 나눠서 호출**하면 64K로 충분
- 한 번에 원문 100건 넣는 것보다 품질도 더 좋음 (우리가 경험한 문제)

### 4.3 워크로드 토큰 추정

| 작업 | 토큰/건 | 일일 건수 | 일일 토큰 |
|------|---------|-----------|-----------|
| 뉴스-종목 커플링 (10건 배치) | ~12K | ~80배치 (800건) | ~960K |
| 기술적 분석 | ~3K | ~50종목 | ~150K |
| 시장 브리핑 | ~15K | 4건 (시장별) | ~60K |
| **합계** | | | **~1.17M** |

→ 무료 1M 약간 초과. 유료 전환 시 하루 $1.4 (월 ~$42)로 매우 저렴.
→ 또는 배치 크기를 20건으로 늘리면 배치 수 절반 → 무료 범위 내.

### 4.4 뉴스 소스별 커플링 전략

#### A. MarketAux (해외) — AI 불필요, 변환만

MarketAux가 이미 엔티티(ticker, match_score, sentiment)를 제공:
```python
# match_score (10점 만점) → relevance_score (100점 만점)
relevance_score = ticker_info["match_score"] * 10  # 8.5 → 85
coupled_by = "marketaux"
```

#### B. 네이버 (국내) — Cerebras API + Qwen3-235B

네이버 뉴스에는 엔티티 없음 → AI가 종목 식별 + 관련도 점수 산출:
```
입력: "삼성전자, HBM3E 엔비디아 품질 테스트 통과"
출력:
  - 삼성전자 (005930): 관련도 95, 이유: "직접적 주체"
  - SK하이닉스 (000660): 관련도 78, 이유: "HBM 경쟁사"
  - NVIDIA (NVDA): 관련도 72, 이유: "HBM 수요처"
```

#### C. CryptoCompare — tags 기반 매핑 또는 AI

크립토 종목 수가 제한적이므로 우선순위 낮음.

### 4.5 관련도 점수 설계 (EMA + min-max 정규화)

**사용자 제안 개념**: 클러스터링에 EMA(지수이동평균) 적용

**구현 방향**:
1. AI가 뉴스-종목 raw score 산출 (0-100)
2. 시간 감쇠에 EMA 적용:
   ```
   score_ema = alpha * raw_score + (1 - alpha) * prev_ema
   ```
   - alpha: 시간 감쇠 계수 (최신 뉴스일수록 가중치 높음)
   - 오래된 뉴스도 raw_score가 높으면 상위 가능
3. 해당 종목의 전체 뉴스 점수를 min-max 정규화 → 100 기준
4. 특히 중요한 뉴스(실적 발표, 대규모 계약 등)는 100 초과 허용

**프론트엔드 표시**:
- 점수에 % 붙이지 않음 (순수 숫자)
- 100 이상은 빨간 배지
- 관련도순 정렬 (날짜순 아님, 단 최신 뉴스가 자연스럽게 상위)

### 4.6 AI 기술적 분석 설계

종목의 OHLCV 데이터를 AI에 넣어서 기술적 분석 생성:

```
입력:
  - 종목: 삼성전자 (005930)
  - OHLCV 30일 데이터
  - 현재가, 거래량 추이

AI 출력:
  {
    "technical": "삼성전자는 최근 20일 이동평균선을 돌파하며 상승 추세로 전환...",
    "signals": ["20일선 골든크로스", "거래량 증가 추세", "RSI 65 (중립 상단)"],
    "support": 80000,
    "resistance": 88000
  }
```

### 4.7 뉴스데스크 센터 현재 코드 구조 (수정 대상)

```
F:/newsdesk/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI 엔트리포인트
│   │   ├── config.py               # 설정 (DB, Ollama, API 키)
│   │   ├── database.py             # SQLAlchemy
│   │   ├── models/
│   │   │   ├── raw_news.py         # RawNews 모델
│   │   │   └── news_cluster.py     # NewsCluster + NewsdeskSnapshot
│   │   ├── services/
│   │   │   ├── news_collector.py   # 뉴스 수집 오케스트레이터
│   │   │   ├── ollama_client.py    # Ollama HTTP 클라이언트
│   │   │   ├── pipeline.py         # AI 파이프라인 오케스트레이터
│   │   │   └── agents/
│   │   │       ├── clustering_agent.py   # 클러스터링 (제거/대체 대상)
│   │   │       ├── sentiment_agent.py    # 감성 분석
│   │   │       ├── relation_agent.py     # 관계도
│   │   │       └── insight_agent.py      # 인사이트
│   │   └── api/
│   │       ├── crawl.py            # 수집 API
│   │       ├── pipeline.py         # 파이프라인 API
│   │       └── newsdesk.py         # 데이터 조회 API
│   └── requirements.txt
├── frontend/                       # React + TypeScript (현재 별도 UI)
└── docker-compose.yml
```

**현재 AI**: Ollama + Qwen3-14B (로컬 GPU)
**변경 후 AI**: Cerebras API + Qwen3-235B (클라우드)

**주요 변경점**:
1. `ollama_client.py` → `cerebras_client.py` (Cerebras API 클라이언트)
2. `clustering_agent.py` → `coupling_agent.py` (종목 커플링으로 전환)
3. `insight_agent.py` → OHLCV 기반 기술적 분석 에이전트 추가
4. 파이프라인: 클러스터링 → 커플링으로 플로우 변경
5. 업로드 로직: 분석 결과를 fundmessage Spring Boot API로 전송

---

## 5. DB 스키마 (fundmessage Spring Boot)

### 신규 테이블 4개 (이미 엔티티 구현 완료)

```sql
-- 종목 마스터
CREATE TABLE market_stocks (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(20) NOT NULL,
    ticker_name VARCHAR(100) NOT NULL,
    market VARCHAR(20) NOT NULL,       -- KOSPI, KOSDAQ, NASDAQ, SP500
    sector_code VARCHAR(20),
    sector_name VARCHAR(100),
    market_cap BIGINT,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(ticker, market)
);

-- 일별 시세
CREATE TABLE stock_daily_price (
    id SERIAL PRIMARY KEY,
    stock_id INTEGER REFERENCES market_stocks(id),
    trade_date DATE NOT NULL,
    open_price DECIMAL(15,2),
    high_price DECIMAL(15,2),
    low_price DECIMAL(15,2),
    close_price DECIMAL(15,2),
    volume BIGINT,
    change_rate DECIMAL(8,4),
    UNIQUE(stock_id, trade_date)
);

-- 뉴스-종목 커플링 (N:M)
CREATE TABLE stock_news (
    id SERIAL PRIMARY KEY,
    stock_id INTEGER REFERENCES market_stocks(id),
    title VARCHAR(500),
    summary TEXT,
    source_url VARCHAR(1000),
    source_name VARCHAR(100),
    published_at TIMESTAMPTZ,
    relevance_score DECIMAL(5,2) NOT NULL,
    sentiment VARCHAR(20),
    coupled_by VARCHAR(50) DEFAULT 'ai',  -- marketaux, qwen3, manual
    coupled_at TIMESTAMPTZ DEFAULT NOW()
);

-- 시장 요약
CREATE TABLE market_summary (
    id SERIAL PRIMARY KEY,
    summary_date DATE NOT NULL,
    market VARCHAR(20) NOT NULL,
    index_value DECIMAL(15,2),
    index_change DECIMAL(10,2),
    index_change_rate DECIMAL(8,4),
    sector_performance JSONB,
    ai_summary TEXT,
    UNIQUE(summary_date, market)
);
```

---

## 6. 프론트엔드 기술 상세

### 6.1 주요 파일

- `frontend/src/pages/NewsDesk.jsx` — 뉴스데스크 v2 전체 UI (완전 재작성)
- `frontend/src/services/newsdeskService.js` — v2 API 서비스 + 목업 데이터
- `frontend/src/components/layout/Layout.jsx` — overflow 수정
- `frontend/src/components/layout/SidePanel.jsx` — 노션 스타일 사이드 패널
- `frontend/src/stores/useSidePanelStore.js` — Zustand 사이드 패널 상태

### 6.2 핵심 컴포넌트 (NewsDesk.jsx 내부)

| 컴포넌트 | 역할 |
|----------|------|
| `IndexCard` | 지수 카드 (코스피/코스닥/NASDAQ/BTC) |
| `BriefingPanel` | 증시 브리핑 (요약 + 업종 + 통계) |
| `SectorHeatmap` | 섹터 히트맵 (로그 스케일 트리맵) |
| `StockDetailContent` | 사이드 패널 (차트 + AI 분석 + 뉴스 아코디언) |

### 6.3 사이드 패널 호출 방식

```javascript
// useSidePanelStore: 단일 객체 파라미터
openPanel({ type: 'custom', data: { render: () => <StockDetailContent stock={stock} /> } });

// custom 타입은 SidePanel.jsx가 헤더를 렌더링하지 않음
// → StockDetailContent에 직접 닫기 버튼 구현
```

### 6.4 해결한 버그들

| 버그 | 원인 | 해결 |
|------|------|------|
| 사이드 패널 내용 비어있음 | `openPanel` positional args vs object 파라미터 | `openPanel({ type, data })` 객체로 변경 |
| TDZ 에러 | `const activeIndex` 선언 전에 참조 | 선언 순서 이동 |
| 시장명 "-" 표시 | 히트맵 stock 객체에 market 프로퍼티 없음 | `{ ...stock, market: activeIndex.name }` 추가 |
| 사이드 패널 닫기 불가 | custom 타입에 헤더(닫기 버튼) 미렌더링 | StockDetailContent에 직접 X 버튼 추가 |
| 텍스트 overflow | flex children shrink 안 됨 | `overflow-x-hidden` + `min-w-0` |

### 6.5 알려진 이슈 (미해결)

**🔴 텍스트 overflow (불구대천의 원수)**:
- Layout.jsx 1차 수정만 완료
- 프로젝트 전반 개별 페이지 전수 점검 필요
- 뷰포트 크기 축소 시 텍스트 줄바꿈 반복 후 삐져나옴
- 프론트엔드 작업 시 항상 `min-w-0`, `truncate`, `overflow-hidden` 확인 필요

---

## 7. GitHub 저장소

| 저장소 | 내용 | 비고 |
|--------|------|------|
| `maverick6666/fundmessage` | 전체 프로젝트 (프론트+백엔드+문서+메모리) | 개인 저장소 |
| `Maverixxk/FundMassagenger` | Spring Boot + React (프로젝트 코드만) | 팀 저장소 (문서/메모리/Python 제외) |

---

## 8. 프로젝트 비전

- **대상**: 전국 50개 대학 투자동아리, 1,500~2,000명
- **성격**: 투자 커뮤니티 정보교환 플랫폼
- **뉴스데스크**: 24시간 자동 운영 서비스
- **AI 전략**: Cerebras API로 시작 → 사용자 증가 시 자체 GPU 서버 전환
- **확장 AI**: 매매습관 분석, 개인화 종목추천, 자체 투자모델 학습
- **지원금**: 5천만~1억 (정부 지원금)

---

## 9. Phase C 구현 순서 (다음 작업)

### Step 1: Cerebras API 클라이언트

- `ollama_client.py` → `cerebras_client.py`
- OpenAI 호환 API 형태 (Cerebras는 OpenAI SDK 호환)
- 모델: `qwen3-235b-a22b`
- 에러 핸들링, 재시도, 토큰 카운팅

### Step 2: 종목 커플링 에이전트

- `clustering_agent.py` → `coupling_agent.py`
- MarketAux 뉴스: 엔티티 변환만 (AI 불필요)
- 네이버 뉴스: Cerebras API로 종목 식별 + 관련도 점수
- 10건 배치 처리 (64K 컨텍스트 내)

### Step 3: 기술적 분석 에이전트

- OHLCV 30일 데이터 입력 → AI 기술적 분석 생성
- 시그널 배지 (골든크로스, RSI 등)
- 지지선/저항선 추정

### Step 4: EMA 관련도 점수 정규화

- 시간 감쇠 EMA 적용
- min-max 정규화 (100 기준, 초과 허용)
- 종목별 점수 산출

### Step 5: fundmessage API 업로드

- 분석 결과를 Spring Boot `POST /api/v1/newsdesk/v2/upload`로 전송
- raw_news + stock_news (커플링 결과) + market_summary

### Step 6: 파이프라인 통합 + 테스트

- 뉴스 수집 → 커플링 → 기술적 분석 → 업로드 전체 플로우
- 프론트엔드 `USE_MOCK = false`로 전환하여 실제 데이터 검증

---

## 10. 개발 환경 규칙

| 규칙 | 내용 |
|------|------|
| 개발 환경 | 로컬 Docker (`docker-compose up -d --build`) |
| 배포 | 클라우드타입/Vercel 언급 금지 (현재 로컬 개발 중) |
| 시간 기준 | 모든 시간 로직 KST (UTC+9) |
| UI | `window.alert/confirm/prompt` 절대 금지 → `ConfirmModal` + `toast` |
| AI 모델 | 프로덕션: gpt-5-mini / 테스트: gpt-5-nano |
| git push | 사용자 지시할 때만 |
| 프론트엔드 작업 | frontend-design 스킬로만 (직접 코드 수정 금지) |
| 테스트 계정 | 팀장: lhhh0420@naver.com / lhh0420! |

---

## 11. 프롬프트 엔지니어링 교훈 (v1에서 학습)

| 교훈 | 상세 |
|------|------|
| verbosity가 핵심 | Responses API의 verbosity=high로 +46~72% 출력 증가 |
| 글자수 목표 불가 | LLM이 글자수 못 지킴 → 문단/문장 수가 효과적 |
| 전처리 > 프롬프트 | 데이터를 전처리해서 넣는 것이 프롬프트 지시보다 효과적 |
| 오버슈트 주의 | 목표의 1.3배 이상 요구 시 품질 저하 가능 |
| Few-shot 효과 | 예시가 길이 변동성 감소에 가장 효과적 |
| 단일 호출 한계 | 11개 항목 한꺼번에 → 뒤쪽 품질 -26% → 분리 호출 필수 |
| JSON 후처리 | response_format 없이 텍스트 출력 → JSON 추출도 가능 (3단계 파싱) |

---

## 12. 참조 문서

| 문서 | 위치 | 내용 |
|------|------|------|
| 뉴스데스크 v2 설계서 | `docs/newsdesk-v2-design.md` | DB 스키마, 파이프라인, API 설계 |
| 뉴스데스크 v2 UI 명세 | `docs/newsdesk-v2-ui-spec.md` | 프론트엔드 컴포넌트 상세 |
| 뉴스데스크 센터 기획서 | `docs/NEWSDESK_CENTER_PROPOSAL.md` | 4단계 에이전트 파이프라인 (참조용) |
| 인프라 & AI 전략 | `docs/INFRASTRUCTURE_AI_STRATEGY.md` | GPU 서버, 비용, 지원금 전략 |
| 메모리 세션 상태 | `memory/session-state.md` | 현재 진행 상태 |
| 메모리 작업 이력 | `memory/work-log.md` | 시간순 작업 기록 |
| 메모리 기술 결정 | `memory/decisions.md` | 환경/기술 변경 이력 |
