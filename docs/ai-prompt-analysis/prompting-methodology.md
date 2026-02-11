# GPT-5 프롬프팅 방법론

> 작성일: 2026-02-10
> 적용 모델: gpt-5-mini (프로덕션), gpt-5-nano (테스트)
> 대상 시스템: 펀드팀 메신저 AI 서비스 (의사결정서, 운용보고서, 뉴스데스크)

---

## 1. 개요

### 1.1 목적

이 문서는 GPT-5 계열 모델에 최적화된 프롬프트 엔지니어링 전략을 정리한다. gpt-5-mini 테스트 결과 전체 문서 유형에서 **목표 길이의 67-89%만 달성**하는 문제가 확인되었으며, 이를 해결하기 위한 연구 기반 방법론을 수립한다.

### 1.2 현재 문제

| 문서 유형 | 목표 길이 | 실제 달성 | 달성률 |
|----------|----------|----------|--------|
| 의사결정서 | ~2,800자 | 2,497자 | 89% |
| 운용보고서 | ~2,800자 | 2,094자 | 75% |
| 뉴스카드 (6개) | 800자/개 | 589자 avg | 74% |
| AI 칼럼 (2개) | 2,000자/개 | 1,341자 avg | 67% |
| 주목종목 (3개) | 800자/개 | 699자 avg | 87% |

### 1.3 설계 원칙

> "정보 밀도가 높고 여러 각도로 바라볼 수 있으면서 객관적인 정보가 포함된다면 형식은 매번 같아도 상관없다."

- **정보 밀도 > 형식 다양성**: 매일 동일한 구조여도, 내부 분석의 깊이와 다각도 관점이 핵심
- **구체성 > 추상성**: "자세히 쓰라" 대신 "데이터 포인트 4개, 교차참조 3건" 형태의 구체적 요구
- **완성도 > 간결함**: 간결함 편향을 역이용하지 않고, 충분한 정보를 담는 방향으로 유도

---

## 2. 연구 기반 전략

### 2.1 Verbosity Parameter

#### 개요

GPT-5부터 도입된 API 파라미터. 프롬프트 변경 없이 모델의 출력 깊이와 스타일을 제어한다.

> "Influences the length of the model's final answer, as opposed to the length of its thinking."

#### 스펙

| 항목 | 내용 |
|------|------|
| 파라미터명 | `verbosity` |
| 값 | `"low"`, `"medium"`, `"high"` |
| API | **Responses API** (`client.responses.create()`)에서만 지원 |
| 위치 | `text={"verbosity": "high"}` |
| 레벨 | 요청 단위 (호출마다 다르게 설정 가능) |
| 지원 모델 | gpt-5, gpt-5-mini, gpt-5-nano 등 GPT-5 계열 전체 |

#### 효과

- `"low"`: 핵심만, 부가 설명 없음
- `"medium"`: 기본값. 적절한 구조와 설명
- `"high"`: 포괄적 출력. 근거, 대안, 주의사항까지 포함

#### 핵심 제약: Chat Completions API 미지원

```python
# ❌ Chat Completions — verbosity 파라미터 무효
client.chat.completions.create(
    model="gpt-5-mini",
    messages=[...],
    # verbosity는 여기서 지원되지 않음
)

# ✅ Responses API — verbosity 지원
client.responses.create(
    model="gpt-5-mini",
    instructions="시스템 프롬프트",
    input="유저 프롬프트",
    text={"verbosity": "high"},
)
```

**참고**: Responses API의 `text` 파라미터와 `response_format`은 상호 배타적이다. JSON 구조 출력이 필요한 뉴스데스크에서는 verbosity를 사용할 수 없다.

| 문서 유형 | API | verbosity 사용 |
|----------|-----|----------------|
| 의사결정서 | Responses API | ✅ `"high"` |
| 운용보고서 | Responses API | ✅ `"high"` |
| 뉴스데스크 | Chat Completions | ❌ (response_format 충돌) |

#### 출처

- [GPT-5 New Params and Tools — OpenAI Cookbook](https://cookbook.openai.com/examples/gpt-5/gpt-5_new_params_and_tools)
- [chat.completions does not work with verbosity — GitHub #2610](https://github.com/openai/openai-python/issues/2610)
- [Cannot use verbosity for GPT-5 API — GitHub #2528](https://github.com/openai/openai-python/issues/2528)
- [Verbosity + structured output conflict — LangChain #32492](https://github.com/langchain-ai/langchain/issues/32492)

---

### 2.2 XML 태그 구조화

#### 근거

GPT-5.2 프롬프팅 가이드에서 공식적으로 권고:

> "If the model is failing, it's likely because your constraints were implied, not explicit. GPT-5.2 requires explicit instructions."

XML 태그를 사용하면 모델이 프롬프트의 각 부분(역할, 제약조건, 출력 형식, 입력 데이터)을 명확히 구분하여 지시 준수율이 향상된다.

#### 권장 태그 체계

| 태그 | 용도 | 예시 |
|------|------|------|
| `<ROLE>` | 페르소나 + 독자 정의 | "수석 애널리스트, 독자는 펀드매니저" |
| `<CONSTRAINTS>` | 행동 규칙 (번호 목록) | "1. 요약만, 2. 메타 설명 금지, ..." |
| `<ABSOLUTE_PROHIBITION>` | 위반 시 실패 조건 | "참고:", "본 문서는" 등 금지 패턴 |
| `<DENSITY_REQUIREMENTS>` | 구조적 밀도 요구 | "참여자별 수치 2개+, 리스크 3행+" |
| `<QUALITY_CHECKLIST>` | 셀프 검증 | "교차참조 4개 있는가?" |
| `<TASK>` | 작업 지시 | "아래 데이터로 의사결정서 작성" |
| `<INPUT_DATA>` | 소스 데이터 래퍼 | JSON, 텍스트 데이터 |
| `<OUTPUT_SPEC>` | 출력 형식 정의 | 마크다운 템플릿 |

#### Before / After 비교

```
# Before (평문)
## 핵심 원칙
1. 요약: 발언을 그대로 복사하지 말고...
2. 시스템 메시지 제외: ...
6. 간결함: 불필요한 반복이나 장황한 설명 없이 핵심만
```

```xml
<!-- After (XML 구조화) -->
<CONSTRAINTS>
1. 요약: 발언을 그대로 복사하지 말고 핵심을 재구성합니다
2. 시스템 메시지 제외: [시스템] 태그가 붙은 메시지는 세션 구분 참고만
6. 완성도 우선: 각 섹션이 충분한 근거와 수치를 포함하도록 작성합니다
</CONSTRAINTS>
```

#### 적용 범위

- 시스템 프롬프트: XML 태그 전면 적용
- 유저 프롬프트: `<TASK>`, `<INPUT_DATA>`, `<OUTPUT_SPEC>` 래퍼
- JSON 모드 (뉴스데스크): 시스템 프롬프트에만 XML, 유저 프롬프트의 JSON 템플릿은 그대로 유지

#### 출처

- [GPT-5.2 Prompting Guide — OpenAI Cookbook](https://cookbook.openai.com/examples/gpt-5/gpt-5-2_prompting_guide)

---

### 2.3 구조적 밀도 (Structural Density)

#### 원리

"2,000자 이상 쓰라"는 지시는 **추상적**이다. 모델은 "충분히 썼다"고 판단하면 조기 종료한다.

대신 **필수 분석 차원**을 구체적으로 지정하면, 각 차원을 채우는 과정에서 자연스럽게 목표 길이에 도달한다.

#### 기법

| 추상적 지시 (비효과적) | 구조적 밀도 (효과적) |
|----------------------|---------------------|
| "2,000자 이상 작성" | "4파트 각 500-700자, 소제목 필수" |
| "자세히 분석" | "관련 뉴스 4건 교차참조, 시계열 비교 1건" |
| "구체적 수치 포함" | "수치 데이터 포인트 최소 4개, 각각 **볼드**" |
| "심층 분석" | "긍정 요인 3개 + 부정 요인 3개, 각 뉴스 근거 포함" |

#### 뉴스데스크 칼럼 적용 예시

```
# Before
content는 반드시 2,000자 이상 작성하세요. 2,000자 미만 작성 시 실패로 간주합니다.

# After
본문 구성 (목표 2,500-3,000자):
- ### 도입부 (400-500자): Hook + 핵심 수치 2개 이상 **볼드**
- ### 본론1 (800-1,000자): 데이터 4개 이상, 관련 뉴스 4건 이상 교차 참조
- ### 본론2 (800-1,000자): 긍정 요인 3개 + 부정 요인 3개, 섹터 간 상호작용 분석
- ### 결론 (300-400자): 핵심 재확인, 모니터링 포인트 3개
```

"실패" 위협을 제거하고, 대신 각 파트에서 **무엇을 채워야 하는지** 구체적으로 명시한다. 모델은 각 파트의 요구사항을 이행하려 하면서 자연스럽게 길이가 증가한다.

#### 핵심 수치

| 문서 유형 | 필수 교차참조 | 필수 데이터 포인트 | 분석 각도 |
|----------|-------------|-------------------|----------|
| 뉴스카드 | 3건+ | 3개+ | 핵심수치/배경맥락/시장영향/투자시사점 |
| AI 칼럼 | 4건+ | 4개+ | 도입/현황분석/리스크와기회/결론 |
| 주목종목 | 3건+ | 3개+ | 주목이유/언급내용/기본정보/시장반응 |
| 의사결정서 | N/A | 참여자별 2개+ | 참여자의견/논의흐름/결정/리스크 |
| 운용보고서 | N/A | 전처리 데이터 | 포지션/거래/계획/요청/노트/토론/종합 |

---

### 2.4 역할 심화 (Role Deepening)

#### 원리

역할 지시가 구체적일수록 모델은 그 역할에 맞는 **깊이**로 출력한다. 특히 독자(audience)를 명시하면 정보 밀도가 조절된다.

#### Before / After

| 문서 | Before | After |
|------|--------|-------|
| 의사결정서 | "펀드팀의 투자 의사결정서를 작성하는 전문 애널리스트" | "10년 경력의 펀드팀 수석 애널리스트. 독자는 토론에 참여하지 않은 팀원 포함. 충분한 맥락과 근거 제공 필수" |
| 운용보고서 | "펀드팀의 운용보고서를 작성하는 전문가" | "포트폴리오 매니저. 팀 리뷰 회의에서 즉시 사용 가능한 보고서 작성" |
| 뉴스데스크 | "금융 뉴스 분석 전문가" | "국내 대형 증권사 리서치센터 수석 편집자. 독자는 펀드매니저와 트레이더. 피상적 요약이 아닌 뉴스 간 연결고리와 투자 시사점이 목표" |

#### 핵심 추가 요소

역할 지시에 **완성도 우선** 원칙을 함께 삽입:

```xml
<ROLE>
당신은 10년 경력의 펀드팀 수석 애널리스트입니다.
독자는 토론에 참여하지 않은 팀원도 포함되므로, 충분한 맥락과 근거를 제공해야 합니다.
</ROLE>
```

"충분한 맥락과 근거를 제공해야 합니다"가 기존의 "간결함: 핵심만 작성"을 대체한다.

---

### 2.5 오버슈트 타겟 (Overshoot Targets)

#### 원리

모델이 일관적으로 목표의 67-89%를 달성한다면, 타겟을 **1.3~1.5배**로 설정하여 실제 출력이 원래 목표에 근접하게 한다.

#### 적용 (뉴스데스크 전용)

verbosity 파라미터를 사용할 수 없는 뉴스데스크에서 핵심 전략이 된다.

| 항목 | 실제 목표 | 프롬프트 타겟 | 배수 |
|------|----------|-------------|------|
| 뉴스카드 body | 800자 | 1,200-1,500자 | 1.5x-1.9x |
| AI 칼럼 body | 2,000자 | 2,500-3,000자 | 1.3x-1.5x |
| 주목종목 detail | 800자 | 1,000-1,200자 | 1.3x-1.5x |

#### 주의사항

- 오버슈트 단독으로는 효과 제한적. **구조적 밀도와 반드시 병행**해야 함
- 타겟이 너무 높으면 모델이 무시할 수 있음. 1.5x 이내 권장
- "N자 미만 시 실패"와 같은 위협적 표현은 제거 (GPT-5에서 비효과적)

---

### 2.6 간결함 편향 대응

#### GPT-5.1 공식 인정

OpenAI GPT-5.1 프롬프팅 가이드에서 공식적으로 언급:

> "GPT-5.1 can err on the side of being excessively concise and sometimes sacrifices answer completeness."

#### 대응 전략

| 전략 | 효과 | 적용 |
|------|------|------|
| `verbosity: "high"` | ✅ 높음 | Responses API만 (의사결정서/운용보고서) |
| "완성도 우선" 원칙 | ✅ 중간 | 모든 프롬프트의 `<CONSTRAINTS>` |
| 구조적 밀도 | ✅ 높음 | 모든 프롬프트의 `<DENSITY_REQUIREMENTS>` |
| "Be THOROUGH" | ❌ 역효과 | 사용 금지 |
| "자세히 작성하라" | ❌ 약함 | 사용 금지 |
| "N자 미만 시 실패" | ❌ 무효 | 사용 금지 |

#### "Be THOROUGH"가 역효과인 이유

GPT-5 프롬프팅 가이드:

> "Abstract instructions like 'Be THOROUGH' proved counterproductive with GPT-5. Concrete structural requirements work better."

추상적 지시는 모델이 "충분히 자세하다"고 자체 판단하게 만든다. 구체적 구조 요구(데이터 포인트 수, 파트 수, 분석 각도)가 훨씬 효과적이다.

#### 기존 프롬프트에서 제거해야 할 표현

```
# 제거 대상
- "간결함: 불필요한 반복이나 장황한 설명 없이 핵심만 작성합니다"
- "반드시 N자 이상 작성하세요"
- "N자 미만 작성 시 실패로 간주합니다"

# 대체
- "완성도 우선: 각 섹션이 충분한 근거와 수치를 포함하도록 작성합니다"
- "목표 N-M자" (오버슈트 타겟)
- 구조적 밀도 요구 (파트별 필수 요소)
```

#### 출처

- [GPT-5.1 Prompting Guide — OpenAI Cookbook](https://cookbook.openai.com/examples/gpt-5/gpt-5-1_prompting_guide)
- [GPT-5 Prompting Guide — OpenAI Cookbook](https://cookbook.openai.com/examples/gpt-5/gpt-5_prompting_guide)

---

### 2.7 JSON 후처리 전략 (Iter 2)

#### 문제: verbosity + response_format 충돌

뉴스데스크는 `response_format={"type": "json_object"}`를 사용하여 JSON 출력을 강제한다. 그러나 Responses API의 `text` 파라미터(verbosity 포함)와 `response_format`은 **상호 배타적**이다.

#### 해결: 텍스트 출력 → JSON 추출

Responses API + verbosity로 텍스트를 받고, 후처리로 JSON을 추출하는 전략.

```python
# 1차: Responses API + verbosity (JSON은 프롬프트로 유도)
if settings.openai_verbosity:
    try:
        response = self.client.responses.create(
            model=settings.openai_model,
            instructions=system_prompt,
            input=prompt,
            text={"verbosity": settings.openai_verbosity},
        )
        if response.output_text:
            raw_text = response.output_text
    except Exception:
        pass

# 2차: Chat Completions + response_format fallback
if not raw_text:
    response = self.client.chat.completions.create(
        model=settings.openai_model,
        messages=[...],
        response_format={"type": "json_object"},
    )
    raw_text = response.choices[0].message.content

# JSON 추출
result = _extract_json(raw_text)
```

#### `_extract_json()` 구현

3단계 파싱 전략:
1. `json.loads(text)` — 전체가 JSON인 경우
2. ````json ... ``` 코드블록 내 JSON 추출
3. 첫 번째 `{` ~ 마지막 `}` 범위 추출

```python
def _extract_json(self, text: str) -> Dict[str, Any]:
    # 1단계: 직접 파싱
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        pass

    # 2단계: 코드블록 내 JSON
    import re
    code_block = re.search(r'```(?:json)?\s*(\{[\s\S]*\})\s*```', text)
    if code_block:
        try:
            return json.loads(code_block.group(1))
        except json.JSONDecodeError:
            pass

    # 3단계: 첫 { ~ 마지막 }
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start:end + 1])
        except json.JSONDecodeError:
            pass

    raise ValueError(f"JSON 추출 실패")
```

#### Iter 2 결과

| 항목 | Iter 0 | Iter 1 (XML만) | Iter 2 (verbosity) | Iter 0 대비 |
|------|--------|----------------|-------------------|-------------|
| 칼럼 avg | 1,341자 | 1,558자 (+16%) | **1,667자** | **+24%** |
| 뉴스카드 avg | 589자 | 638자 (+8%) | **679자** | **+15%** |
| 주목종목 avg | 699자 | 584자 (-16%) | **711자** | **+2%** |

**핵심 발견:**
- JSON 파싱 성공률: 100% (2회 테스트)
- 주목종목 퇴행(-16%)이 **해소** (+2% from Iter 0)
- 칼럼/카드 개선은 있으나 의사결정서(+72%)/운용보고서(+46%)만큼 극적이지 않음
- LLM 출력 변동성이 있음 (1차 실행은 칼럼 ~2,200자+, 2차 실행은 1,667자)

#### 한계

- JSON 구조가 출력 토큰을 소비하므로 verbosity 효과가 텍스트 전용보다 약함
- 파싱 실패 시 fallback이 필요 (Chat Completions + response_format)
- 프롬프트에 "JSON만 출력하세요" 지시가 있으면 모델이 설명 텍스트를 추가하지 않아 파싱 성공률이 높음

---

## 3. 문서 유형별 적용 전략

### 3.1 의사결정서

| 전략 | 적용 | 상세 |
|------|------|------|
| Verbosity | ✅ `"high"` | Responses API 마이그레이션 필요 |
| XML 구조화 | ✅ | `<ROLE>`, `<CONSTRAINTS>`, `<DENSITY_REQUIREMENTS>`, `<TASK>`, `<INPUT_DATA>`, `<OUTPUT_SPEC>` |
| 구조적 밀도 | ✅ | 참여자별 수치 2개+, 리스크 3행+, 결정 근거 수치 필수 |
| 역할 심화 | ✅ | "10년 경력 수석 애널리스트" + 독자 범위 명시 |
| 오버슈트 타겟 | 불필요 | verbosity로 대체 |
| 간결함 제거 | ✅ | 원칙 6 "간결함" → "완성도 우선" |

**예상 효과**: 2,497자 → ~3,000-3,200자 (89% → 107-114%)

### 3.2 운용보고서

| 전략 | 적용 | 상세 |
|------|------|------|
| Verbosity | ✅ `"high"` | Responses API 마이그레이션 필요 |
| XML 구조화 | ✅ | `<ROLE>`, `<CONSTRAINTS>`, `<ABSOLUTE_PROHIBITION>`, `<DENSITY_REQUIREMENTS>` |
| 구조적 밀도 | ✅ | 종합평가 3항목 각 3-4문장, 교차검증 명시 |
| 역할 심화 | ✅ | "포트폴리오 매니저" + 리뷰 회의 목적 |
| 오버슈트 타겟 | 불필요 | verbosity로 대체 |

**예상 효과**: 2,094자 → ~2,600-2,900자 (75% → 93-104%)

### 3.3 뉴스데스크

| 전략 | 적용 | 상세 |
|------|------|------|
| Verbosity | ❌ | response_format=json_object 충돌 |
| XML 구조화 | ✅ | `<ROLE>`, `<NEWS_CARD_SPEC>`, `<COLUMN_SPEC>`, `<TOP_STOCKS_SPEC>`, `<QUALITY_CHECKLIST>` |
| 구조적 밀도 | ✅ (핵심) | 뉴스카드 4파트, 칼럼 4파트, 주목종목 4파트 각각 필수 요소 명시 |
| 역할 심화 | ✅ | "대형 증권사 리서치센터 수석 편집자" + 독자 정의 |
| 오버슈트 타겟 | ✅ (핵심) | 800→1,200-1,500, 2,000→2,500-3,000, 800→1,000-1,200 |
| 셀프 검증 | ✅ | `<QUALITY_CHECKLIST>` 추가 |

**예상 효과**:
- 뉴스카드: 589자 → ~750-900자 (74% → 94-113%)
- AI 칼럼: 1,341자 → ~1,800-2,200자 (67% → 90-110%)
- 주목종목: 699자 → ~850-1,000자 (87% → 106-125%)

---

## 4. 비용 분석

### 4.1 현재 비용 (gpt-5-mini, Iter 0)

| 문서 유형 | 입력 토큰 | 출력 토큰 | 비용/회 |
|----------|----------|----------|---------|
| 의사결정서 | ~8,000 | ~4,000 | ~$0.010 |
| 운용보고서 | ~7,000 | ~5,000 | ~$0.012 |
| 뉴스데스크 | ~17,000 | ~23,000 | ~$0.050 |
| **일일 합계** | ~32,000 | ~32,000 | **~$0.072** |

### 4.2 예상 비용 변동 (Iter 1)

| 변경 사항 | 영향 |
|----------|------|
| verbosity=high (의사결정서/운용보고서) | 출력 토큰 30-50% 증가 |
| XML 시스템 프롬프트 확장 | 입력 토큰 20-30% 증가 |
| 뉴스데스크 오버슈트 출력 | 출력 토큰 30-50% 증가 |

| 문서 유형 | 예상 비용/회 | 변화 |
|----------|-------------|------|
| 의사결정서 | ~$0.015 | +50% |
| 운용보고서 | ~$0.018 | +50% |
| 뉴스데스크 | ~$0.070 | +40% |
| **일일 합계** | **~$0.103** | **+43%** |

### 4.3 월간 비용

| 항목 | 현재 | 예상 (Iter 1) |
|------|------|---------------|
| 뉴스데스크 (매일) | ~$1.50 | ~$2.10 |
| 의사결정서 (주 5회) | ~$0.20 | ~$0.30 |
| 운용보고서 (주 3회) | ~$0.14 | ~$0.22 |
| **월 합계** | **~$1.84** | **~$2.62** |
| **월 증가분** | — | **+$0.78 (+42%)** |

비용 증가는 월 $1 미만이며, 문서 품질 향상(길이 + 정보 밀도)을 고려하면 정당화된다.

---

## 5. 참고 자료

### OpenAI 공식 문서

| 문서 | URL | 핵심 내용 |
|------|-----|----------|
| GPT-5 New Params and Tools | [OpenAI Cookbook](https://cookbook.openai.com/examples/gpt-5/gpt-5_new_params_and_tools) | verbosity 파라미터 스펙 |
| GPT-5 Prompting Guide | [OpenAI Cookbook](https://cookbook.openai.com/examples/gpt-5/gpt-5_prompting_guide) | "Be THOROUGH" 역효과, 구체적 지시 권장 |
| GPT-5.1 Prompting Guide | [OpenAI Cookbook](https://cookbook.openai.com/examples/gpt-5/gpt-5-1_prompting_guide) | 간결함 편향 공식 인정, 완성도 강조 |
| GPT-5.2 Prompting Guide | [OpenAI Cookbook](https://cookbook.openai.com/examples/gpt-5/gpt-5-2_prompting_guide) | XML 태그 효과, "implied → explicit" |
| Using GPT-5.2 | [Platform Docs](https://platform.openai.com/docs/guides/latest-model) | Responses API 사용법 |

### 커뮤니티 이슈

| 이슈 | URL | 핵심 내용 |
|------|-----|----------|
| chat.completions verbosity 미지원 | [GitHub #2610](https://github.com/openai/openai-python/issues/2610) | Chat Completions에서 verbosity 무효 |
| GPT-5 API verbosity 불가 | [GitHub #2528](https://github.com/openai/openai-python/issues/2528) | Responses API만 지원 확인 |
| verbosity + structured output 충돌 | [LangChain #32492](https://github.com/langchain-ai/langchain/issues/32492) | response_format과 text 상호 배타 |

---

## 6. 전략 요약 매트릭스

| 전략 | 의사결정서 | 운용보고서 | 뉴스데스크 | 효과 |
|------|-----------|-----------|-----------|------|
| verbosity: high | ✅ | ✅ | ❌ | 높음 (30-50% 길이 증가) |
| XML 태그 구조화 | ✅ | ✅ | ✅ | 중간 (지시 준수율 향상) |
| 구조적 밀도 | ✅ | ✅ | ✅ | 높음 (자연스러운 길이 증가) |
| 역할 심화 | ✅ | ✅ | ✅ | 중간 (분석 깊이 향상) |
| 오버슈트 타겟 | — | — | ✅ | 중간 (verbosity 대체) |
| 간결함 제거 | ✅ | — | — | 중간 (역방향 편향 제거) |
| 셀프 검증 | — | — | ✅ | 낮음 (품질 보조) |
