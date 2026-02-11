# 작업 이력
> 최신이 위, 시간순 기록. 상세 내용은 solutions/ 참조.

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
