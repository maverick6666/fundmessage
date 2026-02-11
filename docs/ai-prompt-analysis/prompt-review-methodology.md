# AI 프롬프트 검수 방법론

> **목적**: AI 모델이 생성하는 문서의 품질을 체계적으로 평가하고 프롬프트를 반복 개선하기 위한 재사용 가능한 프로세스 문서
>
> **최초 작성**: 2026-02-10 (gpt-5-nano 테스트 기반)
> **적용 대상**: 의사결정서, 운용보고서, 뉴스데스크 (뉴스카드/칼럼/주목종목)

---

## 1. 개요: 왜 프롬프트 검수가 필요한가

AI가 생성하는 문서는 프롬프트 설계, 입력 데이터 품질, 모델 능력이 복합적으로 결정한다. 단순히 "잘 써줘"로는 일관된 품질을 확보할 수 없으며, 체계적인 비교-분석-개선 사이클이 필요하다.

**이 문서의 가치:**
- 모델 전환 시 (예: gpt-5-nano → gpt-5-mini) 동일한 기준으로 평가 가능
- 새 문서 유형 추가 시 검수 프로세스 재사용
- 팀원 누구나 실행 가능한 표준화된 절차

---

## 2. 사전 준비

### 2.1 테스트 데이터 요구사항

| 문서 유형 | 최소 데이터 | 이상적 데이터 | 비고 |
|----------|----------|------------|------|
| 의사결정서 | 토론 1세션 (10+메시지) | 3세션 (30+메시지, 3명) | 차트 공유 포함 권장 |
| 운용보고서 | 포지션 1개 + 요청 1건 | 포지션 + 요청 3건 + 노트 3개 + 토론 3세션 | 매수/매도/토론 이력 다양할수록 좋음 |
| 뉴스데스크 | raw_news 50건+ | raw_news 500건+ (naver 90%+yfinance 10%) | 26건으로는 길이 미달 발생 확인됨 |

### 2.2 테스트 환경 설정

```bash
# 1. .env에서 테스트 모델 설정
OPENAI_MODEL=gpt-5-nano   # 또는 테스트 대상 모델

# 2. Docker 빌드 (코드 변경 반영 필수!)
docker-compose up -d --build

# 3. 비용 추적
# OpenAI 대시보드에서 현재 크레딧 기록: $___
```

> **주의**: `docker-compose restart`는 코드 변경을 반영하지 않음. 반드시 `up -d --build` 사용.

### 2.3 비용 추적 템플릿

| 시점 | 크레딧 잔액 | 비고 |
|------|-----------|------|
| 작업 시작 전 | $_____ | |
| 의사결정서 Iter 0 | $_____ | |
| 의사결정서 Iter N | $_____ | |
| 운용보고서 Iter 0 | $_____ | |
| 운용보고서 Iter N | $_____ | |
| 뉴스데스크 Iter 0 | $_____ | |
| 뉴스데스크 Iter N | $_____ | |
| 작업 완료 | $_____ | |

---

## 3. 검수 프로세스 (Step-by-Step)

### Step 1: 소스 데이터 수집

DB에서 AI에 전달되는 것과 동일한 소스 데이터를 추출한다.

**의사결정서 데이터:**
```sql
-- 토론 메시지 (discussion_id 변경)
SELECT m.id, u.username, m.content, m.message_type, m.chart_data, m.created_at
FROM messages m JOIN users u ON m.user_id = u.id
WHERE m.discussion_id = {DISCUSSION_ID}
ORDER BY m.created_at;

-- 포지션 정보
SELECT * FROM positions WHERE id = {POSITION_ID};

-- 요청 이력
SELECT r.*, u.username FROM requests r JOIN users u ON r.user_id = u.id
WHERE r.position_id = {POSITION_ID} ORDER BY r.created_at;
```

**운용보고서 데이터:**
```python
# collect_position_data() 호출 결과 확인
# Docker 컨테이너 내에서:
from app.services.ai_service import AIService
ai = AIService(db)
data = ai.collect_position_data(position_id)
import json; print(json.dumps(data, ensure_ascii=False, indent=2, default=str))
```

**뉴스데스크 데이터:**
```sql
-- 특정 날짜의 raw_news 수
SELECT source, COUNT(*) FROM raw_news WHERE newsdesk_date = '{DATE}' GROUP BY source;

-- 전달되는 뉴스 (최대 50건)
SELECT id, source, title, description, pub_date FROM raw_news
WHERE newsdesk_date = '{DATE}' ORDER BY pub_date DESC LIMIT 50;
```

### Step 2: 현재 AI 결과 수집

이미 생성된 결과가 있다면 DB에서 조회:

```sql
-- 의사결정서
SELECT id, content FROM decision_notes WHERE position_id = {POS_ID} AND note_type = 'decision';

-- 운용보고서
SELECT id, content FROM decision_notes WHERE position_id = {POS_ID} AND note_type = 'report';

-- 뉴스데스크
SELECT id, columns, news_cards, top_stocks, keywords, sentiment
FROM news_desks WHERE publish_date = '{DATE}';
```

없다면 수동 생성:

```python
# 의사결정서 생성
ai = AIService(db)
result = await ai.generate_decision_note(discussion_id=X)

# 운용보고서 생성
result = await ai.generate_operation_report(position_id=X)

# 뉴스데스크 생성
from app.services.newsdesk_ai import NewsDeskAI
newsdesk_ai = NewsDeskAI(db)
raw_news = db.query(RawNews).filter(RawNews.newsdesk_date == target_date).all()
result = newsdesk_ai.generate_newsdesk(target_date, raw_news)
newsdesk_ai.save_newsdesk(target_date, result, len(raw_news))
```

### Step 3: 클로드 코드 이상적 결과물 작성

동일한 소스 데이터만을 사용하여 "이상적인 문서"를 작성한다.

**작성 기준:**
1. **같은 소스 데이터만 사용** (공정한 비교)
2. **마크다운 UX 최적화**: 사이드뷰어(~400px)에서의 가독성 고려
   - 소제목(###), 볼드(**), 테이블, 체크리스트 적절 활용
   - 정보 밀도 vs 여백 밸런스
3. **보고서 구성 아이디어**: 어떤 섹션 구성이 효과적인지, 어떤 데이터를 어떻게 시각화하면 좋은지
4. **UX 개선 제안**: 각 문서가 사이드뷰어에서 보일 때 마크다운을 어떻게 활용하면 좋을지

> 이 결과물은 Iteration과 무관한 **고정 기준점**으로 사용된다.

### Step 4: 비교 분석 (7개 항목 프레임워크)

| # | 비교 항목 | 평가 기준 | 평가 방법 |
|---|----------|----------|----------|
| 1 | 구조 완성도 | 요청한 섹션이 모두 있는가 | 목차 대비 실제 섹션 비교 |
| 2 | 테이블 정확도 | 컬럼 수, 행 수, 헤더가 지시대로인가 | 프롬프트 요구 vs 실제 출력 |
| 3 | 길이 달성률 | 목표 글자수 대비 실제 길이 | 글자수 측정 |
| 4 | 데이터 정확성 | 숫자·날짜·이름이 원본과 일치하는가 | 소스 데이터와 교차 검증 |
| 5 | 마크다운 품질 | 소제목/볼드/리스트 등 활용도 | 렌더링 시 가독성 평가 |
| 6 | 분석 깊이 | 단순 나열 vs 맥락·인사이트 제공 | 클로드 코드 결과물과 비교 |
| 7 | 프롬프트 준수율 | 금지 사항 위반, 형식 미준수 | 체크리스트 기반 확인 |

### Step 5: 문제점 도출 & 프롬프트 개선

비교분석에서 발견된 문제점을 분류하고 개선한다.

**문제 분류:**

| 분류 | 설명 | 해결 방법 |
|------|------|----------|
| 프롬프트 미비 | 지시가 없어서 못 따름 | 프롬프트에 명시 추가 |
| 프롬프트 불명확 | 지시가 있지만 모호함 | 구체적 예시 추가 |
| 데이터 전처리 필요 | AI가 변환/계산 실패 | 백엔드에서 미리 변환 |
| 모델 한계 | 지시를 이해했지만 능력 부족 | 모델 전환 또는 분할 생성 |

**프롬프트 개선 원칙:**
1. "~하라"보다 **구체적 예시** 제시가 효과적
2. "절대 금지" + **위반 예시 나열**이 효과적
3. AI에게 **계산/변환을 시키지 말고** 백엔드에서 전처리
4. 소형 모델에서는 요구사항 **수**를 줄이는 것이 길이를 **늘리는** 것보다 중요

### Step 6: 재생성 & 재비교

```bash
# 1. 프롬프트 코드 수정
# 2. Docker 빌드 (필수!)
docker-compose up -d --build

# 3. 수동 생성 실행
docker exec fundmessage-backend python -c "
import sys; sys.path.insert(0, '//app')
from datetime import date
from app.database import SessionLocal
# ... (Step 2의 수동 생성 코드)
"

# 4. Step 4의 비교분석 반복
```

### Step 7: 종료 조건 판단

| 조건 | 설명 |
|------|------|
| 모든 항목 70% 이상 달성 | 최소 품질 기준 충족 |
| 2회 연속 개선 없음 | 프롬프트 최적화 한계 도달 |
| 모델 한계로 판정 | 데이터 전처리·프롬프트로 해결 불가 → 모델 전환 권고 |
| 비용 한도 초과 | OpenAI 크레딧 소진 |

---

## 4. 문서 유형별 특수 사항

### 4.1 의사결정서

**핵심 검증 포인트:**
- 세션별 논의 흐름 분리 여부
- 리스크 테이블 컬럼 수 (2 vs 3)
- 최종 결정 테이블 행 완성도
- 차트 OHLCV 데이터 활용 여부

**데이터 전처리 체크리스트:**
- [ ] 세션 헤더 `=== 세션 #N: [제목] ===` 삽입
- [ ] 메시지 시간 KST `[HH:MM]` 포맷
- [ ] 시스템 메시지 `[시스템]` 태그
- [ ] 차트 데이터 OHLCV JSON 포함
- [ ] 매매계획 JSON (buy_plan, TP, SL)

### 4.2 운용보고서

**핵심 검증 포인트:**
- 메타 설명 오염 여부 ("참고:", "비고:" 등)
- UTC→KST 변환 정확성
- 가격 콤마 포맷
- 보유기간 계산

**데이터 전처리 체크리스트 (필수!):**
- [ ] `to_kst_str()`: UTC → KST 문자열
- [ ] `fmt_price()`: 숫자 → "839,000원" 콤마 포맷
- [ ] `holding_period`: 자동 계산 → "1일 6시간"
- [ ] 상태 한글화: open→"진행중", approved→"승인"
- [ ] 확인 상태: false→"미확인", true→"확인완료"

> **핵심 교훈**: 운용보고서는 프롬프트보다 **데이터 전처리**가 품질에 결정적 영향. Iteration 0→2에서 6개 문제가 전부 전처리로 해결됨.

### 4.3 뉴스데스크

**핵심 검증 포인트:**
- 뉴스카드 6개, 칼럼 2개(국내+해외), 주목종목 3개 완성도
- content/detail 길이 달성률
- 키워드 top_greed/top_fear 포함 여부
- JSON 구조 완전성 (빈 배열/누락 확인)

**특수 사항:**
- `response_format={"type": "json_object"}`로 JSON 구조 강제
- 뉴스카드/칼럼/주목종목이 **1회 호출로 동시 생성**됨
- 소형 모델에서 출력 용량 초과 시 일부 항목 탈락 가능 (news_cards 0개 사례)
- **대안**: 2-3회 분할 호출 (칼럼, 뉴스카드, 주목종목 별도 생성)

**뉴스 수집 상태 확인:**
```sql
SELECT newsdesk_date, source, COUNT(*)
FROM raw_news
WHERE newsdesk_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY newsdesk_date, source
ORDER BY newsdesk_date DESC;
```

---

## 5. 모델별 알려진 한계

### 5.1 gpt-5-nano

| 항목 | 한계 | 대안 |
|------|------|------|
| 메타 설명 삽입 | "절대 금지" + 구체적 예시로 90% 해결 | 시스템 프롬프트 강화 |
| UTC→KST 변환 | 불가 | 백엔드 전처리 |
| 숫자 콤마 포맷 | 불가 | 백엔드 전처리 |
| 3컬럼+ 테이블 | 불안정 (2컬럼 선호) | gpt-5-mini 전환 |
| 세션별 분리 | 불안정 (단일 문단 선호) | 데이터 전처리 + gpt-5-mini |
| 최소 길이 준수 | 50-70% 수준 | gpt-5-mini 전환 |
| 출력 항목 완성도 | 프롬프트 강화 시 일부 탈락 | 분할 호출 또는 gpt-5-mini |
| 수량 지시 준수 | 불안정 (칼럼 2개→3개) | gpt-5-mini 전환 |
| 교차 참조 | 같은 섹터 내 부분적만 | gpt-5-mini 전환 |

### 5.2 gpt-5-mini

> 2026-02-10 테스트 완료. 상세: `comparison-report-mini.md`

| 항목 | 한계 | 대안 |
|------|------|------|
| 최소 길이 준수 | 67-89% 수준 (nano 50-70% 대비 개선) | 분할 생성 또는 few-shot 예제 |
| 이모지 사용 | 미사용 (프롬프트 요청에도 불구) | 프론트엔드 후처리 |
| JSON 키 일관성 | `stock_name` vs `name` 불일치 | `response_format` 스키마 강제 |

**nano 대비 해결된 항목:**
- ✅ 메타 설명 삽입 → **완전 제거**
- ✅ 3컬럼+ 테이블 → **안정적 출력**
- ✅ 세션별 분리 → **정확한 분리**
- ✅ 출력 항목 완성도 → **뉴스카드 6개 정상 출력** (nano: 0개)
- ✅ 수량 지시 준수 → **칼럼 2개, 카드 6개 정확**
- ✅ 카테고리 분배 → **국내+해외 정확**
- ✅ 교차 참조 → **(관련 기사: ...)** 형태로 풍부하게 삽입

**결론**: gpt-5-mini는 구조적 지시를 거의 완벽하게 준수. 유일한 약점은 길이 미달(67-89%)이며, 이는 프롬프트 강화보다 분할 생성이 더 효과적일 것으로 판단.

---

## 6. 핵심 교훈

### 6.1 데이터 전처리 > 프롬프트 지시 (소형 모델)

```
BAD:  "UTC 시간을 KST로 변환하여 출력하라" → AI가 변환 실패
GOOD: 백엔드에서 미리 "2026-02-09 08:47" (KST)로 변환 → AI가 그대로 사용
```

이 원칙은 시간, 가격, 보유기간, 상태값 등 **모든 변환 가능한 데이터**에 적용된다.

### 6.2 프롬프트 강화의 역설

소형 모델에서 프롬프트 요구사항을 늘리면:
- ✅ 구조적 지시(소제목, 볼드)는 잘 반영됨
- ❌ 길이 지시("2,000자 이상")는 효과 제한적
- ❌ 총 출력 요구가 모델 용량 초과 시 일부 항목 탈락

**실전 규칙**: 소형 모델에서는 **요구 항목 수를 줄이고**, 구조적 품질에 집중하는 것이 더 효과적.

### 6.3 Docker 빌드 주의사항

```bash
# ❌ 코드 변경이 반영되지 않을 수 있음
docker-compose restart

# ✅ 확실한 코드 반영
docker-compose up -d --build
```

### 6.4 절대 금지 규칙의 효과

"~하지 마라"보다 **구체적 예시 나열**이 효과적:

```
# 효과 낮음
"메타 설명을 삽입하지 마세요"

# 효과 높음
"## 절대 금지 (위반 시 실패)
- '참고:', '비고:', '주의:', '본 문서는', '데이터 출처:', '필요하신 경우' 등 메타 설명 삽입 금지
- 출력은 오직 보고서 본문만 포함"
```

---

## 7. 비교 분석 문서 작성 템플릿

각 문서 유형별로 아래 구조를 반복:

```markdown
## N.1 프롬프트 (Iteration X)
## N.2 소스 데이터
## N.3 AI 생성결과 (Iteration X)
## N.4 클로드 코드의 이상적 결과물 + UX 아이디어
## N.5 비교분석 (7개 항목 테이블)
## N.6 문제점 & 개선점
## N.7 개선된 프롬프트 (Iteration X+1)
## N.8 AI 생성결과 (Iteration X+1)
## N.9 클로드 코드의 이상적 결과물 (N.4와 동일)
## N.10 비교분석 (7개 항목 테이블)
## N.11 잔여 문제점 & 추가 개선 제안
```

**Iteration 반복 기준:**
- 개선 효과가 확인되면 다음 Iteration 진행
- 2회 연속 개선 없으면 모델 한계로 판정 → 다음 모델로 이동

---

## 8. 참고 문서

| 문서 | 위치 | 설명 |
|------|------|------|
| 비교 분석 보고서 | `docs/ai-prompt-analysis/comparison-report.md` | gpt-5-nano 테스트 전체 결과 |
| AI 프롬프트 패턴 | `memory/patterns/ai-prompt-patterns.md` | 재사용 가능한 프롬프트 패턴 |
| 의사결정서 분석 | `docs/ai-prompt-analysis/decision-note.md` | 의사결정서 상세 분석 |
| 운용보고서 분석 | `docs/ai-prompt-analysis/operation-report.md` | 운용보고서 상세 분석 |
| 뉴스데스크 분석 | `docs/ai-prompt-analysis/newsdesk.md` | 뉴스데스크 상세 분석 |
