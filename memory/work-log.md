# 작업 이력
> 최신이 위, 시간순 기록. 상세 내용은 solutions/ 참조.

---

## 2026-02-20 | 조직 레포 코드 푸시 완료
- **유형**: 🟢 배포/통합
- **요청**: Maverixxk/FundMassagenger 조직 레포에 Phase C 코드 + 대학교 기능 머지
- **작업 내용**:
  1. `claude/determined-yonath` 브랜치 PR #1 GitHub 머지 (대학교 관리 + 회원가입 학교/직책)
  2. Phase C 파이프라인 코드 12개 파일 복사 (신규 6 + 수정 6)
  3. 프론트엔드는 이미 최신 상태 확인 (별도 복사 불필요)
  4. 커밋 `5f7485c` 푸시 완료
- **최종 커밋 히스토리**: 5f7485c(Phase C) → 22ae2be(대학교 머지) → e31288a(Phase A+프론트)
- **클론 위치**: `C:/Users/lhhh0/Desktop/org-repo`

---

## 2026-02-20 | 뉴스데스크 파이프라인 Spring Boot 병합 완료 (8단계)
- **유형**: 🟢 신규 기능 (대규모 병합)
- **요청**: Python(F:/newsdesk) 뉴스데스크 파이프라인을 Spring Boot(F:/fundmessage/spring-backend)에 통합
- **작업 내용**:
  1. **Step 1**: AppProperties에 Cerebras/MarketAux/Naver 설정 3개 클래스 추가, application.yaml + .env 환경변수
  2. **Step 2**: CerebrasClient.java — WebClient 기반 Cerebras API 클라이언트 (429 재시도, 5xx 백오프, JSON 스키마 강제)
  3. **Step 3**: NewsCollectorService.java — MarketAux/CryptoCompare/Naver 3소스 뉴스 수집 (Python collector.py 포팅)
  4. **Step 4**: RewriterService.java — AI 뉴스 재작성 (10건 배치, 영→한/한→한 변환, originalTitle 보존)
  5. **Step 5**: CouplingService.java — AI 종목-뉴스 커플링 (incremental context, EMA 기반 점수, MarketStock findOrCreate)
  6. **Step 6**: MarketSummaryService.java — 시장별 AI 브리핑 생성 (top 15 종목 컨텍스트, themes/hot/cold sectors)
  7. **Step 7**: NewsDeskPipelineService.java — 4단계 오케스트레이터 (수집→재작성→커플링→요약) + @Async 지원
  8. **Step 7b**: Controller run-pipeline 엔드포인트 + RawNews 엔티티 확장 (originalTitle, rewritten)
  9. **Step 8**: Docker 빌드 성공 + 서비스 정상 기동 확인 (Health UP)
- **빌드 에러 수정**: NewsCollectorService `page` 변수 → `final int currentPage` (lambda effectively final)
- **신규 파일 6개**: CerebrasClient.java, NewsCollectorService.java, RewriterService.java, CouplingService.java, MarketSummaryService.java, NewsDeskPipelineService.java
- **수정 파일 6개**: AppProperties.java, application.yaml, .env, RawNews.java, StockNewsRepository.java, NewsDeskController.java, FundmessengerApplication.java
- **상태**: 빌드 성공, 서비스 기동 확인. 실제 파이프라인 실행 테스트는 미수행.

---

## 2026-02-20 | Spring Boot CouplingService.java 작성
- **유형**: 🟢 신규 기능
- **요청**: Python coupling_agent.py의 Spring Boot 포팅 — Cerebras AI를 활용한 뉴스-종목 커플링 서비스
- **작업 내용**:
  1. `CouplingService.java` 작성 — CerebrasClient, MarketStockRepository, StockNewsRepository, RawNewsRepository 주입
  2. `coupleAll(List<RawNews>)` 메서드: 배치(10건) 분할, incremental context 유지, 에러 시 배치 스킵
  3. `CouplingResult` inner record: totalCouplings, uniqueStocks
  4. `StockContext` inner class: tickerName, market, newsCount, totalScore, recentReasons(max 3)
  5. Incremental context: 상위 20개 종목 (newsCount DESC, totalScore DESC) 컨텍스트 문자열 생성
  6. DB persistence: MarketStock findOrCreate, StockNews 생성, RawNews.couplingStatus = "coupled"
  7. JSON schema: couplings[].stocks[].{ticker, ticker_name, market, score, reason} 구조
  8. Score < 30 필터링, 실패 배치는 couplingStatus = "failed" 마킹
- **영향 파일**: `spring-backend/backend/src/main/java/com/fundmessenger/newsdesk/service/CouplingService.java` (신규)
- **상태**: 완료

---

## 2026-02-20 | NewsCollectorService.java 작성 (Spring Boot 뉴스 수집)
- **유형**: 🟢 신규 기능
- **요청**: Python collector.py를 Spring Boot Java 서비스로 포팅
- **작업 내용**:
  1. `NewsCollectorService.java` 완성 — 3개 소스(MarketAux, CryptoCompare, Naver) 뉴스 수집
  2. WebClient.Builder 주입, AppProperties로 API 키 관리
  3. URL 기반 중복 제거 (HashSet), 소스별 try/catch 격리
  4. MarketAux: 페이지네이션 (limit=3, max 90 requests), 엔티티 추출 → JSONB keywords
  5. CryptoCompare: Unix timestamp 기반 3회 역방향 루프, 날짜 필터링
  6. Naver: 8개 쿼리, HTML 태그 제거, RFC 1123 날짜 파싱, 날짜 필터링
  7. `@Transactional collectAll(LocalDate)` → `rawNewsRepository.saveAll()` 일괄 저장
- **신규 파일**: `spring-backend/backend/src/main/java/com/fundmessenger/newsdesk/service/NewsCollectorService.java`
- **상태**: 완료

---

## 2026-02-20 | Spring Boot RewriterService.java 작성
- **유형**: 🟢 신규 기능
- **요청**: Python rewriter_agent.py의 Spring Boot 포팅 — Cerebras AI를 활용한 뉴스 기사 재작성 서비스
- **작업 내용**:
  1. `RewriterService.java` 작성 — CerebrasClient 주입, 배치 처리(10건), JSON 스키마 구조적 출력
  2. `rewriteAll(List<RawNews>)` 메서드: 배치 분할, 에러 시 배치 스킵 후 계속
  3. `processBatch()`: 프롬프트 생성 → Cerebras generate 호출 → 응답 파싱 → DB 업데이트
  4. `buildPrompt()`: 한국어 프롬프트 (ID/소스/제목/내용 300자 truncate)
  5. `buildJsonSchema()`: articles 배열 (id/title/summary) 스키마 맵 구성
  6. originalTitle 보존, rewritten 플래그 설정, error 키 체크
- **영향 파일**: `spring-backend/backend/src/main/java/com/fundmessenger/newsdesk/service/RewriterService.java` (신규)
- **참고**: RawNews 엔티티에 `originalTitle(String)`, `rewritten(Boolean)` 필드 추가 필요 (별도 작업)
- **상태**: 완료

---

## 2026-02-20: Cerebras 모델 비교 + 전체 파이프라인 테스트

### 모델 비교 (test_models.py)
- 사용 가능: llama3.1-8b, gpt-oss-120b (Qwen3/GLM은 접근 불가 404)
- GPT-OSS-120B 승리: 재작성 10/10, 커플링 정확
- config.py 기본 모델 → `gpt-oss-120b` 변경

### 전체 파이프라인 성공
- 재작성 487건 (0 실패), 커플링 471건 → 110종목, 시장 요약 5개
- 2배치 JSON 잘림 (max_tokens 이슈)
- 결과: `F:/newsdesk/output/2026-02-20/`

---

## 2026-02-20 | Cerebras 4개 모델 벤치마크 비교 리서치
- **유형**: 🔵 리서치
- **요청**: Cerebras Inference 플랫폼 4개 모델(Llama3.1-8B, GPT-OSS-120B, Qwen3-235B-A22B-Instruct-2507, ZAI GLM-4.7) 성능 비교
- **작업 내용**:
  1. 모델별 벤치마크 수집 (MMLU-Pro, AIME, GPQA, HumanEval, LiveCodeBench, IFEval, BFCL)
  2. 한국어 능력 비교 (Qwen3 > GLM-4.7 > GPT-OSS-120B >> Llama3.1-8B)
  3. JSON/구조적 출력 품질 비교
  4. 500K tok/day 비용 시뮬레이션 ($0.05~$1.25/day)
  5. 용도별 추천 (뉴스 재작성, 커플링, 구조적 출력, 비용효율)
- **핵심 결론**:
  - 한국어 금융 뉴스 재작성: **Qwen3-235B** 1순위 (119개 언어, KMMLU 평가 포함)
  - 종목-뉴스 커플링: **GPT-OSS-120B** (MMLU-Pro 90.0%, 가성비 최강)
  - JSON 출력: **GPT-OSS-120B** (네이티브 Structured Outputs, OpenAI 호환)
  - 비용효율: **Llama3.1-8B** ($0.05/day) or **GPT-OSS-120B** ($0.275/day)
- **상태**: 완료

---

## 2026-02-20 | Phase C: 뉴스데스크 센터 v2 코드 작성
- **유형**: 🟢 신규 기능 (전면 재설계)
- **요청**: 기존 클러스터링 기반 → 종목 커플링 기반으로 뉴스데스크 센터 전환
- **작업 내용**:
  1. **config.py**: Cerebras API 설정 추가 (API key, model, base URL, fundmessage URL)
  2. **cerebras_client.py**: OpenAI 호환 Cerebras API 클라이언트 (JSON 스키마, 재시도, rate limit)
  3. **coupling_agent.py**: MarketAux 엔티티 변환 + 네이버 AI 커플링 (10건 배치) + CryptoCompare 태그 매핑
  4. **technical_analysis_agent.py**: OHLCV 30일 → AI 기술적 분석 (시그널, 트렌드, 지지/저항)
  5. **market_summary_agent.py**: 커플링 데이터 기반 시장별 AI 브리핑 생성
  6. **scoring.py**: EMA 시간 감쇠 + min-max 정규화 (100 기준, 초과 허용)
  7. **upload_client.py**: fundmessage Spring Boot API 업로드 (뉴스/커플링/시장요약)
  8. **pipeline.py**: v2 오케스트레이터 (수집 → 커플링 → EMA → 요약 → 업로드)
  9. **api/pipeline.py**: Ollama → Cerebras 전환, PipelineRunRequest 추가
  10. **agents/__init__.py**: v2 에이전트 export 추가
- **영향 파일**: 10개 (신규 6, 수정 4)
- **Cerebras 모델**: `qwen-3-235b-a22b-instruct-2507` (1,400 tok/s, 무료 1M/일)
- **다음 단계**: Docker 빌드 검증 + 실제 데이터 테스트

---

## 2026-02-19 | 뉴스데스크 v2 UI 대규모 개선
- **유형**: 🔵 개선 (사용자 피드백 반영)
- **요청**: 사이드 패널 닫기 불가, 히트맵 로그 스케일, 뉴스 아코디언, AI 역할 상정, overflow 수정
- **작업 내용**:
  1. **히트맵 로그 스케일**: `Math.log(cap + 1)` 적용 → 시총 35x 차이를 2.4x로 시각적 압축
  2. **사이드 패널 닫기**: custom 타입에 직접 X 버튼 + `closePanel` 호출
  3. **사이드 패널 재설계**:
     - 당일 시세(숫자) → SVG 30일 가격 차트
     - 종목정보(시총/PER/PBR) → 종목 소개(회사 설명)
     - AI 기술적 분석 섹션 추가 (analysis.technical + signals badges)
  4. **뉴스 아코디언**: 클릭으로 펼치기/접기, expandedId state
  5. **관련도 점수**: % 제거, 100+ 빨간 배경, 관련도순 정렬
  6. **overflow 수정**: Layout.jsx `overflow-x-hidden` + `min-w-0`
  7. **목업 데이터 교체**: OHLCV 생성기, AI 분석 데이터, 종목 프로필, 다양한 관련도 점수
- **수정 파일**:
  - `frontend/src/pages/NewsDesk.jsx` (전체 재작성)
  - `frontend/src/services/newsdeskService.js` (목업 데이터 전면 교체)
  - `frontend/src/components/layout/Layout.jsx` (overflow 수정)
- **검증**: Playwright 스크린샷 — 히트맵, 사이드 패널 차트/AI분석/종목소개/뉴스 모두 확인
- **상태**: 완료

---

## 2026-02-19 | 뉴스데스크 v2 프론트엔드 구현 (Phase B)
- **유형**: 🟢 신규 기능
- **요청**: 뉴스데스크 v2 프론트엔드 구현 (목업 데이터 포함)
- **작업 내용**:
  1. `newsdeskService.js` 완전 재작성 — v2 API 서비스 + 목업 데이터 (4개 시장 지수, 브리핑, 히트맵, 종목뉴스)
  2. `NewsDesk.jsx` 완전 재작성 — v2 UI 컴포넌트:
     - `IndexCard`: 지수 카드 4개 (코스피/코스닥/NASDAQ/BTC)
     - `BriefingPanel`: 브리핑 패널 (요약 + 상승/하락 업종 + 거래통계)
     - `SectorHeatmap`: Finviz 스타일 트리맵 (ResizeObserver, 시총 비중 기반)
     - `StockDetailContent`: 사이드 패널 (시세 + 종목정보 + 뉴스 타래)
  3. 버그 수정: `openPanel` 호출 시그니처 (`positional args` → `{ type, data }` 객체)
  4. 버그 수정: `activeIndex` TDZ 에러 (선언 순서 이동)
  5. 시장명 전달 수정: 히트맵 stock에 activeIndex.name 추가
- **수정 파일**: `frontend/src/pages/NewsDesk.jsx`, `frontend/src/services/newsdeskService.js`
- **검증**: Playwright 테스트 — 4개 탭 전환 ✅, 브리핑 ✅, 히트맵 ✅, 사이드 패널 ✅
- **상태**: 완료 (목업 데이터, 실제 API 연동은 Phase C 이후)

---

## 2026-02-19 | Spring Boot Docker 빌드 + 실행 검증 완료
- **유형**: ⚙️ 환경 설정 + 검증
- **요청**: Java 21 설치 + docker-compose Spring Boot 전환 + 서비스 기동 + API 검증
- **작업 내용**:
  1. Java 21 Temurin 설치 (winget)
  2. docker-compose.yml FastAPI → Spring Boot 전환 (Dockerfile, .env 생성)
  3. Docker 빌드 성공, 3개 서비스 기동 (db/backend/frontend)
  4. Login API 500 에러 원인 분석 → bash `!` escape 문제 (코드 이상 없음)
  5. Health DOWN 원인 → Mail health indicator 비활성화 (`management.health.mail.enabled: false`)
  6. 핵심 API 검증: 로그인 ✅, /users/me ✅, /positions ✅ (5개 포지션 정상), Health UP ✅
- **수정 파일**: `application.yaml` (mail health 비활성화)
- **상태**: 완료

---

## 2026-02-19 | RTX 5090 기준 인프라 전략 문서 업데이트
- **유형**: 🔵 리서치 + 문서 업데이트
- **요청**: RTX 4090 → RTX 5090 기준 전환, H100 vs 소비자 GPU 분석, 500명 동시 요청 처리 분석
- **작업 내용**:
  1. RTX 5090 실측 벤치마크 수집 (RunPod, CloudRift, Hardware Corner)
  2. 다나와 기준 한국 실가격 반영 (520~680만원)
  3. Consumer GPU vs H100 비교 분석 (NVLink, VRAM, 가성비)
  4. 500명 동시 운용보고서 처리 계산 (4,500,000 토큰 → 8× RTX 5090 = 4.7분)
  5. 문서 전면 업데이트: 섹션 5(GPU 분석), 6(비용), 8(지원금), 9(결론), 부록 D
- **핵심 결론**:
  - RTX 5090은 RTX 4090 대비 1.7배 성능, 가격은 2배 → 4090보다 약간 비효율이나 32GB VRAM이 핵심
  - H100은 학습용. 추론만 하면 소비자 GPU가 가성비 3~5배
  - 8× RTX 5090 (서버 2대)로 500명 동시 처리 + 24시간 뉴스데스크 + ML 학습 모두 가능
  - 5천만원 예산: 빠듯하지만 가능. 1억: 여유롭게 확장
- **수정 파일**: `docs/INFRASTRUCTURE_AI_STRATEGY.md`
- **상태**: 완료

---

## 2026-02-19 | gpt-oss-120b 이상 성능 오픈소스 LLM 종합 비교 리서치
- **유형**: 🔵 리서치
- **요청**: gpt-oss-120b 이상 성능의 오픈소스/오픈웨이트 LLM 모델 종합 리서치
- **작업 내용**:
  1. gpt-oss-120b 벤치마크 성능 확인 (MMLU 90%, AIME'25 97.9%, GPQA 80.9%, TauBench 67.8%)
  2. 경쟁 모델 10종 비교: DeepSeek R1/V3, Qwen3-235B, Llama 4 Maverick/Scout, Mistral Large 3, GLM-4.5, Kimi K2, K-EXAONE, Gemma 3
  3. 각 모델별 파라미터/아키텍처/라이선스/컨텍스트/벤치마크/VRAM 정리
  4. 로컬 구동 하드웨어 요구사항 (RTX 4090 기준)
  5. 한국어 성능 비교 (Qwen3 > K-EXAONE > DeepSeek R1 > gpt-oss-120b 순)
- **핵심 발견**:
  - gpt-oss-120b: MoE 117B/5.1B active, Apache 2.0, RTX 4090 4장 구동 가능, MXFP4 양자화
  - RTX 4090 단일 구동 가능: Qwen3-30B-A3B(17.5GB), Llama 4 Scout 1.78bit(24GB), Gemma 3 27B
  - 한국어 최강: K-EXAONE-236B (LG AI Research, 한국어 특화 MoE)
  - 가성비 최강: gpt-oss-120b (5.1B active로 80GB GPU 1장 가능, Apache 2.0)
- **상태**: 완료

---

## 2026-02-19 | 인프라 & AI 전략 종합 리서치 문서 작성
- **유형**: 리서치 + 문서
- **요청**: 지원금 집행계획 수립을 위한 인프라/AI 전략 종합 리서치
- **작업 내용**:
  1. 프로젝트 비전 정리 (50개 대학, 1,500~2,000명, 투자 커뮤니티 플랫폼)
  2. 규모 분석 (DAU, 동시접속, 데이터량, 트래픽 추정)
  3. AI 워크로드 분석 (현재 3.1M tok/일 → 확장 10M tok/일)
  4. 인프라 3대 시나리오 비교 (API확장 vs 클라우드GPU vs 자체GPU)
  5. gpt-oss-120b 구동 분석 (MoE 117B/5.1B active, RTX 4090 × 4 가능)
  6. 비용 시뮬레이션 (API $30~75만/월 vs 자체 $35~70만/월 → 비슷한 비용에 압도적 가치)
  7. 사용자 데이터 분석 & 자체 투자모델 학습 설계
  8. 지원금 활용 전략 (5천만/1억 시나리오)
- **결론**: 하이브리드(클라우드VPS + 자체GPU RTX4090×4 코로케이션) 추천
- **신규 파일**: `docs/INFRASTRUCTURE_AI_STRATEGY.md`
- **주요 발견**: gpt-oss-120b는 Apache 2.0, MoE 5.1B active로 RTX4090 4장에서 구동 가능, o4-mini급 성능
- **상태**: 리서치 문서 완료, 의사결정 대기

---

## 2026-02-19 | GPU 서버 인프라 비용 종합 리서치
- **유형**: 리서치
- **요청**: 2026년 기준 GPU 하드웨어/클라우드/LLM 추론/파인튜닝/OpenAI API/한국 VPS 가격 조사
- **작업 내용**: 6개 카테고리(GPU 하드웨어, 클라우드 GPU, LLM 추론 성능, 파인튜닝 비용, OpenAI API, 한국 VPS) 종합 리서치
- **상태**: 완료

---

## 2026-02-19 | 사용자 매매 데이터 활용 투자 AI 모델 학습 종합 리서치
- **유형**: 🔵 리서치
- **요청**: 매매 데이터 기반 AI 분석/모델 학습에 대한 6개 영역 종합 리서치
- **작업 내용**:
  1. **AI 분석 유형 정리**: 매매 패턴 분류(5가지), 매매 습관 분석(6개 항목), 포트폴리오 리스크, 종목 추천(CF+CB+하이브리드), 성과 예측
  2. **데이터 규모 산정**: 2,000명 기준 연간 36,000 포지션/57,600 요청 추정, 모델별 최소/권장 데이터 크기 정리
  3. **기술 스택 비교**: XGBoost/LightGBM, LoRA(FinGPT), LSTM/Transformer, NCF 추천, RL(FinRL) 각각 장단점/적용 시나리오
  4. **GPU 요구사항**: 모델별 학습/추론 GPU 사양, VRAM 요구량, 클라우드 GPU 비용 ($0.30~0.75/hr)
  5. **실제 사례**: 토스증권 AI시그널, 알파스퀘어, FinGPT(14k stars), FinRL(12.9k stars), 5개 LLM 투자 실험
  6. **법적/윤리적**: 개인정보보호법, 자본시장법(투자자문업 5억, 유사투자자문업 신고), AI기본법(2026.1 시행), 금융AI 가이드라인 7대원칙
- **핵심 발견**:
  - 펀드메신저 현재 데이터 모델(Position, Request, Discussion)로 대부분의 AI 분석 가능
  - Phase 1(통계 분석)은 GPU 없이 즉시 가능, Phase 4(LLM 파인튜닝)는 RTX 4090급 필수
  - 종목 "추천"은 유사투자자문업 신고 필요 → "유사 종목 탐색 도구"로 포지셔닝 권장
  - QLoRA 7B 모델 학습 비용: 클라우드 GPU로 $2~4/회
- **상태**: 완료

---

## 2026-02-19 | Spring Boot Phase A 리팩토링 완료 (6 Steps)
- **유형**: 리팩토링 + 신규 기능
- **요청**: Spring Boot 프로젝트를 프론트엔드와 완전 호환되도록 완성
- **작업 내용**:
  1. **Step 1: WebSocket 메시지 포맷 수정** - FundWebSocketHandler.java의 `data` 필드 unwrap 로직 추가 (프론트엔드 `{type, data:{...}}` ↔ Spring Boot flat 포맷 호환)
  2. **Step 2: Stats API 경로 4개 수정** - `/user/` → `/users/`, `/ranking` → `/team-ranking`, `/assets/history` → `/asset-history?period=`, `/assets/{id}` → `/asset-snapshot/{date}`
  3. **Step 3: Price API candles 파라미터** - `interval` → `timeframe`, `count` → `limit`, `before` 파라미터 추가
  4. **Step 4: LocalDateTime → OffsetDateTime 통일** - 19개 파일 일괄 수정, KstUtil 확장
  5. **Step 5: 뉴스데스크 v2 엔티티 + API** - 4개 신규 엔티티(MarketStock, StockDailyPrice, StockNews, MarketSummary), 4개 레포지토리, NewsDeskV2Service, 4개 DTO, NewsDeskController에 v2 엔드포인트 9개 추가, RawNews v2 확장 필드 4개
  6. **Step 6: 코드 검증** - Java/Docker Desktop 미설치로 수동 코드 리뷰 (20개 파일, 컴파일 이슈 0건)
- **주요 발견**: 이전 분석("6개 기능 미구현")이 오류였음. 실제로는 ~95% 구현 완료 상태. API 경로/포맷 수정 + 뉴스데스크 v2만 필요.
- **신규 파일**: MarketStock.java, StockDailyPrice.java, StockNews.java, MarketSummary.java, MarketStockRepository.java, StockDailyPriceRepository.java, StockNewsRepository.java, MarketSummaryRepository.java, MarketStockResponse.java, StockNewsResponse.java, MarketSummaryResponse.java, NewsDeskUploadRequest.java, NewsDeskV2Service.java
- **수정 파일**: FundWebSocketHandler.java, StatsController.java, AssetService.java, PriceController.java, PriceService.java, KstUtil.java, RawNews.java, NewsDeskController.java, + 엔티티/서비스/DTO ~19개 (OffsetDateTime)
- **상태**: 코드 완료. 실제 빌드/실행은 Java 설치 후 검증 필요.

---

## 2026-02-19 | Spring Boot 리팩토링 분석 + 로드맵 확정
- **유형**: 리서치 + 기획
- **요청**: Spring Boot 프로젝트(친구 작업물) 분석 + 뉴스데스크 v2 포함 전체 로드맵 수립
- **작업 내용**:
  1. **Spring Boot 프로젝트 클론 및 분석**:
     - GitHub: Maverixxk/FundMassagenger → `spring-backend/` 폴더로 클론
     - Java 21, Spring Boot 3.5.10, Gradle 8.14.4
     - 핵심 기능 ~80% 포팅 완료 (인증, 포지션, 요청, 토론 등 10개 도메인)
     - 빠진 기능: 시세 API, 통계/랭킹, 매매계획, WebSocket 채팅, AI 실제 호출
     - 뉴스데스크: v1 엔티티만 (크롤링/AI생성은 제외 — 센터가 담당)
  2. **전체 로드맵 확정**:
     - Phase A: Spring Boot 완성 (빠진 기능 구현)
     - Phase B: 펀드메신저 프론트엔드 뉴스데스크 v2 페이지
     - Phase C: 뉴스데스크 센터(F:/newsdesk) 수정 + 로컬 AI 커플링
  3. **뉴스데스크 v2 설계 문서 수정**: MarketAux 엔티티 활용 반영
- **영향 파일**: `spring-backend/`(신규 클론), `docs/newsdesk-v2-design.md`(수정), `memory/`(갱신)
- **상태**: 로드맵 확정, Phase A 시작 대기

---

## 2026-02-19 | 뉴스데스크 v2 기획 + Talk to Figma MCP 설정
- **유형**: 기획 + ⚙️ 환경 설정
- **요청**: 뉴스데스크를 종목 중심 뉴스 인텔리전스로 재설계, Figma 연동
- **작업 내용**:
  1. **Talk to Figma MCP 연결**: Windows 환경에서 Claude Code ↔ Figma 연동
     - `cmd /c npx` 파싱 실패 → `cmd` + `/c` 분리 → `chmod` Windows 실패
     - 최종 해결: `node` + 빌드된 `server.js` 직접 실행 (55 tools 로드)
     - Figma에서 레이아웃 그리기 시도 → 속도/색상 문제로 중단
     - 사용자 요청으로 `.mcp.json` 삭제 (MCP 제거)
  2. **뉴스데스크 v2 방향 확정**:
     - 기존: 날짜 기반 클러스터링 뉴스 브리핑
     - 변경: 종목 중심 뉴스 인텔리전스 (지수카드 + 히트맵 + 종목-뉴스 커플링)
     - 뉴스데스크 센터: 로컬 비정기 수작업, Ollama Qwen3, N:M 커플링
     - 증시 데이터: KIS API (초당 20건, 코스피 ~900종목 ≈ 1분)
  3. **설계 문서 작성**: `docs/newsdesk-v2-design.md`
- **영향 파일**: `.mcp.json`(삭제), `memory/session-state.md`, `docs/newsdesk-v2-design.md`(신규)
- **상태**: 기획 완료, 구현 대기

---

## 2026-02-12 | PWA + Web Push 구현
- **유형**: 🟢 신규 기능
- **요청**: 앱으로 패키징 가능한지 + 알림 기능 사용 → PWA + Web Push 추천 후 구현
- **수정**:
  - `frontend/public/manifest.json`: PWA 매니페스트 (standalone, 테마 색상, SVG 아이콘)
  - `frontend/public/sw.js`: Service Worker (push 이벤트, notificationclick, 캐싱)
  - `frontend/public/icons/icon.svg`: FM 앱 아이콘
  - `frontend/index.html`: PWA 메타태그 + SW 등록 스크립트
  - `frontend/src/services/notificationService.js`: VAPID key 조회, Push 구독/해제, initPushNotifications
  - `frontend/src/context/AuthContext.jsx`: 로그인 시 Push 구독, initPushIfGranted
  - `backend/app/models/push_subscription.py`: PushSubscription 모델 (신규)
  - `backend/app/services/push_service.py`: subscribe/unsubscribe/send_push (신규)
  - `backend/app/api/notifications.py`: vapid-key, push/subscribe, push/unsubscribe 엔드포인트
  - `backend/app/services/notification_service.py`: _send_web_push 메서드 (알림 생성 시 자동 발송)
  - `backend/app/main.py`: _ensure_vapid_keys (cryptography 라이브러리로 ECDSA P-256 키 생성)
  - `backend/app/config.py`: vapid_public_key, vapid_private_key, vapid_claims_email
  - `backend/requirements.txt`: pywebpush>=2.0.0
  - `docker-compose.yml`: VAPID 환경변수 매핑
  - `backend/.env`, `.env`: VAPID 키 영구 저장
- **문제 및 해결**:
  - `py_vapid` API 불일치 (`Vapid02` has no `public_key_urlsafe_base64`) → `cryptography` 직접 사용
  - `.env` VAPID 키가 컨테이너에 미전달 → docker-compose.yml environment 매핑 추가
- **검증**: Playwright - manifest 200, SW activated, VAPID API 정상, Login + Push API 정상
- **상태**: 완료 (로컬, 미푸시)

---

## 2026-02-12 | 자동로그인 개선
- **유형**: 🔴 버그 수정 + 🔵 개선
- **요청**: 자동로그인이 작동하지 않음, 브라우저 캐시 활용 요청
- **원인 분석**:
  - 유저 데이터 캐싱 없음 → 매번 API 호출 필요 (로딩 스피너 표시)
  - 동시 401 요청 시 각각 refresh 시도 → 충돌 가능
  - 네트워크 에러에도 토큰 삭제 → 불필요한 로그아웃
  - Refresh token 7일 만료, 회전 없음 → 세션 연장 불가
- **수정**:
  - `AuthContext.jsx`: 캐시된 유저로 즉시 복원, 401/403만 로그아웃
  - `api.js`: Refresh token 큐 (isRefreshing + failedQueue)
  - `authService.js`: cacheUser/getCachedUser + 로그인/조회 시 자동 캐싱
  - `auth.py`: refresh 시 새 refresh_token 발급 (토큰 회전)
  - `schemas/auth.py`: TokenRefreshResponse에 refresh_token 필드 추가
  - `config.py`: refresh_token_expire_days 7 → 30
- **검증**: Playwright - 만료 토큰으로 새로고침 → 자동 갱신 후 메인 페이지 유지
- **영향 파일**: AuthContext.jsx, api.js, authService.js, auth.py, schemas/auth.py, config.py
- **상태**: 완료 (로컬, 미푸시)

---

## 2026-02-12 | CloudType 배포 + DB 마이그레이션 + 뉴스데스크 시드
- **유형**: 🔵 배포 + 버그 수정
- **요청**: CloudType 프로덕션 배포 및 로컬 뉴스데스크 데이터 이전
- **수정**:
  - `backend/Dockerfile`: COPY 경로 수정 (CloudType 빌드 컨텍스트 = 프로젝트 루트)
  - `docker-compose.yml`: build context `.` + `dockerfile: backend/Dockerfile`
  - Dockerfile CMD: `alembic upgrade head && uvicorn` (마이그레이션 자동 실행)
  - `backend/app/main.py`: `_seed_newsdesk_data()` 시드 함수 추가 (startup에서 호출)
  - `backend/seed_data/newsdesk_seed.json`: 3개 뉴스데스크(2/8, 2/10, 2/12) + 1,599 raw_news
  - `backend/app/schemas/newsdesk.py`: 하위호환 (greed_score/category Optional, sentiment Any)
- **문제 및 해결**:
  - Dockerfile `requirements.txt not found` → `COPY backend/requirements.txt .`
  - `attendance_shields` 컬럼 없음 → `alembic stamp head` + 수동 ALTER TABLE
  - Pydantic ValidationError (greed_score required) → Optional로 변경
  - Pydantic ValidationError (sentiment dict vs string) → `Any` 타입으로 변경
  - 시드 함수가 모든 데이터 건너뜀 → per-date 체크로 수정
- **커밋**: aa86613, 48ff4e1, 74fba3f, ec0d4df
- **영향 파일**: Dockerfile, docker-compose.yml, main.py, newsdesk.py(스키마), newsdesk_seed.json
- **상태**: 코드 완료, 재배포 필요

---

## 2026-02-12 | 코드베이스 건강성 분석 (병렬 3개 에이전트)
- **유형**: 🔵 리서치
- **요청**: 사용자들이 사용하면서 오류가 생길 수 있는 부분 탐색
- **결과**:
  - 모델-DB 스키마: 불일치 없음 (OK)
  - 프론트-백엔드 API: 100% 매칭 (OK)
  - 에러 핸들링: 12개 취약점 발견
    - ai_service content None 체크, stats price exception, price_service stock.info None 등
- **상태**: 분석 완료, 수정 대기

---

## 2026-02-12 | Iter 4 뉴스데스크 프롬프트 근본 개선 + 크롤링 수정
- **유형**: 🔵 개선 + ⚙️ 설정
- **요청**: max_output_tokens + reasoning + 문단수 전환 + Few-shot 동시 적용
- **수정**:
  - `newsdesk_ai.py`: API 파라미터(max_output_tokens=32768, reasoning medium), SPEC 문단/문장수 전환, Few-shot 예시, 반절단 지시, QUALITY_CHECKLIST 업데이트
  - `docker-compose.yml`: `env_file: ./backend/.env` 추가 (NAVER/OPENAI 키 전달 누락 수정)
- **결과**: 칼럼 84%, 카드 92%, 종목 97% (Iter 3b 대비 +10~14%)
- **발견**: 해외 칼럼이 병목 (yfinance 30건 부족), 국내 칼럼은 2,100자 달성
- **영향 파일**: `backend/app/services/newsdesk_ai.py`, `docker-compose.yml`

---

## 2026-02-12 | 뉴스데스크 종합 진단 + Iter 3/3b + 의사결정서 verbosity 분리
- **유형**: 리서치 + 개선
- **작업 내용**:
  1. 의사결정서 `_call_ai()` verbosity 파라미터 추가, 의사결정서 "medium" 설정
  2. newsdesk-iteration-log.md 문서 생성 (Iter 0~2 기록)
  3. Iter 3: 프롬프트 5대 수정 → **퇴행** (오버슈트 하향이 역효과)
  4. Iter 3b: 부분 복원 (완성도우선+QUALITY_CHECKLIST+REQUIREMENTS만 유지)
  5. 종합 진단 리서치 (3개 에이전트 병렬 + 웹검색 + 토큰 분석)
- **핵심 발견**:
  - max_output_tokens 미설정 → 기본값 ~8,192에서 93% 사용 중 (근본 원인)
  - reasoning 토큰이 출력 토큰에서 차감됨
  - 단일 호출 11개 항목의 토큰 분산 + 출력 피로 (뒤쪽 항목 -26%)
  - 글자수 목표는 LLM이 못 지킴 → 문단/문장 수 목표가 효과적
  - Few-shot 예시가 길이 변동성 감소에 가장 효과적
- **영향 파일**: ai_service.py, newsdesk_ai.py
- **산출물**: newsdesk-iteration-log.md, newsdesk_iter3.json
- **다음 단계**: Iter 4 (max_output_tokens + reasoning + 문단수 + Few-shot)

---

## 2026-02-12 | 뉴스데스크 Iter 2 (verbosity 전환) + Iter 1 문서 상세 재작성
- **유형**: 개선 + 문서 재작성
- **계획**: `plans/parallel-finding-planet.md`
- **산출물**:
  1. `docs/ai-prompt-analysis/newsdesk_iter2.json` - Iter 2 뉴스데스크 결과 (신규)
  2. `docs/ai-prompt-analysis/comparison-report-mini-iter1.md` - Iter 1 상세 비교 분석 (재작성, 1,160줄)
  3. `docs/ai-prompt-analysis/prompting-methodology.md` - 섹션 2.7 JSON 후처리 전략 추가
- **작업 내용**:
  - **Iter 2**: newsdesk_ai.py에서 response_format 제거 → 텍스트 출력 + `_extract_json()` 3단계 파싱
  - **Iter 2 테스트**: Docker 빌드 → 2/8 raw_news로 뉴스데스크 생성 → JSON 파싱 성공
  - **문서 재작성**: comparison-report-mini-iter1.md를 N.1~N.7 구조로 전면 재작성 (176줄 → 1,160줄)
    - 모든 AI 출력 전문 `<details>` 태그로 포함
    - 모든 Iter 1 프롬프트(시스템+사용자) `<details>` 태그로 포함
    - Iter 1 vs Claude Code, Iter 1 vs Iter 0 비교 테이블
    - 부록 A(변경 상세), B(전체 비교표), C(Iter 2 결과)
  - **방법론**: prompting-methodology.md에 섹션 2.7 추가 (JSON 후처리 전략)
- **Iter 2 결과**:
  - 칼럼: 1,558 → **1,667자** (+7%)
  - 뉴스카드: 638 → **679자** (+6%)
  - 주목종목: 584 → **711자** (+22%, 퇴행 회복!)
- **핵심 교훈**:
  - response_format 없이 텍스트 출력 → JSON 추출이 가능 (3단계 파싱)
  - verbosity=high가 뉴스데스크에도 효과 (특히 주목종목 퇴행 회복)
  - 상세 문서는 데이터 전문 포함이 핵심 (사용자가 직접 읽고 차이를 느낄 수 있도록)
- **비용**: ~$0.08 (1회 뉴스데스크 호출)
- **영향 파일**: newsdesk_ai.py, comparison-report-mini-iter1.md, prompting-methodology.md
- **상태**: 완료

---

## 2026-02-10 | AI 프롬프트 엔지니어링 개선 (Iter 1)
- **유형**: 개선 + API 마이그레이션 + 문서화
- **계획**: `plans/parallel-finding-planet.md`
- **산출물**:
  1. `docs/ai-prompt-analysis/prompting-methodology.md` - GPT-5 프롬프팅 방법론 (신규)
  2. `docs/ai-prompt-analysis/comparison-report-mini-iter1.md` - Iter 1 비교 분석 (신규)
  3. `docs/ai-prompt-analysis/decision_note_iter1.txt` - 의사결정서 원문 (신규)
  4. `docs/ai-prompt-analysis/operation_report_iter1.txt` - 운용보고서 원문 (신규)
  5. `docs/ai-prompt-analysis/newsdesk_iter1.json` - 뉴스데스크 원문 (신규)
- **작업 내용**:
  - **Phase 0**: 프롬프팅 방법론 문서 작성 (verbosity, XML, 구조적 밀도, 역할 심화, 오버슈트)
  - **Phase 1**: ai_service.py Responses API 마이그레이션 + `_call_ai` 헬퍼 (fallback 포함)
  - **Phase 2**: 전체 프롬프트 XML 재구조화 (6개 프롬프트)
    - 의사결정서: "간결함" → "완성도 우선", `<DENSITY_REQUIREMENTS>` 추가
    - 운용보고서: 종합평가 밀도 강화 (3-4문장/항목)
    - 뉴스데스크: 오버슈트 타겟 (800→1200-1500, 2000→2500-3000)
  - **Phase 3**: Docker 빌드 + 테스트 3개 문서 유형
- **핵심 결과**:
  - 의사결정서: 2,497 → **4,294자** (+72%) — verbosity=high 극적 효과
  - 운용보고서: 2,094 → **3,058자** (+46%) — 목표 초과 달성
  - 칼럼: 1,341 → 1,558자 (+16%) — 개선이나 미달
  - 뉴스카드: 589 → 638자 (+8%) — 미미한 개선
  - 주목종목: 699 → 584자 (**-16%**) — 퇴행 (오버슈트 역효과)
- **핵심 교훈**:
  - verbosity=high는 게임체인저 (텍스트 출력에서 +46~72%)
  - 프롬프트만으로는 한계 (JSON 모드에서 최대 +16%)
  - 오버슈트가 역효과를 낼 수 있음 (주목종목 퇴행)
  - 의사결정서 과잉(153%) → 상한선 필요
- **비용**: ~$0.08-0.10 (3회 호출, 출력 증가로 비용 소폭 상승)
- **영향 파일**: ai_service.py, newsdesk_ai.py, config.py, requirements.txt, .env
- **상태**: 완료

---

## 2026-02-10 | gpt-5-mini 비교 분석 문서 작성
- **유형**: 문서 작성 + 모델 테스트
- **계획**: `plans/parallel-finding-planet.md`
- **산출물**: `docs/ai-prompt-analysis/comparison-report-mini.md`
- **작업 내용**:
  - backend/.env OPENAI_MODEL=gpt-5-mini 확인 (이전 세션에서 변경)
  - Docker 빌드 → 의사결정서/운용보고서/뉴스데스크 각 1회 생성
  - 5개 문서유형 × 7개 항목 프레임워크로 비교 분석
  - methodology.md 섹션 5.2 gpt-5-mini 결과 채움
- **핵심 발견**:
  - nano 3대 구조 문제(세션분리/3컬럼테이블/뉴스카드0개) **모두 해결**
  - 의사결정서: 2,497자(+29%), 클로드 코드 대비 89%
  - 뉴스카드: **6개** 정상 생성 (nano: 0개), 교차참조 풍부
  - 칼럼: 2개(국내+해외), 교차참조 "(관련 기사)" 다수
  - 길이 미달 잔존: 67-89% (nano 50-70% 대비 개선)
  - JSON 키 불일치 발견: stock_name vs name
- **비용**: ~$0.07 (3회 호출)
- **영향 파일**: comparison-report-mini.md(신규), prompt-review-methodology.md(5.2 업데이트)
- **상태**: 완료

---

## 2026-02-10 | AI 비교 분석 문서 작성
- **유형**: 문서 작성 + 프롬프트 개선
- **계획**: `plans/parallel-finding-planet.md`
- **산출물**:
  1. `docs/ai-prompt-analysis/comparison-report.md` - 비교 분석 보고서 (5개 문서유형, Iter 0+1)
  2. `docs/ai-prompt-analysis/prompt-review-methodology.md` - 프롬프트 검수 방법론
- **작업 내용**:
  - DB에서 소스 데이터(토론 32건, 포지션, 요청, raw_news 816건) + AI 결과물 수집
  - 클로드 코드 이상적 결과물 5개 작성 (의사결정서/운용보고서/뉴스카드/칼럼/주목종목)
  - Iteration 0 비교 분석 (5개 문서유형 각각 7개 항목 프레임워크)
  - 뉴스데스크 프롬프트 개선: 교차참조, 최소길이 강화, 볼드, 소제목 필수
  - gpt-5-nano + 816건 raw_news로 수동 재생성 1회 실행
  - Iteration 1 비교 분석 (뉴스 3개 문서)
- **핵심 발견**:
  - gpt-5-nano 출력 용량 한계: 프롬프트 강화 → 뉴스카드 0개(regression)
  - 칼럼 3개(모두 국내, 해외 누락), 수량/카테고리 지시 미준수
  - 주목종목은 소제목/볼드/시사점 등 구조적 개선 효과 확인
  - **결론: gpt-5-mini 전환 필수**
- **영향 파일**: newsdesk_ai.py(프롬프트 개선), comparison-report.md, prompt-review-methodology.md
- **상태**: 완료

---

## 2026-02-10 | AI 프롬프트 강화 (Phase 0~4)
- **유형**: 개선 + 버그 수정
- **계획**: `plans/parallel-finding-planet.md`
- **Phase 0**: Playwright UI로 테스트 데이터 생성
  - SK하이닉스 토론 3세션 (각 10-15메시지, 3명 참여, 차트 공유)
  - AI 의사결정서 3개 생성 및 저장
- **Phase 1**: AI 의사결정서 프롬프트 강화
  - `get_session_messages()`: 시스템 메시지 [시스템] 태그, KST HH:MM 시간, 차트 OHLCV JSON, 세션 헤더
  - `generate_decision_note()`: buy_plan/tp/sl JSON, 요청 이력 KST, total_buy_amount
  - 프롬프트 2회 반복: 차트 활용/다중 세션/메타 금지/출력 형식 원칙 추가
  - 분석: `docs/ai-prompt-analysis/decision-note.md`
- **Phase 2**: AI 운용보고서 프롬프트 강화
  - `collect_position_data()`: to_kst_str/fmt_price 전처리, holding_period 계산, 상태값 한글 변환
  - **핵심 교훈**: AI에게 변환을 시키지 말고, 전처리된 데이터를 제공하는 것이 효과적
  - 프롬프트: 7섹션 상세 형식, 절대 금지 규칙 강화
  - 분석: `docs/ai-prompt-analysis/operation-report.md`
- **Phase 3**: 뉴스데스크 키워드 감성 버그 + 프롬프트 개선
  - 버그 수정: KeywordBubble에 top_greed/top_fear 추가
  - AI 프롬프트: keywords JSON에 top_greed/top_fear 추가
  - 프론트엔드: keywordSentimentMap에서 k.top_greed/k.top_fear 사용
  - 모델: gpt-5-mini 하드코딩 → settings.openai_model
  - 길이 강화: 칼럼 2,000자+, 뉴스카드 800자+, 종목 800자+
  - 분석: `docs/ai-prompt-analysis/newsdesk.md`
- **영향 파일**: ai_service.py, newsdesk_ai.py, newsdesk.py(스키마), NewsDesk.jsx
- **상태**: 완료
- **참조**: `docs/ai-prompt-analysis/`, `memory/patterns/ai-prompt-patterns.md`

---

## 2026-02-10 | 수동 뉴스데스크 생성 기능 제거
- **유형**: 설정 변경 + 코드 제거
- **요청**: 수동 생성 불필요 → 스케줄러 자동 생성만 유지
- **수정**:
  - FallbackUI에서 "지금 생성하기", "다시 시도" 버튼 모두 제거
  - `handleGenerate` 함수, `generating` state 제거
  - `useAuth`, `useToast` 미사용 import 제거
  - `/newsdesk/generate` API 엔드포인트 제거
  - `newsdeskService.generateNewsDesk()` 함수 제거
  - FUTURE_FEATURES.md에 UX 플로우 + 유료 플랜 수익화 아이디어 추가
- **영향 파일**: NewsDesk.jsx, newsdesk.py, newsdeskService.js, FUTURE_FEATURES.md
- **상태**: 완료

---

## 2026-02-10 | 뉴스데스크 안정화 5건 (계획 기반)
- **유형**: 버그 수정 + 개선 + UX
- **계획**: `plans/parallel-finding-planet.md`
- **수정**:
  1. **getKSTToday() UTC 버그**: `.toISOString()` → `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' })`
  2. **DB 수동 복구**: 2/9 generating → failed (SQL UPDATE)
  3. **generating 타임아웃**: 10분 초과 시 자동 failed + fall through 재생성
  4. **스케줄러**: `collect_all` → `collect_for_morning_briefing`, `date.today()` → KST, CronTrigger timezone 추가
  5. **재시도 로직**: ready 차단, failed 재시도 허용 (최대 3회), 전체 플로우 동일 실행
  6. **6시 이전 안내 UI**: 일출 그라데이션 + SVG + 팀장 생성 버튼 (frontend-design)
- **영향 파일**: formatters.js, newsdesk.py, scheduler.py, NewsDesk.jsx, index.css
- **상태**: 완료
- **참조**: `solutions/2026-02-10-kst-timezone-bug.md`, `solutions/2026-02-10-generating-stuck.md`, `patterns/kst-timezone.md`

---

## 2026-02-10 | 뉴스데스크 달력 버그 수정 3건
- **유형**: 버그 수정
- **요청**: 초록점 미표시, 달력 잘림, 에러 메시지 수정
- **수정**:
  - history 데이터 파싱 수정: `data` → `data.items`, `h.date` → `h.publish_date`
  - history 조회 범위 7일 → 30일 확장
  - 선택된 날짜에도 초록점 표시 (흰색으로)
  - 달력 위치: `left-1/2 -translate-x-1/2` → `right-0` (잘림 방지)
  - 백엔드 에러 메시지: "이미 생성되었습니다" → "생성 요청 횟수를 모두 사용하였습니다"
- **영향 파일**: NewsDesk.jsx, newsdesk.py
- **상태**: 완료

---

## 2026-02-10 | 뉴스데스크 미니 달력 구현
- **유형**: 기능 추가
- **요청**: DatePicker를 미니 달력으로 교체
- **수정**:
  - MiniCalendarPicker 컴포넌트 구현 (월/년 네비게이션, 7열 그리드)
  - 뉴스데스크 존재 날짜: 초록색 점 표시
  - 오늘 날짜: 파란 테두리 강조
  - 미래 날짜: 비활성화 (클릭 불가)
  - 7일 이전 날짜: 회색 표시 (생성 불가)
  - 범례 추가 (존재/생성 불가/오늘)
- **영향 파일**: NewsDesk.jsx
- **상태**: 완료

## 2026-02-10 | 뉴스데스크 날짜/토스트/7일 제한 수정
- **유형**: 버그 수정 + 개선
- **요청**: KST 6시 분기, 토스트 중복, 7일 제한
- **수정**:
  - formatters.js: `getEffectiveNewsDeskDate()`, `getKSTToday()` 추가
  - NewsDesk.jsx: 초기값에 getEffectiveNewsDeskDate() 사용, toast.info 제거
  - newsdesk.py: 7일 이전 생성 요청 거부, 에러 메시지에서 "오늘" 제거
- **영향 파일**: formatters.js, NewsDesk.jsx, newsdesk.py
- **상태**: 완료

---

## 2026-02-10 | 뉴스데스크 UI 수정
- **유형**: 버그 수정 + 개선
- **요청**: 새로고침 버튼 제거, 날짜 클릭 시 크래시 수정
- **수정**:
  - 새로고침 버튼 제거 (의도하지 않은 기능)
  - DatePicker history.map 에러 수정 (Array.isArray 체크 추가)
- **영향 파일**: NewsDesk.jsx
- **상태**: 완료

---

## 2026-02-10 | 캔들차트 과거 데이터 로딩 수정
- **유형**: 버그 수정
- **요청**: 차트 스크롤 시 빈 공간 발생, 과거 데이터 로딩 불안정
- **수정**: StockChart.jsx - 선제적 데이터 로딩, 보이는 영역 기반 로딩
- **영향 파일**: StockChart.jsx, ChartShareModal.jsx
- **상태**: 완료

## 2026-02-10 | 차트 Y축 음수값 및 초기 캔들 수 조정
- **유형**: 버그 수정
- **수정**: Y축 음수값 표시, 초기 캔들 수 줄임
- **상태**: 완료

## 2026-02-07 | 대시보드 팀 정보 탭 + 통계 페이지 정리
- **유형**: 기능 개선
- **내용**: 대시보드에 팀 정보 탭 추가, 통계 페이지 팀원/리더보드 탭 제거
- **영향 파일**: Dashboard.jsx, Stats.jsx
- **상태**: 완료

## 2026-02-07 | 팀원 출석률 통계 추가
- **유형**: 기능 추가
- **상태**: 완료
