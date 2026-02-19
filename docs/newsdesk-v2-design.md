# 뉴스데스크 v2 - 종목 중심 뉴스 인텔리전스 설계서

> 작성일: 2026-02-19
> 상태: 설계 완료, 구현 대기

---

## 1. 개요

### 1.1 한 줄 요약
기존 뉴스데스크(날짜 기반 뉴스 브리핑)를 **종목 중심 뉴스 인텔리전스**로 재설계.

### 1.2 기존 vs v2

| 항목 | 기존 뉴스데스크 | v2 |
|------|-----------------|-----|
| **중심축** | 날짜 (일별 브리핑) | 종목 (종목별 뉴스 타래) |
| **상단** | 칼럼 + 뉴스카드 | 지수 카드 4개 (코스피/코스닥/나스닥/S&P500) |
| **하단** | 키워드 버블 + 주목종목 | 섹터 히트맵 (종목 클릭 → 상세 패널) |
| **AI 분석** | 단일 GPT 호출 (11개 JSON) | MarketAux 엔티티(해외) + Ollama Qwen3(국내) |
| **데이터 수집** | 네이버 검색 + yfinance | KIS API (증시) + MarketAux + 네이버 + CryptoCompare |
| **분석 주체** | fundmessage 서버 (GPT API) | 뉴스데스크 센터 (로컬) |
| **뉴스-종목 관계** | 없음 | N:M 커플링 (관련도 점수) |

### 1.3 시스템 구성

```
┌──────────────────────────────┐     ┌──────────────────────────────┐
│  뉴스데스크 센터               │     │  펀드메신저 (fundmessage)      │
│  (F:/newsdesk, 로컬)          │     │  (Docker, 서버)               │
│                              │     │                              │
│  ┌─ 뉴스 수집 ────────────┐  │     │  ┌─ API ──────────────────┐  │
│  │ MarketAux (해외, 엔티티)│  │     │  │ 뉴스데스크 데이터 수신   │  │
│  │ 네이버 (국내)           │  │ ──▶ │  │ 증시 데이터 수집 (KIS)  │  │
│  │ CryptoCompare (크립토)  │  │     │  └───────────────────────┘  │
│  └─────────────────────────┘  │     │                              │
│                              │     │  ┌─ Frontend ─────────────┐  │
│  ┌─ 종목 커플링 ──────────┐  │     │  │ 지수 카드               │  │
│  │ 해외: MarketAux 엔티티  │  │     │  │ 섹터 히트맵             │  │
│  │   (ticker+match_score)  │  │     │  │ 종목 상세 패널           │  │
│  │ 국내: Ollama Qwen3 분석 │  │     │  └───────────────────────┘  │
│  └─────────────────────────┘  │     │                              │
│                              │     │                              │
│  비정기 수작업, 로컬 GPU      │     │                              │
└──────────────────────────────┘     └──────────────────────────────┘
```

---

## 2. 프론트엔드 레이아웃

### 2.1 전체 구성

```
┌──────────────────────────────────────────────────────┐
│ Header (64px)                                        │
├────────┬─────────────────────────────────────────────┤
│        │                                             │
│ Side   │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐          │
│ bar    │  │코스피│ │코스닥│ │나스닥│ │S&P  │          │
│ (256px)│  │카드  │ │카드  │ │카드  │ │500  │          │
│        │  └─────┘ └─────┘ └─────┘ └─────┘          │
│        │                                             │
│        │  ┌─ 섹터 히트맵 ───────────────────────┐   │
│        │  │ [코스피] [코스닥] 탭                   │   │
│        │  │                                       │   │
│        │  │  ┌───┐ ┌──────┐ ┌───┐ ┌────┐        │   │
│        │  │  │반도│ │자동차│ │바이│ │금융│        │   │
│        │  │  │체  │ │     │ │오  │ │   │        │   │
│        │  │  └───┘ └──────┘ └───┘ └────┘        │   │
│        │  │  ┌──┐ ┌──┐ ┌────────┐ ┌──┐          │   │
│        │  │  │에│ │화│ │IT서비스│ │건│          │   │
│        │  │  │너│ │학│ │       │ │설│          │   │
│        │  │  └──┘ └──┘ └────────┘ └──┘          │   │
│        │  └───────────────────────────────────────┘   │
│        │                                             │
└────────┴─────────────────────────────────────────────┘
```

### 2.2 지수 카드 (상단, 4개)

각 카드에 표시할 정보:
- 지수명 (코스피/코스닥/나스닥/S&P500)
- 현재 지수값
- 전일 대비 변동 (금액 + 퍼센트)
- 미니 차트 (당일 또는 최근 5일 추이)
- 등락 색상 (상승=빨강, 하락=파랑 — 한국식)

**클릭 시**: 사이드 패널에 장 요약 표시
- 거래량, 거래대금
- 상한가/하한가 종목 수
- 시장 전체 등락 비율
- AI 생성 장 요약 코멘트 (뉴스데스크 센터에서 생성)

### 2.3 섹터 히트맵

- **탭**: 코스피 / 코스닥
- **셀**: 업종(섹터)별 블록
  - 블록 크기: 시가총액 비중에 비례
  - 블록 색상: 등락률 기반 (빨강=상승, 파랑=하락, 회색=보합)
  - 블록 내 텍스트: 업종명 + 등락률
- **셀 클릭**: 해당 섹터 내 종목 목록 드릴다운
- **종목 클릭**: 종목 상세 패널 열기

참고: KIS API의 업종 코드 체계 활용 (코스피 ~30개 업종, 코스닥 ~20개 업종)

### 2.4 종목 상세 패널 (사이드 패널)

종목 클릭 시 우측 사이드 패널에 표시:

```
┌─ 종목 상세 패널 ─────────────────────────┐
│                                           │
│  삼성전자 (005930)                 [닫기]  │
│  ─────────────────────────────────────── │
│                                           │
│  ■ 종목 정보                              │
│  현재가: 72,300원 (+2.1%)                 │
│  시가총액: 431.5조                        │
│  PER: 12.3 | PBR: 1.2                    │
│  52주 최고/최저: 85,000 / 58,000          │
│                                           │
│  ■ 오늘 현황                              │
│  시가: 71,000 | 고가: 73,200              │
│  저가: 70,800 | 거래량: 12,345,678        │
│                                           │
│  ■ 관련 뉴스 (관련도순)                    │
│                                           │
│  [95%] 삼성전자, HBM3E 양산 본격화        │
│  한국경제 | 2026-02-19 09:30              │
│  엔비디아 차세대 GPU에 공급 확정...        │
│                                           │
│  [88%] 메모리 반도체 업황 회복 신호        │
│  매일경제 | 2026-02-19 08:15              │
│  DRAM 현물가 3주 연속 상승...             │
│                                           │
│  [72%] 미중 반도체 규제 완화 기대감        │
│  서울경제 | 2026-02-19 07:45              │
│  바이든 행정부, 반도체 수출 규제...        │
│                                           │
└───────────────────────────────────────────┘
```

- 뉴스 타래: 관련도 점수(%) 내림차순 정렬
- 각 뉴스: 제목 + 매체명 + 시간 + 요약 미리보기
- 뉴스 클릭: 원문 링크 새 탭

---

## 3. DB 스키마 설계

### 3.1 신규 테이블

기존 테이블(news_desks, raw_news)은 유지하고, 아래 4개 테이블을 추가한다.

#### market_stocks (종목 마스터)
```sql
CREATE TABLE market_stocks (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(20) NOT NULL,          -- 종목코드 (005930, AAPL 등)
    ticker_name VARCHAR(100) NOT NULL,    -- 종목명 (삼성전자, Apple 등)
    market VARCHAR(20) NOT NULL,          -- KOSPI, KOSDAQ, NASDAQ, SP500
    sector_code VARCHAR(20),              -- 업종코드 (KIS 업종코드)
    sector_name VARCHAR(100),             -- 업종명 (반도체, 자동차 등)
    market_cap BIGINT,                    -- 시가총액 (원)
    is_active BOOLEAN DEFAULT TRUE,       -- 상장 여부
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(ticker, market)
);

-- 인덱스
CREATE INDEX idx_market_stocks_market ON market_stocks(market);
CREATE INDEX idx_market_stocks_sector ON market_stocks(sector_code);
```

#### stock_daily_price (일별 시세)
```sql
CREATE TABLE stock_daily_price (
    id SERIAL PRIMARY KEY,
    stock_id INTEGER REFERENCES market_stocks(id),
    trade_date DATE NOT NULL,             -- 거래일
    open_price DECIMAL(15,2),             -- 시가
    high_price DECIMAL(15,2),             -- 고가
    low_price DECIMAL(15,2),              -- 저가
    close_price DECIMAL(15,2),            -- 종가
    volume BIGINT,                        -- 거래량
    trade_amount BIGINT,                  -- 거래대금
    change_rate DECIMAL(8,4),             -- 등락률 (%)
    market_cap BIGINT,                    -- 시가총액
    created_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(stock_id, trade_date)
);

-- 인덱스
CREATE INDEX idx_stock_daily_date ON stock_daily_price(trade_date);
CREATE INDEX idx_stock_daily_stock_date ON stock_daily_price(stock_id, trade_date);
```

#### stock_news (뉴스-종목 커플링 — N:M)
```sql
CREATE TABLE stock_news (
    id SERIAL PRIMARY KEY,
    news_id INTEGER REFERENCES raw_news(id),
    stock_id INTEGER REFERENCES market_stocks(id),
    relevance_score DECIMAL(5,2) NOT NULL, -- 관련도 점수 (0-100)
    coupling_reason TEXT,                   -- AI가 판단한 관련 이유
    coupled_by VARCHAR(50) DEFAULT 'ai',    -- 커플링 주체 (marketaux, qwen3, manual)
    coupled_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(news_id, stock_id)
);

-- 인덱스
CREATE INDEX idx_stock_news_stock ON stock_news(stock_id);
CREATE INDEX idx_stock_news_news ON stock_news(news_id);
CREATE INDEX idx_stock_news_relevance ON stock_news(relevance_score DESC);
```

#### market_summary (일별 장 요약)
```sql
CREATE TABLE market_summary (
    id SERIAL PRIMARY KEY,
    summary_date DATE NOT NULL,
    market VARCHAR(20) NOT NULL,           -- KOSPI, KOSDAQ, NASDAQ, SP500

    -- 지수 데이터
    index_value DECIMAL(15,2),             -- 지수값
    index_change DECIMAL(10,2),            -- 전일 대비 변동
    index_change_rate DECIMAL(8,4),        -- 등락률 (%)

    -- 시장 현황
    total_volume BIGINT,                   -- 총 거래량
    total_trade_amount BIGINT,             -- 총 거래대금
    advance_count INTEGER,                 -- 상승 종목 수
    decline_count INTEGER,                 -- 하락 종목 수
    unchanged_count INTEGER,               -- 보합 종목 수

    -- 업종별 등락 (JSON)
    sector_performance JSON,               -- [{sector_code, sector_name, change_rate}]

    -- AI 장 요약 (뉴스데스크 센터에서 생성)
    ai_summary TEXT,                       -- AI 생성 장 요약 코멘트

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(summary_date, market)
);

-- 인덱스
CREATE INDEX idx_market_summary_date ON market_summary(summary_date);
```

### 3.2 기존 raw_news 테이블 확장

```sql
-- 기존 필드 유지 + 아래 추가
ALTER TABLE raw_news ADD COLUMN media_name VARCHAR(100);     -- 매체명
ALTER TABLE raw_news ADD COLUMN full_content TEXT;            -- 본문 전문 (가능한 경우)
ALTER TABLE raw_news ADD COLUMN language VARCHAR(10);         -- ko, en
ALTER TABLE raw_news ADD COLUMN coupling_status VARCHAR(20)   -- uncoupled, coupled
    DEFAULT 'uncoupled';
```

### 3.3 ERD 관계

```
market_stocks ──< stock_daily_price    (1:N, 종목별 일별 시세)
market_stocks ──< stock_news           (1:N, 종목에 연결된 뉴스)
raw_news      ──< stock_news           (1:N, 뉴스에 연결된 종목)
market_summary (독립, 일별 장 요약)
```

---

## 4. 뉴스데스크 센터 (로컬 파이프라인)

### 4.1 위치 및 성격
- **프로젝트**: F:/newsdesk (기존 프로젝트 수정)
- **실행 환경**: 로컬 PC, GPU 활용
- **실행 방식**: 비정기 수작업 (서버 아님, 스케줄러 아님)
- **AI 모델**: Ollama Qwen3 (로컬 GPU) — 국내 뉴스 커플링 전용

### 4.2 기존 뉴스 수집 체계 (이미 구현됨)

뉴스데스크 센터에는 이미 3개 소스의 뉴스 수집기가 있다:

| 소스 | 대상 | 특징 | 일 수집량 |
|------|------|------|-----------|
| **MarketAux** | 해외 금융 뉴스 (영문) | **엔티티(ticker, match_score, sentiment) 자동 제공** | ~270건 (일 100요청 × 3건) |
| **네이버** | 국내 금융 뉴스 (한글) | 엔티티 없음, 제목+요약만 | ~800건 (8쿼리 × 100건) |
| **CryptoCompare** | 크립토 뉴스 (영문) | tags/categories만, 본문(body) 포함 | ~150건 |

핵심: **MarketAux가 이미 종목 커플링의 절반을 해결하고 있다.**

```python
# MarketAux가 반환하는 엔티티 구조 (news_collector.py)
entities = {
    "tickers": [{
        "symbol": "NVDA",           # 종목코드
        "name": "NVIDIA Corp",      # 종목명
        "type": "equity",           # equity, index, etf
        "industry": "Technology",   # 업종
        "sentiment": 0.72,          # 감성 점수 (-1 ~ 1)
        "match_score": 8.5,         # 관련도 (10점 만점)
    }],
    "industries": ["Technology", "Financial Services"]
}
```

RawNews 모델의 `entities` JSON 필드에 이미 저장되고 있음.

### 4.3 파이프라인

```
[1. 뉴스 수집] (기존 로직 활용)
     │
     ├─ MarketAux (해외) ──▶ entities 자동 포함
     ├─ 네이버 (국내) ──▶ entities 없음
     └─ CryptoCompare ──▶ tags만
     │
     ▼
[2. 종목 커플링] (소스별 분기)
     │
     ├─ MarketAux 뉴스 ──▶ entities에서 ticker + match_score 추출 (변환만)
     ├─ 네이버 뉴스 ──▶ Ollama Qwen3로 AI 커플링 (이 부분만 AI 필요)
     └─ CryptoCompare ──▶ tags 기반 매핑 또는 Qwen3
     │
     ▼
[3. fundmessage DB 업로드]
     ├─ raw_news (뉴스 원문)
     └─ stock_news (커플링 결과, 소스 무관 동일 포맷)
```

### 4.4 커플링 전략 (소스별)

#### A. MarketAux (해외) — 변환만 하면 됨

MarketAux 엔티티를 stock_news 포맷으로 변환:

```python
# match_score (10점 만점) → relevance_score (100점 만점) 변환
for ticker_info in news.entities["tickers"]:
    stock_news = {
        "ticker": ticker_info["symbol"],       # "NVDA"
        "market": "NASDAQ",                     # type/exchange 기반 판별
        "relevance_score": ticker_info["match_score"] * 10,  # 8.5 → 85
        "coupling_reason": f"{ticker_info['industry']} - {ticker_info['type']}",
        "coupled_by": "marketaux",
        "sentiment": ticker_info["sentiment"],
    }
```

- match_score 5 미만은 이미 수집 시점에서 필터됨 (news_collector.py:114)
- 추가 AI 처리 불필요, 단순 포맷 변환

#### B. 네이버 (국내) — Ollama Qwen3 필요

네이버 뉴스에는 엔티티 정보가 없으므로, Qwen3가 분석해야 한다.

```
입력: 뉴스 1건
  "삼성전자, HBM3E 엔비디아 품질 테스트 통과"

Qwen3 분석:
  - 삼성전자 (005930): 관련도 95%, 이유: "직접적 주체"
  - SK하이닉스 (000660): 관련도 78%, 이유: "HBM 경쟁사, 독점 체제 변화"
  - NVIDIA (NVDA): 관련도 72%, 이유: "HBM 수요처"
```

#### C. CryptoCompare — 추후 결정

tags/categories 기반 매핑 또는 Qwen3 분석. 크립토 종목 수가 제한적이므로 우선순위 낮음.

### 4.5 관련도 점수 기준 (통합)

소스 무관, stock_news에 저장되는 최종 점수 기준:

| 점수 | 의미 | MarketAux 환산 | Qwen3 기준 |
|------|------|----------------|-----------|
| 90-100 | 직접 언급/주체 | match_score 9-10 | 직접 언급 종목 |
| 70-89 | 밀접한 관련 | match_score 7-8.9 | 같은 산업/공급망 |
| 50-69 | 간접 관련 | match_score 5-6.9 | 간접 영향 |
| 0-49 | 저장하지 않음 | 수집 시 필터됨 | 관련도 낮음 |

**N:M 관계**: 하나의 뉴스가 여러 종목에 연결될 수 있고, 하나의 종목에 여러 뉴스가 연결됨.

**축적 후 방식 (클러스터 기반)**:
- 충분한 커플링 데이터가 쌓이면 (MarketAux + Qwen3 합산)
- 비슷한 종목에 연결되는 뉴스끼리 자동 클러스터링
- 클러스터 단위로 종목 그룹에 한꺼번에 연결

### 4.6 fundmessage DB 업로드

- 뉴스데스크 센터가 분석 완료된 데이터를 fundmessage API로 전송
- 전송 데이터: raw_news + stock_news (커플링 결과)
- MarketAux/Qwen3 구분 없이 동일한 stock_news 포맷으로 통합
- fundmessage 측 수신 API 필요 (섹션 7.2 참조)

### 4.7 AI 프롬프트 설계 (국내 뉴스 전용, Ollama Qwen3)

```
시스템 프롬프트:
  너는 금융 뉴스 분석 전문가다.
  주어진 한국 뉴스 기사를 읽고, 관련된 한국/해외 상장 종목을 식별하라.

  각 종목에 대해:
  1. 종목코드와 종목명
  2. 관련도 점수 (0-100)
  3. 관련 이유 (1문장)

  규칙:
  - 관련도 50 미만은 제외
  - 직접 언급된 종목은 90+
  - 같은 산업/공급망은 70-89
  - 간접 영향은 50-69
  - 최대 10개 종목까지

사용자 프롬프트:
  뉴스 제목: {title}
  뉴스 내용: {description}
  매체: 네이버 뉴스
  발행일: {pub_date}

출력 형식 (JSON):
  [
    {"ticker": "005930", "name": "삼성전자", "market": "KOSPI", "score": 95, "reason": "..."},
    {"ticker": "000660", "name": "SK하이닉스", "market": "KOSPI", "score": 78, "reason": "..."}
  ]
```

---

## 5. KIS API 연동 (증시 데이터 수집)

### 5.1 개요
- **API**: 한국투자증권 Open API
- **용도**: 코스피/코스닥 전 종목 시세 + 업종(섹터) 데이터
- **한도**: 초당 20건 (실전투자 기준)
- **종목 수**: 코스피 ~900개, 코스닥 ~1,600개

### 5.2 수집 대상

| 데이터 | API | 주기 |
|--------|-----|------|
| 종목 마스터 (종목코드, 종목명, 업종) | 종목 마스터 조회 | 일 1회 |
| 일별 시세 (OHLCV, 등락률) | 주식현재가 시세 | 장중/장후 |
| 업종별 등락률 | 업종별 주가조회 | 장후 1회 |
| 지수 (코스피/코스닥) | 국내주식 업종기간별시세 | 장중/장후 |
| 해외 지수 (나스닥/S&P500) | 해외주식 현재체결가 | 장후 1회 |

### 5.3 수집 전략

**코스피 전 종목 (~900개)**:
- 초당 20건 → 900종목 ÷ 20 = **~45초**
- 장 마감 후 1회 수집으로 충분

**코스닥 전 종목 (~1,600개)** (선택적):
- 초당 20건 → 1,600종목 ÷ 20 = **~80초**
- 필요 시 시가총액 상위 500개만 수집

**업종 데이터**:
- 코스피 ~30개 업종, 코스닥 ~20개 업종
- 1초면 수집 완료

### 5.4 fundmessage 백엔드 구현

```python
# backend/app/services/kis_service.py (신규)

class KISService:
    """한국투자증권 API 연동 서비스"""

    async def get_stock_master(self, market: str) -> list:
        """종목 마스터 조회 → market_stocks 테이블에 저장"""

    async def get_daily_prices(self, market: str, date: date) -> list:
        """전 종목 일별 시세 → stock_daily_price 테이블에 저장"""

    async def get_sector_performance(self, market: str) -> list:
        """업종별 등락률 → market_summary.sector_performance에 저장"""

    async def get_market_index(self, market: str) -> dict:
        """지수 조회 → market_summary에 저장"""
```

### 5.5 스케줄러

```python
# 장 마감 후 자동 수집 (KST 16:00 이후)
@scheduler.scheduled_job('cron', hour=16, minute=30, timezone='Asia/Seoul')
async def collect_daily_market_data():
    """일일 증시 데이터 수집"""
    # 1. 코스피/코스닥 지수
    # 2. 업종별 등락률
    # 3. 전 종목 시세 (코스피 → 코스닥 순)
    # 4. market_summary 생성
```

---

## 6. 데이터 플로우 (전체)

```
[매일 KST 16:30]
KIS API ──▶ fundmessage DB
  │           ├─ market_stocks (종목 마스터)
  │           ├─ stock_daily_price (일별 시세)
  │           └─ market_summary (장 요약)
  │
[비정기 수작업]
뉴스데스크 센터 (로컬) ──▶ fundmessage API
  │                          ├─ raw_news (뉴스 원문)
  │                          └─ stock_news (커플링 결과)
  │
  ├─ 뉴스 수집
  │    ├─ MarketAux (해외, 엔티티 포함)
  │    ├─ 네이버 (국내, 엔티티 없음)
  │    └─ CryptoCompare (크립토)
  │
  ├─ 종목 커플링
  │    ├─ MarketAux → entities에서 ticker+match_score 추출 (AI 불필요)
  │    └─ 네이버 → Ollama Qwen3 분석 (AI 필요)
  │
  └─ API로 업로드 (동일한 stock_news 포맷)

[사용자 접속]
펀드메신저 프론트엔드
  ├─ 지수 카드 ← market_summary
  ├─ 섹터 히트맵 ← stock_daily_price + market_stocks
  └─ 종목 패널 ← market_stocks + stock_daily_price + stock_news + raw_news
```

---

## 7. API 설계 (fundmessage 백엔드 추가)

### 7.1 증시 데이터 API

```
GET /api/newsdesk-v2/market-summary?date={date}
  → 4개 지수 카드 데이터

GET /api/newsdesk-v2/market-summary/{market}?date={date}
  → 특정 시장 장 요약 (클릭 시 상세)

GET /api/newsdesk-v2/heatmap/{market}?date={date}
  → 섹터 히트맵 데이터 (업종별 등락률 + 종목 목록)

GET /api/newsdesk-v2/stock/{ticker}?date={date}
  → 종목 상세 (종목정보 + 오늘 현황)

GET /api/newsdesk-v2/stock/{ticker}/news?date={date}&limit=20
  → 종목 관련 뉴스 타래 (관련도 점수순)
```

### 7.2 뉴스데스크 센터 업로드 API

```
POST /api/newsdesk-v2/upload/news
  → 뉴스 원문 일괄 업로드 (raw_news)
  Body: { news: [{title, description, link, pub_date, source, media_name}] }

POST /api/newsdesk-v2/upload/coupling
  → 뉴스-종목 커플링 결과 업로드 (stock_news)
  Body: { couplings: [{news_id, ticker, market, relevance_score, reason}] }

POST /api/newsdesk-v2/upload/market-summary
  → AI 장 요약 업로드
  Body: { date, market, ai_summary }
```

---

## 8. 구현 순서

### Phase 1: DB + 증시 데이터 기반
1. DB 스키마 설계 → Alembic 마이그레이션 생성
2. market_stocks, stock_daily_price, stock_news, market_summary 테이블 생성
3. KIS API 연동 서비스 구현 (kis_service.py)
4. 일일 증시 데이터 수집 스케줄러 구현
5. 종목 마스터 초기 데이터 수집

### Phase 2: 프론트엔드 (뉴스데스크 v2 페이지)
1. 지수 카드 4개 컴포넌트
2. 섹터 히트맵 컴포넌트
3. 종목 상세 사이드 패널
4. 뉴스 타래 표시 (관련도순)
5. 기존 뉴스데스크 페이지와 공존 (탭 또는 라우트 분리)

### Phase 3: 뉴스데스크 센터 수정 (F:/newsdesk)
1. MarketAux 엔티티 → stock_news 변환 로직 구현 (AI 불필요, 포맷 변환)
2. 네이버 뉴스용 Ollama Qwen3 커플링 프롬프트 설계 및 테스트
3. 기존 클러스터링 로직 → 종목 커플링 파이프라인으로 전환
4. fundmessage API 업로드 기능 구현
5. 수작업 실행 스크립트 (CLI)

### Phase 4: 통합 테스트
1. 뉴스데스크 센터에서 뉴스 수집 → 커플링 → 업로드
2. fundmessage에서 히트맵 + 종목 패널 표시
3. 데이터 정합성 확인

---

## 9. 기존 뉴스데스크와의 관계

- 기존 뉴스데스크(날짜 기반 브리핑)는 **당분간 유지**
- v2(종목 중심)는 별도 페이지/탭으로 추가
- 장기적으로 v2가 안정화되면 기존 뉴스데스크를 v2로 대체 검토
- 기존 테이블(news_desks, raw_news)은 그대로 유지, raw_news는 v2에서도 공유

---

## 10. 고려사항

| 항목 | 설명 |
|------|------|
| **KIS API 한도** | 초당 20건, 전 종목 수집 시 ~2분. 장중 실시간은 불필요 (장후 1회) |
| **해외 지수** | KIS 해외주식 API 또는 yfinance로 나스닥/S&P500 수집 |
| **뉴스데스크 센터 비정기성** | 서버가 아닌 수작업이므로, 뉴스가 없는 날도 존재. 프론트에서 "데이터 없음" 처리 필요 |
| **종목 마스터 관리** | 상장/상폐 변동 반영. 일 1회 마스터 갱신 |
| **MarketAux 무료 한도** | 일 100요청 × 3건 = ~270건. 유료 플랜 전환 시 수집량 확대 가능 |
| **커플링 정확도** | MarketAux 엔티티는 검증됨. Qwen3(국내 뉴스)는 초기 정확도 검증 필요. 수동 보정 기능도 고려 |
| **기존 Position과의 연결** | 기존 Position 테이블의 ticker와 market_stocks.ticker를 조인하여 팀 포지션 종목의 뉴스 우선 표시 가능 |
