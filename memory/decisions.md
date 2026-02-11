# 기술적 결정 & 환경 변경 이력

---

## 2026-02-12 | docker-compose.yml env_file 추가
- **Before**: backend 환경변수를 docker-compose.yml environment에 개별 나열 (NAVER/OPENAI 누락)
- **After**: `env_file: ./backend/.env` 추가하여 모든 환경변수 자동 전달
- **이유**: NAVER_CLIENT_ID/SECRET, OPENAI_API_KEY 등이 Docker에 전달 안 됨 발견

---

## 2026-02-12 | Iter 4: 뉴스데스크 4가지 근본 개선 적용
- **Before**: 글자수 목표, max_output_tokens 미설정, reasoning 기본값
- **After**: max_output_tokens=32768, reasoning medium, 문단/문장수 전환, Few-shot 예시
- **이유**: 토큰 예산 93% 소진(천장 효과), LLM 글자수 카운트 불가, stochastic 변동 감소
- **결과**: 칼럼 84%, 카드 92%, 종목 97% → Iter 3b 대비 +10~14% 개선

---

## 2026-02-12 | 의사결정서 verbosity medium 분리
- **Before**: 의사결정서/운용보고서 모두 settings.openai_verbosity (high) 사용
- **After**: `_call_ai(verbosity="medium")` 의사결정서용, 운용보고서는 기본값 high 유지
- **이유**: 의사결정서 153% 과잉 길이 문제 해결

---

## 2026-02-12 | 뉴스데스크 분할 생성은 최후 보루 (사용자 결정)
- **Before**: 분할 생성(4호출)을 1순위 개선안으로 제안
- **After**: 분할 생성 보류, 먼저 max_output_tokens + reasoning + 문단수 전환 + Few-shot으로 효과 확인
- **이유**: 사용자가 단일 호출 최적화를 선호. 분할은 효과 부족 시에만 진행.

---

## 2026-02-12 | 운용보고서 이모지 미사용 확정 (사용자 선호)
- **Before**: 이모지(🟢/⚠️/✅) 미사용을 "잔여 문제"로 분류
- **After**: 이모지 없는 게 더 낫다 → 잔여 문제에서 제거, 프롬프트에 이모지 지시 추가하지 않음
- **이유**: 사용자 선호. 프로페셔널한 문서 스타일

---

## 2026-02-10 | AI 서비스 Chat Completions → Responses API 마이그레이션
- **Before**: 의사결정서/운용보고서 모두 `client.chat.completions.create()` 사용
- **After**: `client.responses.create()` + `text={"verbosity": "high"}` 사용 (fallback 포함)
- **이유**: GPT-5 verbosity 파라미터로 길이/깊이 제어. Chat Completions에서는 미지원
- **영향**:
  - ai_service.py에 `_call_ai()` 헬퍼 추가 (Responses API → Chat Completions fallback)
  - config.py에 `openai_verbosity` 설정 추가
  - requirements.txt `openai>=1.60.0` (Responses API 지원)
- **제약**: newsdesk_ai.py는 response_format(JSON 모드)과 verbosity 충돌로 마이그레이션 불가
- **결과**: 의사결정서 +72%, 운용보고서 +46% 길이 증가

---

## 2026-02 | 로컬 개발 환경으로 전환
- **Before**: 클라우드타입(Backend) + Vercel(Frontend) 배포하며 개발
- **After**: Docker 로컬 환경에서 개발, 배포는 나중에
- **이유**: 배포에 시간이 너무 걸려 개발 속도 저하
- **영향**: 모든 빌드/테스트는 `docker-compose up -d --build`로 진행

## 2026-02 | OpenAI 모델 정책
- 프로덕션: `gpt-5-mini`
- 테스트/개발: `gpt-5-nano` (비용 절감)
- 변경 이유: 개발 중 불필요한 API 비용 방지

## 2026-02-10 | 테스트 모델 gpt-5-nano → gpt-5-mini 전환
- **Before**: backend/.env OPENAI_MODEL=gpt-5-nano
- **After**: backend/.env OPENAI_MODEL=gpt-5-mini
- **이유**: nano 테스트 완료, 비교 분석 결과 nano의 한계 확인 (출력 용량, 구조 준수, 길이 미달). mini 테스트 진행.
- **비용 영향**: 호출당 ~$0.001 → ~$0.05 (약 40배 증가), 하루 ~$0.05-0.08

## 2026-02 | 시스템 알림 사용 금지
- **Before**: window.alert(), window.confirm() 사용
- **After**: ConfirmModal 컴포넌트 + toast 알림
- **이유**: UX 품질 향상, 일관된 디자인

## 2026-02 | 프론트엔드 작업 규칙
- 프론트엔드 UI/스타일 변경은 반드시 frontend-design 스킬을 통해서만 작업
- 직접 코드 수정 금지

## 2026-02-10 | 수동 뉴스데스크 생성 기능 제거
- **Before**: 팀장이 수동으로 뉴스데스크 생성 가능 (`/newsdesk/generate` API, "지금 생성하기" 버튼)
- **After**: 뉴스데스크는 스케줄러(KST 05:30)로만 자동 생성. 수동 생성 불가.
- **이유**:
  - 자동 갱신이 있으므로 수동 요청 불필요
  - 7일 제한 때문에 과거 생성도 실질적 의미 없음
  - 수동 요청 관련 버그/에러 처리 복잡성 제거
- **미래 계획**:
  - 다른 팀이 생성한 뉴스데스크 열람(공유 캐시) → 멀티테넌시 이후
  - 과거 뉴스데스크 열람 → 유료 플랜으로 수익화 가능

## 2026-02 | 시간 기준 KST
- 모든 시간 관련 로직은 한국 시간(KST, UTC+9) 기준
- 일일 제한 리셋, 출석 체크 등 모두 KST 자정 기준
