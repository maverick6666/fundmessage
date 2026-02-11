# GPT-5 프롬프트 엔지니어링 패턴

## 1. verbosity 파라미터 (최고 효과)

```python
# Responses API에서만 사용 가능 (Chat Completions 미지원!)
response = client.responses.create(
    model="gpt-5-mini",
    instructions=system_prompt,
    input=user_prompt,
    text={"verbosity": "high"},  # "low" | "medium" | "high"
    max_output_tokens=32768,  # 반드시 명시! 기본값이 낮을 수 있음
    reasoning={"effort": "medium"},  # 추론 토큰이 출력 토큰에서 차감됨
)
content = response.output_text
```

- **효과**: +46~72% 길이 증가 (테스트 검증됨)
- **제약**: `response_format`(JSON 모드)과 **충돌** → 뉴스데스크 불가
- **주의**: "high"는 과잉 출력 가능. 의사결정서 153% 발생 → medium 사용

## 2. max_output_tokens 필수 설정 (Iter 4 발견)

- GPT-5-mini 기본 max_output_tokens는 ~8,192일 가능성 높음
- 뉴스데스크 출력 7,617 토큰 = 기본값의 93% → 모델이 천장에서 압축
- **반드시 32768 이상으로 명시 설정**
- max_output_tokens는 ceiling (상한)이지 floor (하한)가 아님
- 비용 영향 없음 (실제 생성 토큰만 과금)

## 3. reasoning effort (Iter 4 발견)

- GPT-5의 추론 토큰은 **출력 토큰에서 차감**됨!
- reasoning effort "high" → 수천 토큰이 추론에 사용 → JSON 출력 토큰 감소
- "medium"으로 설정하면 출력 토큰 확보 + 벤치마크 차이 ~1%
- 뉴스데스크처럼 분석보다 생성이 중요한 작업에 "medium" 적합

## 4. 글자수 목표 → 문단/문장 수 목표 (Iter 4 예정)

```
# BAD (LLM이 글자수를 카운트 못함)
### 본론1: 현황 분석 (800-1,000자)

# GOOD (구조적 단위는 잘 따름)
### 본론1: 현황 분석 — 5문단으로 작성
- 문단1 (3-4문장): 핵심 현상과 수치
- 문단2 (3-4문장): 시계열 비교 (전일/전주/전월)
- 문단3 (2-3문장): 주체별 비교 (기관/외인/개인)
- 문단4 (3-4문장): 관련 뉴스 교차참조 분석
- 문단5 (2-3문장): 소결
```

- **근거**: 모델은 "개념적 완성"에 최적화 → 아이디어 표현 후 섹션을 끝냄
- 문단/문장 수 지시 → 각 문단을 생성해야 하므로 조기 종료 방지

## 5. Few-shot 길이 앵커

- 목표 길이의 실제 예시 1개를 시스템 프롬프트에 포함
- 모델이 패턴 매칭으로 유사 길이를 생성 → stochastic 변동 감소
- 토큰 비용: ~700-900 토큰 추가 (칼럼 1개 예시)
- OpenAI 공식 가이드 권장사항

## 6. XML 태그 구조화

- 12개 이상 XML 블록은 주의력 분산 → 4-5개로 통합 권장
- GPT-5.2 가이드 권장, 칼럼에서 +16% 효과

## 7. 오버슈트 타겟

- 오버슈트 목표를 **낮추면** 모델이 더 짧게 씀! (Iter 3 퇴행으로 확인)
- 모델은 목표를 "열망적 천장"으로 취급, 그 fraction을 생산
- 낮은 목표 = 낮은 절대 출력
- 1.3-1.5x 유지, 절대 낮추지 말 것

## 8. 출력 피로 (Output Fatigue)

- JSON 내 뒤쪽 항목이 -16~26% 짧아짐
- Column 1→2: -20%, Card 1→6: -26%, Stock 1→3: -16%
- 해결: 분할 생성 (최후 보루) 또는 "각 항목을 목표까지 완전히 작성 후 다음으로" 지시

## 9. Responses API fallback + JSON 후처리

```python
# _extract_json() 3단계 파싱은 100% 성공 (Iter 2~)
# 1단계: json.loads(text)
# 2단계: ```json ... ``` 코드블록 추출
# 3단계: 첫 { ~ 마지막 } 추출
```

## 10. "JSON만 출력하세요" → 간결함 신호 유발

- "만" = "only" → 모델이 간결하게 마무리하려는 경향
- 대체: "아래 JSON 형식으로 출력하세요. 각 텍스트 필드의 목표를 반드시 충족하세요."
