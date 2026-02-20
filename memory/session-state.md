# 현재 세션 상태
> 마지막 업데이트: 2026-02-20 (Phase C 뉴스데스크 센터 v2 코드 작성 완료)

## 개발 환경
- **로컬 개발** (Docker 사용)
- 프론트엔드: React + Vite (localhost:80 via Docker nginx)
- **백엔드: Spring Boot** (`spring-backend/`) — FastAPI 폐기, Spring Boot 단독
- FastAPI는 더 이상 사용하지 않음
- DB: PostgreSQL (Docker 로컬)
- 빌드/테스트: `docker-compose up -d --build`
- **푸쉬 규칙**: 사용자가 지시할 때만 git push (로컬 작업 우선)
- **PWA 지원**: manifest.json + sw.js + Web Push (VAPID)

## 전체 로드맵 (3단계)

### Phase A: Spring Boot 리팩토링 완성 ✅ 완료
- [x] Step 1: WebSocket 메시지 포맷 수정 (data 필드 unwrap)
- [x] Step 2: Stats API 경로 불일치 4개 수정
- [x] Step 3: Price API candles 파라미터 수정
- [x] Step 4: LocalDateTime → OffsetDateTime 통일 (~19개 파일)
- [x] Step 5: 뉴스데스크 v2 엔티티 + API (4개 엔티티, 4개 레포, 서비스, DTO, 컨트롤러)
- [x] Step 6: Docker 빌드 + 실행 검증 완료 (2026-02-19)
  - Java 21 Temurin 설치, docker-compose Spring Boot 전환
  - 3개 서비스 정상 기동 (db/backend/frontend)
  - 로그인 API ✅, 포지션 API ✅, 사용자 API ✅, Health UP ✅
  - Mail health indicator 비활성화 (SMTP 미설정)

**주요 발견**: 이전 분석에서 "6개 기능 미구현"이라 했으나, 재확인 결과 거의 모든 기능이 이미 구현되어 있었음 (~95% 완료). 실제 필요했던 작업은 경로/포맷 수정 + 뉴스데스크 v2 신규.

### Phase B: 펀드메신저 프론트엔드 — 뉴스데스크 v2 페이지 ✅ 완료
- [x] 지수 카드 4개 (코스피/코스닥/NASDAQ/BTC)
- [x] 브리핑 패널 (요약 + 상승/하락 업종 + 거래통계)
- [x] 섹터 히트맵 (Finviz 스타일 트리맵, 4개 시장 탭 전환, **로그 스케일**)
- [x] 종목 상세 사이드 패널 (**차트 + AI 기술적 분석 + 종목 소개 + 아코디언 뉴스**)
- [x] 사이드 패널 닫기 버튼 + ESC 지원
- [x] 뉴스 관련도순 정렬 (100+ 빨간 배지, % 없이 숫자만)
- [x] 프로젝트 전반 텍스트 overflow 수정 (Layout.jsx overflow-x-hidden + min-w-0)
- [x] 목업 데이터 포함 (`USE_MOCK = true`, OHLCV + AI 분석 + 프로필)
- 실제 API 연동은 Phase C (뉴스데스크 센터) 이후

### Phase C: 뉴스데스크 센터 (F:/newsdesk) 대폭 수정 — 🔵 코드 작성 완료
- [x] Step 1: config.py Cerebras 설정 + cerebras_client.py 작성
- [x] Step 2: coupling_agent.py (종목 커플링: MarketAux 변환 + 네이버 AI + 크립토 태그)
- [x] Step 3: technical_analysis_agent.py (OHLCV → AI 기술적 분석)
- [x] Step 4: market_summary_agent.py (시장별 AI 브리핑) + scoring.py (EMA 점수)
- [x] Step 5: upload_client.py (fundmessage API 업로드) + pipeline.py 재설계
- [ ] Step 6: Docker 빌드 + 실행 검증 (미착수)
- [ ] Step 7: 프론트엔드 `USE_MOCK = false` 전환 + 실제 데이터 연동 (미착수)

## Spring Boot 프로젝트 정보
- **위치**: `F:/fundmessage/spring-backend/`
- **GitHub**: https://github.com/Maverixxk/FundMassagenger.git
- **스택**: Java 21, Spring Boot 3.5.10, Gradle 8.14.4, PostgreSQL
- **구현 완료**: 인증, 포지션, 요청, 토론, 의사결정, 알림, 출석, 팀칼럼, 댓글, 감사로그, 매매계획, 통계/랭킹, AI호출(OpenAI), 시세(Yahoo+Binance), WebSocket, 리포트, 업로드, 뉴스데스크 v1+v2
- **인프라**: JWT(JJWT), JSONB(hypersistence-utils), Web Push(VAPID), CORS, KstUtil

## 설계 문서
- `docs/newsdesk-v2-design.md` ✅ (2026-02-19)
- `docs/NEWSDESK_CENTER_PROPOSAL.md` (참조용)

## 현재 작업 목록 (2026-02-20 Phase C → Spring Boot 병합)
- [x] 🟢 [기능] 뉴스데스크 전면 재설계 (설계 수정 반영)
- [x] 🟢 [검증] 뉴스 수집 테스트 성공 (487건: MA29 + NV384 + CC74)
- [x] 🟢 [검증] Cerebras 모델 비교 완료 → GPT-OSS-120B 확정
- [x] 🟢 [검증] 전체 파이프라인 테스트 성공 (487건 재작성, 471 커플링, 5 시장요약)
- [x] 🟢 [기능] Spring Boot 병합 8단계 완료:
  - [x] Step 1: 설정 추가 (AppProperties + yaml + .env)
  - [x] Step 2: CerebrasClient.java
  - [x] Step 3: NewsCollectorService.java
  - [x] Step 4: RewriterService.java
  - [x] Step 5: CouplingService.java
  - [x] Step 6: MarketSummaryService.java
  - [x] Step 7: NewsDeskPipelineService.java + Controller + RawNews 확장
  - [x] Step 8: Docker 빌드 성공 + 서비스 기동 확인
- [ ] 🟡 [대기] 파이프라인 실제 실행 테스트 (POST /api/v1/newsdesk/v2/run-pipeline)
- [ ] 🟡 [대기] 프론트엔드 `USE_MOCK = false` 전환 + 실제 데이터 연동

## 최근 완료 (2026-02-20)
- [x] 🟢 조직 레포 푸시 완료 (5f7485c) — Phase C 12파일 + 대학교 PR 머지
- [x] 🟢 Spring Boot 뉴스데스크 파이프라인 병합 (8단계, 신규 6파일 + 수정 7파일)
- [x] 🔵 Cerebras 모델 비교 + 전체 파이프라인 검증
- [x] 🟢 Docker 빌드 + 서비스 기동 확인 (Health UP)

## 프로젝트 비전 (확정)
- **대상**: 전국 50개 대학 투자동아리, 1,500~2,000명
- **성격**: 투자 커뮤니티 정보교환 플랫폼
- **AI 전략**: Cerebras API + GPT-OSS-120B (확정) → 트래픽 증가 시 자체 GPU 서버 전환
- **뉴스데스크**: 24시간 자동 운영 서비스 (서버 상시 가동)
- **확장 AI**: 매매습관 분석, 개인화 종목추천, 자체 투자모델 학습
- **지원금**: 5천만~1억 (정부 지원금)

## 알려진 이슈
- Spring Boot 테스트 코드 0개
- Stats overview API 500 에러 (경로 또는 내부 로직 이슈)
- **🔴 텍스트 overflow (불구대천의 원수)**: Layout.jsx 1차 수정만 완료. 프로젝트 전반 개별 페이지 전수 점검 + 수정 필요. 뷰포트 축소 시 텍스트가 줄바꿈 반복 후 삐져나오는 문제가 여러 페이지에서 반복 발생.

## 설계 수정 사항 (2026-02-20 사용자 피드백)
- **소스별 차별 처리 폐기**: MarketAux 메타데이터 정확도 낮음 → 모든 소스 동일 AI 처리
- **뉴스 재작성 추가**: 저작권 우회 + 품질 통일
- **EMA = 코드 계산 아님**: 모델에게 기준으로 제공, 모델이 점수 직접 산출
- **Spring Boot 통합 검토**: Cerebras API 쓰면 별도 프로젝트 불필요 (추후 결정)
- **OpenAI API → Cerebras 통합**: 운용보고서/의사결정서도 전환 가능

## 뉴스데스크 센터 v2 파일 구조 (F:/newsdesk)
```
run.py                       # CLI 진입점 (python run.py)
backend/app/services/
├── cerebras_client.py       # Cerebras API (OpenAI 호환)
├── collector.py             # DB-free 뉴스 수집 (JSON 반환)
├── pipeline.py              # v2 파이프라인 (JSON 파일 출력)
└── agents/
    ├── rewriter_agent.py    # 뉴스 재작성 (저작권 우회)
    ├── coupling_agent.py    # 통일 AI 커플링 (incremental)
    └── market_summary_agent.py  # 시장별 AI 브리핑
output/YYYY-MM-DD/
├── 01_raw_news.json         # 수집 결과
├── 02_rewritten.json        # 재작성 결과
├── 03_coupled.json          # 커플링 결과
└── 04_market_summary.json   # 시장 요약
```
