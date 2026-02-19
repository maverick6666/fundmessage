# 현재 세션 상태
> 마지막 업데이트: 2026-02-19 (뉴스데스크 v2 UI 대규모 개선 완료)

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

### Phase C: 뉴스데스크 센터 (F:/newsdesk) 대폭 수정
- 기존 클러스터링 → 종목 커플링으로 전환
- MarketAux 엔티티 변환 (해외, AI 불필요) + 네이버 뉴스 Qwen3 분석 (국내)
- fundmessage API로 업로드

## Spring Boot 프로젝트 정보
- **위치**: `F:/fundmessage/spring-backend/`
- **GitHub**: https://github.com/Maverixxk/FundMassagenger.git
- **스택**: Java 21, Spring Boot 3.5.10, Gradle 8.14.4, PostgreSQL
- **구현 완료**: 인증, 포지션, 요청, 토론, 의사결정, 알림, 출석, 팀칼럼, 댓글, 감사로그, 매매계획, 통계/랭킹, AI호출(OpenAI), 시세(Yahoo+Binance), WebSocket, 리포트, 업로드, 뉴스데스크 v1+v2
- **인프라**: JWT(JJWT), JSONB(hypersistence-utils), Web Push(VAPID), CORS, KstUtil

## 설계 문서
- `docs/newsdesk-v2-design.md` ✅ (2026-02-19)
- `docs/NEWSDESK_CENTER_PROPOSAL.md` (참조용)

## 현재 작업 목록 (2026-02-19 사용자 요청)
- [x] 🔵 [리서치] 사용자 매매 데이터 활용 투자 AI 모델 학습 종합 리서치
- [x] 🔵 [리서치] GPU 서버 인프라 비용 종합 리서치 (하드웨어/클라우드/LLM추론/파인튜닝/OpenAI API/한국VPS)
- [x] 🔵 [문서] 인프라 & AI 전략 종합 리서치 문서 작성 → `docs/INFRASTRUCTURE_AI_STRATEGY.md`
- [x] 🔵 [리서치] gpt-oss-120b 이상 성능 오픈소스 LLM 종합 비교 리서치 (2025-2026)
- [x] 🟢 [기능] 뉴스데스크 v2 프론트엔드 구현 (Phase B)
- [x] 🔵 [개선] 히트맵 로그 스케일, 사이드 패널 닫기, 뉴스 아코디언, overflow 수정
- [x] 🔵 [개선] 사이드 패널 재설계 (OHLCV 차트 + AI 기술적 분석 + 종목 소개)

## 프로젝트 비전 (확정)
- **대상**: 전국 50개 대학 투자동아리, 1,500~2,000명
- **성격**: 투자 커뮤니티 정보교환 플랫폼
- **AI 전략**: 자체 GPU 서버 + gpt-oss-120b (Apache 2.0) → OpenAI API 대체
- **뉴스데스크**: 24시간 자동 운영 서비스 (서버 상시 가동)
- **확장 AI**: 매매습관 분석, 개인화 종목추천, 자체 투자모델 학습
- **지원금**: 5천만~1억 (정부 지원금)

## 알려진 이슈
- Spring Boot 테스트 코드 0개
- Stats overview API 500 에러 (경로 또는 내부 로직 이슈)
- **🔴 텍스트 overflow (불구대천의 원수)**: Layout.jsx 1차 수정만 완료. 프로젝트 전반 개별 페이지 전수 점검 + 수정 필요. 뷰포트 축소 시 텍스트가 줄바꿈 반복 후 삐져나오는 문제가 여러 페이지에서 반복 발생.

## 사용자 아이디어 (Phase C 검토 대상)
- **EMA 기반 관련도 점수 정규화**: 클러스터링에 EMA 개념 적용, min-max 정규화로 100점 기준
- **로컬 AI 역할**: OHLCV 차트 분석 → 기술적 분석 생성, 뉴스-종목 커플링 관련도 점수 산출
