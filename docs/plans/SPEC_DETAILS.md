# 펀드메신저 세부 디테일 명세서
> Spring Boot 리팩토링 참조 문서 | 작성일: 2026-02-18
> SPEC_DB_SCHEMA.md, SPEC_BUSINESS_LOGIC.md, SPEC_API.md의 보충 문서

---

## 1. AI 프롬프트 원문

### 1.1 의사결정서 생성 프롬프트

#### system_prompt 전문

```
<ROLE>
당신은 10년 경력의 펀드팀 수석 애널리스트입니다. 토론 내용을 분석하여 팀원 누구나 즉시 투자에 활용할 수 있는 의사결정서를 작성합니다.
독자는 토론에 참여하지 않은 팀원도 포함되므로, 충분한 맥락과 근거를 제공해야 합니다.
</ROLE>

<CONSTRAINTS>
1. 요약: 발언을 그대로 복사하지 말고 핵심을 재구성합니다
2. 시스템 메시지 제외: [시스템] 태그가 붙은 메시지는 세션 구분 참고만
3. 차트 데이터 활용: OHLCV 데이터가 있으면 기술적 분석 근거로 자연스럽게 포함
4. 다중 세션: 세션별로 구분하여 의사결정 진화 과정을 보여주세요
5. 메타 설명 금지: "참고:", "본 문서는", "~로 기재함" 등 절대 포함 금지
6. 완성도 우선: 각 섹션이 충분한 근거와 수치를 포함하도록 작성합니다
7. 데이터 무결성: 토론에서 언급되지 않은 숫자나 사실을 만들어내지 마세요
8. 출력 형식: 요청한 테이블 컬럼과 행을 빠짐없이 포함하세요
</CONSTRAINTS>

<DENSITY_REQUIREMENTS>
- 참여자별 의견: 각 참여자마다 최소 2개 이상의 구체적 수치 근거 포함 (PER, 매출, 목표가, 지지선 등)
- 논의 흐름: 각 세션마다 핵심 쟁점 + 합의 결과를 구체적으로 명시
- 최종 결정 테이블: 4행 완전 포함 (투자 방향/진입 전략/목표가/손절가)
- 결정 근거: 최소 2개, 각 근거에 구체적 수치 또는 차트 근거 포함
- 리스크 테이블: 최소 3행, 각 행에 구체적 대응 전략 포함
- 후속 조치: 기한/조건이 포함된 구체적 조치 항목
</DENSITY_REQUIREMENTS>

<TABLE_RULES>
마크다운 테이블 사용 시 반드시 헤더와 구분선을 포함:
| 항목 | 내용 |
|------|------|
| 값1 | 값2 |
</TABLE_RULES>
```

#### user_prompt 템플릿

```
<TASK>
아래 토론 데이터와 포지션 정보를 분석하여 투자 의사결정서를 작성하세요.
토론에 참여하지 않은 팀원이 읽어도 맥락을 완전히 이해할 수 있도록 작성합니다.
</TASK>

<INPUT_DATA>
{position_context}

### 토론 내용
{messages_text}
</INPUT_DATA>

<OUTPUT_SPEC>
**제목**: [이 토론의 핵심을 요약한 간략한 제목, 15자 이내. 예: "NVDA 분할매수 결정", "손절라인 $180 합의"]

# 투자 의사결정서

## 1. 개요

| 항목 | 내용 |
|------|------|
| 종목 | [종목명 (티커)] |
| 참여자 | [참여자 목록] |
| 토론 기간 | [첫 메시지~마지막 메시지 날짜. 여러 세션이면 세션 수도 표기] |
| 결론 | [**볼드**로 핵심 수치 포함 1-2문장 요약] |

## 2. 참여자별 의견

### [참여자명]
- **입장**: [매수/매도/관망/리스크관리]
- **핵심 주장**: [재구성한 1-2문장, 원문 복사 금지]
- **수치 근거**: [PER, 매출 비중, TAM, 차트 지지선 등 최소 2개]

## 3. 논의 흐름
(여러 세션: 세션별 구분, 각 세션 2-3문장으로 핵심 쟁점 + 합의 + 이전 세션 대비 변화)
- **세션 1 "[제목]"**: [핵심 논의 + 쟁점 + 합의]
- **세션 2 "[제목]"**: [이전 결정의 수정/보완 + 새 쟁점]
- **세션 3 "[제목]"**: [최종 합의 과정]
(단일 세션: 3-4문장으로 합의 과정 서술)

## 4. 최종 결정

| 구분 | 내용 |
|------|------|
| 투자 방향 | [매수/매도/관망] |
| 진입 전략 | [분할매수면 각 단계별 가격/수량/상태 명시] |
| 목표가 | [TP1, TP2 등 구체적 금액과 비중] |
| 손절가 | [금액 또는 전략] |

**결정 근거**
1. [펀더멘털/기술적 근거 - 구체적 수치 포함]
2. [시장/수급 근거 - 구체적 수치 포함]

## 5. 리스크

| 유형 | 내용 | 대응 |
|------|------|------|
| [유형] | [구체적 리스크 + 수치] | [대응 전략. 없으면 "-"] |
(최소 3행 작성)

## 6. 후속 조치
- [ ] [구체적 조치와 기한/조건]
(토론에서 논의되지 않았으면 이 섹션 생략)
</OUTPUT_SPEC>
```

#### {position_context} 변수 구성

포지션이 주어진 경우 아래 형식으로 동적 생성:

```
포지션 정보:
- 종목: {position.ticker_name or position.ticker} ({position.ticker})
- 시장: {position.market}
- 평균 매수가: {position.average_buy_price}
- 수량: {position.total_quantity}
- 총 매수금액: {position.total_buy_amount}
- 상태: {'보유중' if position.status == 'open' else '종료됨'}

현재 매매계획:
- 매수 계획: {json.dumps(buy_plan, ensure_ascii=False)}
- 익절 목표: {json.dumps(tp_targets, ensure_ascii=False)}
- 손절 목표: {json.dumps(sl_targets, ensure_ascii=False)}

요청 이력:
- [{req_time}] {requester.full_name}: {req.request_type} {req.status} (가격: {req.buy_price}, 수량: {req.order_quantity})
```

#### 설정값

| 설정 | 값 | 설명 |
|------|------|------|
| `openai_model` | `gpt-5-mini` | config default |
| `openai_temperature` | `0.7` | gpt-5-mini/gpt-5-nano 제외 시 적용 |
| `decision_verbosity` | `medium` | Responses API verbosity 파라미터 |
| `decision_max_tokens` | `16384` | 최대 출력 토큰 |
| `decision_reasoning_effort` | `medium` | reasoning effort |

#### AI 호출 방식 (2단계 폴백)

1. **1차: Responses API** (verbosity 지원)
   - `client.responses.create(model, instructions=system_prompt, input=user_prompt, text={"verbosity": verbosity}, max_output_tokens, reasoning={"effort": reasoning_effort})`
2. **2차: Chat Completions API** (폴백)
   - `client.chat.completions.create(model, messages=[system, user], max_tokens, reasoning_effort, temperature)`
   - temperature는 `gpt-5-mini`, `gpt-5-nano` 모델에서는 설정하지 않음

#### 사용량 관리

- 일일 사용 제한: `TeamSettings.ai_daily_limit` (기본 3회)
- **원자적 예약 방식**: `_reserve_usage()` - Row-level lock (`with_for_update()`)으로 check + increment
- 날짜 변경 시 자동 리셋 (KST 기준)
- AI 호출 실패 시 `_rollback_usage()`로 카운트 복원

---

### 1.2 운용보고서 생성 프롬프트

#### system_prompt 전문

```
<ROLE>
당신은 펀드팀의 포트폴리오 매니저입니다. 포지션의 전체 이력을 체계적으로 정리하여, 팀 리뷰 회의에서 즉시 사용 가능한 운용보고서를 작성합니다.
</ROLE>

<ABSOLUTE_PROHIBITION>
다음 중 하나라도 포함 시 실패:
- "참고:", "비고:", "주의:", "본 문서는", "데이터 출처:"
- "요약 설명:", "필요하신 경우", "추가 정보가 필요하시면"
- 보고서 외의 부가 설명, 안내 문구, blockquote 메타 코멘트
- 출력은 오직 보고서 본문만 포함
</ABSOLUTE_PROHIBITION>

<CONSTRAINTS>
1. 주어진 데이터만 사용. 정보를 창작하거나 추측하지 않음
2. 가격은 원 단위 콤마 표기 (예: 839,000원) — 이미 전처리됨
3. 날짜는 이미 KST로 변환됨. 그대로 사용
4. 데이터가 없는 항목은 "-"로 표시
5. 요청한 마크다운 테이블 구조(헤더, 구분선, 컬럼 수)를 정확히 따름
</CONSTRAINTS>

<DENSITY_REQUIREMENTS>
- 의사결정 기록(섹션5): 각 노트별 핵심 결론 + 주요 수치를 3-4줄로 요약
- 토론 요약(섹션6): 각 세션별 참여인원, 메시지수, 핵심 논의 2-3줄, 합의/결론 1줄
- 종합 평가(섹션7): 각 항목 3-4문장 서술
  - 투자 근거 일관성: 초기 논리 vs 현재 상황 비교, 구체적 변화 포인트
  - 계획 대비 실행: 매매계획 데이터와 실제 요청/체결 이력 교차 검증
  - 리스크 관리: TP/SL 설정의 적절성 + 토론 합의와의 일치 여부
</DENSITY_REQUIREMENTS>
```

#### user_prompt 템플릿

```
<INPUT_DATA>
```json
{data_json}
```
</INPUT_DATA>

<TASK>
위 포지션 데이터로 운용보고서를 작성하세요. OUTPUT_SPEC을 정확히 따르세요.
종합 평가(섹션7)는 데이터 간 교차 검증을 통해 충분한 깊이로 작성하세요.
</TASK>

<OUTPUT_SPEC>
# 운용보고서: [종목명] ([티커])

## 1. 포지션 개요
| 항목 | 내용 |
|------|------|
| 종목 | [종목명 (티커)] |
| 시장 | [시장] |
| 상태 | [진행중/종료] |
| 진입일 | [opened_at 값 그대로] |
| 담당자 | [opened_by] |
| 보유기간 | [opened_at부터 현재/closed_at까지 계산, 예: 2일 3시간] |
| 정보 확인 | [확인됨/미확인] |

## 2. 매매 현황
### 진입
| 항목 | 내용 |
|------|------|
| 평균 매수가 | [원 단위 콤마 표기] |
| 수량 | [수량] |
| 총 매수금액 | [원 단위 콤마 표기] |

### 현재 평가
| 항목 | 내용 |
|------|------|
| 평가손익 | [profit_loss] |
| 수익률 | [profit_rate]% |

### 청산
청산 데이터가 없으면 "청산 전"만 표기. 있으면:
| 항목 | 내용 |
|------|------|
| 평균 매도가 | [가격] |
| 청산금액 | [금액] |
| 실현손익 | [금액] |
| 수익률 | [%] |

## 3. 매매계획 및 실행
### 매수 계획
| 단계 | 가격 | 수량 | 상태 |
|------|------|------|------|
| 1차 | [가격] | [수량] | 완료/대기 |

### 익절 계획
| 단계 | 가격 | 수량 | 상태 |
|------|------|------|------|
| TP1 | [가격] | [수량] | 완료/대기 |

### 손절 계획
| 단계 | 가격 | 수량 | 상태 |
|------|------|------|------|
| SL1 | [가격] | [수량] | 완료/대기 |

계획 데이터가 비어있으면 해당 표 대신 "미설정" 한 줄만 표기.

## 4. 요청 이력
| 일시 | 요청자 | 유형 | 가격 | 수량 | 상태 | 메모 |
|------|--------|------|------|------|------|------|
| [created_at 값] | [이름] | [유형] | [가격] | [수량] | [상태] | [메모] |

## 5. 의사결정 기록
각 노트를 번호로 구분하고 핵심 결론 + 주요 수치를 3-4줄로 요약:
**노트 1**: [핵심 결론 + 구체적 수치]
**노트 2**: [핵심 결론 + 구체적 수치]
**노트 3**: [핵심 결론 + 구체적 수치]

## 6. 토론 요약
세션별로 구분하여 기술:
### 세션 1: [제목]
- 참여: [N명], 메시지: [N개]
- 핵심 논의: [2-3줄, 주요 쟁점과 논거]
- 합의/결론: [1줄]

### 세션 2: [제목]
(동일 형식)

## 7. 종합 평가
3개 항목으로 구분하여 각 3-4문장 서술:
- **투자 근거 일관성**: 초기 투자 논리가 유지되고 있는지 평가. 의사결정 노트들의 논지 변화를 시계열로 추적. 외부 환경 변화가 논리에 미치는 영향.
- **계획 대비 실행**: 매매계획(매수/TP/SL) vs 실제 요청 이력 비교. 미실행 항목이 있다면 그 이유와 현재 상태. 데이터 불일치가 있다면 명시적으로 지적.
- **리스크 관리**: 설정된 TP/SL의 적절성 평가. 토론에서 합의된 리스크 대응 vs 현재 포지션 설정 비교. 향후 주요 모니터링 포인트.
</OUTPUT_SPEC>
```

#### {data_json} 변수 구조

`collect_position_data()` 메서드가 반환하는 JSON 구조:

```json
{
  "position": {
    "ticker": "005930",
    "ticker_name": "삼성전자",
    "market": "KOSPI",
    "status": "진행중|종료",
    "is_info_confirmed": "확인됨|미확인",
    "average_buy_price": "839,000원",
    "total_quantity": 10,
    "total_buy_amount": "8,390,000원",
    "average_sell_price": null,
    "total_sell_amount": null,
    "profit_loss": null,
    "profit_rate": null,
    "realized_profit_loss": null,
    "holding_period": "2일 3시간",
    "opened_at": "2026-02-15 14:30",
    "closed_at": null,
    "opened_by": "홍길동",
    "closed_by": null
  },
  "current_trading_plan": {
    "buy_plan": [{"price": 80000, "quantity": 5, "completed": true}],
    "take_profit_targets": [{"price": 90000, "quantity": 5, "completed": false}],
    "stop_loss_targets": [{"price": 70000, "quantity": 10, "completed": false}],
    "completed_buys": 1,
    "completed_take_profits": 0,
    "completed_stop_losses": 0
  },
  "requests": [
    {
      "type": "매수|매도",
      "status": "대기|승인|거부|토론",
      "requester": "홍길동",
      "created_at": "2026-02-15 14:30",
      "price": "80,000원",
      "quantity": 5,
      "memo": "1차 매수"
    }
  ],
  "decision_notes": [
    {
      "title": "노트 제목",
      "content": "마크다운 본문",
      "author": "홍길동",
      "created_at": "2026-02-15T14:30:00"
    }
  ],
  "trading_plan_history": [
    {
      "version": 1,
      "author": "홍길동",
      "status": "submitted|active|archived",
      "buy_plan": [],
      "take_profit_targets": [],
      "stop_loss_targets": [],
      "memo": "초기 계획",
      "created_at": "2026-02-15T14:30:00",
      "submitted_at": null
    }
  ],
  "discussions": [
    {
      "title": "세션 제목",
      "status": "active|closed",
      "message_count": 15,
      "messages": [
        {
          "type": "text|chart|system",
          "author": "홍길동",
          "content": "메시지 내용",
          "created_at": "2026-02-15T14:30:00",
          "chart_summary": {
            "candle_count": 100,
            "period": "1d",
            "first_5": [],
            "last_5": []
          }
        }
      ]
    }
  ]
}
```

#### 설정값

| 설정 | 값 | 설명 |
|------|------|------|
| `openai_model` | `gpt-5-mini` | config default |
| `openai_temperature` | `0.7` | gpt-5-mini/gpt-5-nano 제외 시 적용 |
| `report_verbosity` | `high` | Responses API verbosity |
| `report_max_tokens` | `16384` | 최대 출력 토큰 |
| `report_reasoning_effort` | `medium` | reasoning effort |

---

### 1.3 뉴스데스크 생성 프롬프트

#### system_prompt 전문

```
<ROLE>
당신은 국내 대형 증권사의 리서치센터 수석 편집자입니다. 매일 아침 브리핑 자료를 제작합니다.
독자는 펀드매니저와 트레이더로, 높은 정보 밀도와 다각적 분석을 기대합니다.
피상적인 요약이 아닌, 뉴스 간 연결고리와 투자 시사점이 담긴 분석이 목표입니다.
</ROLE>

<OUTPUT_RULES>
1. 반드시 유효한 JSON 형식으로 출력
2. 모든 필드를 빠짐없이 채울 것
3. 한국어로 작성 (해외 뉴스도 한국어로 번역/요약)
4. 투자 조언이 아닌 정보 전달 목적
5. 이모지 사용 금지
6. 마크다운 형식 사용 (###, **굵게**, > 인용블록)
7. 완성도 우선: 각 섹션이 충분한 깊이의 분석과 데이터를 포함하도록 작성. 짧은 요약보다 분석 깊이가 중요
</OUTPUT_RULES>

<NEWS_CARD_SPEC>
### 제목 (15-25자)
- 기법: 숫자, 고유명사, 동사 활용
- "누가 무엇을 했는지" 명확해야 함

### 요약 (2-3문장)
- 구조: 핵심 팩트 + 왜 중요한가

### 본문 — 4파트, 총 12-16문장
필수 구성 요소 (각 파트 소제목 ### 필수):
- ### 핵심 수치 (2-3문장): 관련 뉴스에서 추출한 구체적 수치 최소 3개, 각각 **볼드** 처리
- ### 배경과 맥락 (5-6문장, 2문단): 이 이슈의 배경, 관련 뉴스 3개 이상 교차 참조하여 하나의 서사로 연결. 시계열 비교(전일/전주/전월), 주체별 비교(국내/해외, 기관/개인)
- ### 시장 영향과 전망 (3-4문장): 관련 종목/섹터 반응, 향후 주요 일정, 모니터링 포인트
- ### 투자 시사점 (2-3문장): 펀드매니저 관점에서의 핵심 takeaway

금지사항:
- 제목/요약에 전문 용어 남발
- 요약이 본문 복사
- 단락 구분 없는 긴 텍스트
</NEWS_CARD_SPEC>

<COLUMN_SPEC>
### 제목 (20-35자)
- 호기심 자극: 질문형/주장형/대조형

### 요약 (3-4문장)
- 구조: Hook(이슈) + 논지(핵심주장) + 시사점(읽어야 할 이유)

### 본문 — 4파트, 총 30-40문장
필수 구성 요소 (각 파트 소제목 ### 필수):
- ### 도입부 — 2문단 (6-8문장): 최근 이슈로 Hook, 문제 제기, 핵심 수치 2개 이상 **볼드**. 첫 문단은 독자 관심 유도, 두 번째 문단은 수치로 뒷받침
- ### 본론1: 현황 분석 — 3문단 (10-12문장): 데이터 4개 이상, 시계열/주체별/섹터별 비교. 관련 뉴스 4개 이상 교차 참조하여 하나의 맥락으로 연결. 각 문단은 독립적 관점 제시
- ### 본론2: 리스크와 기회 — 3문단 (10-12문장): 긍정 요인 3개 + 부정 요인 3개를 구체적 뉴스 근거와 함께. 다른 섹터/이슈와의 상호작용 분석. 한 문단씩: 기회/리스크/종합
- ### 결론: 투자 시사점 — 2문단 (4-6문장): 핵심 주장 재확인, 향후 주요 이벤트 일정, 모니터링 포인트 3개

금지사항:
- 요약이 본문과 동일
- 도입부 장황한 배경 설명
- 데이터 없는 주장
- 결론에 새로운 내용
</COLUMN_SPEC>

<COLUMN_EXAMPLE>
아래는 국내 칼럼의 참고 예시입니다. 이 정도 깊이와 분량을 모든 칼럼에 적용하세요.

### 반도체 훈풍 속 숨겨진 변수, 공급망 재편의 승자는?

엔비디아의 4분기 실적이 시장 예상치를 **15% 상회**하면서 글로벌 반도체 업종에 다시 한번 훈풍이 불고 있다. 특히 HBM(고대역폭 메모리) 수요가 **전년 대비 3.2배** 증가할 것이라는 전망이 나오면서, 관련 국내 기업들의 주가도 동반 상승세를 보이고 있다. 그러나 이 훈풍의 이면에는 공급망 재편이라는 구조적 변화가 진행 중이며, 모든 참여자가 동등한 수혜를 받는 것은 아니다.

전일 코스피 반도체 업종 지수는 **2.7% 상승**하며 52주 신고가를 경신했다. SK하이닉스는 **4.3% 급등**하며 시가총액 2위 자리를 굳건히 했고, 삼성전자도 **1.8% 상승**하며 8만원 선을 회복했다. 한미반도체, 이수페타시스 등 후공정 장비·소재주도 **3-7% 대의 상승률**을 기록했다.

### 본론1: 현황 분석

이번 랠리의 직접적 도화선은 엔비디아의 실적 발표였다. 4분기 매출 **$22.1B(약 29조원)**은 컨센서스 대비 15% 상회했으며, AI 데이터센터 매출만 **$18.4B**으로 전체의 83%를 차지했다. 젠슨 황 CEO는 실적 발표에서 "2025년 HBM 수요가 공급을 초과하는 상황이 지속될 것"이라고 밝혔다. 이 발언은 메모리 반도체 업체들에 직접적인 호재로 작용했다.

국내 반도체 수출도 견조한 흐름을 이어가고 있다. 1월 반도체 수출액은 **$13.2B**으로 전년 동기 대비 **42% 증가**했으며, 이 중 메모리 반도체가 **67%**를 차지했다. 특히 HBM 관련 수출이 전체 메모리 수출의 **약 28%**까지 비중이 확대된 것으로 추정된다. 산업통상자원부에 따르면 반도체는 12개월 연속 수출 증가세를 기록 중이다.

외국인 투자자들의 반도체 업종 매수세도 두드러진다. 외국인은 이번 주에만 SK하이닉스를 **2,847억원**, 삼성전자를 **1,523억원** 순매수했다. 특히 블랙록과 뱅가드 등 글로벌 패시브 펀드들이 한국 반도체 비중을 확대하고 있다는 분석이 나온다. 반면 개인 투자자는 차익 실현에 나서며 **3,200억원 이상**을 순매도했다.

### 본론2: 리스크와 기회

긍정적 측면에서는 세 가지 구조적 동력이 확인된다. 첫째, AI 학습 및 추론 수요의 폭발적 증가로 HBM 시장이 2025년 **$25B** 규모로 성장할 전망이다. 둘째, TSMC의 CoWoS 패키징 증설이 본격화되면서 하반기 병목이 해소될 가능성이 높아졌다. 셋째, 삼성전자의 HBM3E 12단 양산이 1분기 중 시작되면 SK하이닉스의 독점 구도가 완화되며 전체 시장 파이가 커질 수 있다.

반면 리스크 요인도 무시할 수 없다. 미·중 반도체 규제 강화 가능성이 상존한다. 바이든 행정부가 도입한 대중 수출 통제가 트럼프 2기에서 더 확대될 수 있다는 관측이 나온다. 또한 범용 DRAM 가격은 1분기 **-8~10%** 하락이 예상되며, HBM 호황이 전통 메모리 약세를 상쇄하지 못할 수 있다. 마지막으로, 현재 반도체 업종 PBR이 SK하이닉스 **2.8배**, 삼성전자 **1.4배**로 역사적 고점에 근접해 밸류에이션 부담이 존재한다.

종합하면, HBM 중심의 구조적 성장은 분명하지만 종목별 차별화가 심화될 것으로 보인다. 후공정 장비·소재 기업들은 수혜가 직접적인 반면, 범용 메모리 의존도가 높은 기업들은 상대적으로 부진할 수 있다. 포트폴리오 내 반도체 비중 확대 시 밸류체인 내 위치를 면밀히 검토해야 한다.

### 결론: 투자 시사점

반도체 업종의 AI 수혜는 구조적이며, 단기 조정이 있더라도 중장기 성장 궤도는 유효하다. 다만, "반도체면 다 오른다"는 일괄적 접근보다는 HBM·후공정 밸류체인 중심의 선별 투자가 필요한 시점이다.

향후 모니터링 포인트는 세 가지다. **2/28 삼성전자 HBM3E 품질 테스트 결과** 발표, **3월 TSMC 월간 매출** 공시, 그리고 **엔비디아 GTC 2025(3/17)** 기조연설에서의 차세대 GPU 발표다. 이 세 이벤트가 상반기 반도체 섹터의 방향을 결정할 핵심 변수가 될 것이다.
</COLUMN_EXAMPLE>

<TOP_STOCKS_SPEC>
### detail — 4파트, 총 15-20문장
필수 구성 요소 (각 파트 소제목 ### 필수):
- ### 왜 주목받나 (3-4문장): 오늘 화제가 된 이유, 핵심 수치 **볼드**, 관련 이벤트 설명
- ### 주요 언급 내용 — 2문단 (6-8문장): 관련 뉴스 3개 이상 교차 참조. 첫 문단은 긍정 뉴스, 두 번째 문단은 리스크/우려. 각 뉴스의 핵심 내용 정리
- ### 종목 기본 정보 (2-3문장): 시가총액, 업종, 주요 사업, 최근 실적
- ### 시장 반응과 투자 시사점 (4-5문장): 가격 변동, 거래량, 기관/외국인 수급, 향후 주요 이벤트, 투자 관점 핵심 포인트
</TOP_STOCKS_SPEC>

<SENTIMENT_SPEC>
## 탐욕/공포 감성 분석
- CNN Fear & Greed Index에서 영감을 받은 시장 심리 지표

### 점수 기준
- **0-25 (극도의 공포)**: 폭락, 패닉셀, 금융위기, 대규모 손실
- **25-45 (공포)**: 하락세, 불안, 리스크 부각, 매도 우위
- **45-55 (중립)**: 관망세, 혼조세, 방향성 모호
- **55-75 (탐욕)**: 상승세, 호재, 투자 심리 개선, 매수 우위
- **75-100 (극도의 탐욕)**: 급등, 과열, FOMO, 거품 우려

### 키워드별 greed_score 판단
- 상승/호재/성장/투자확대 → 0.6-1.0
- 하락/악재/위축/리스크 → 0.0-0.4
- 중립/혼조/관망 → 0.4-0.6

### 카테고리 분류
금융/테크/에너지/소비재/부동산/가상화폐/매크로
</SENTIMENT_SPEC>

<QUALITY_CHECKLIST>
출력 전 확인:
- 각 뉴스 카드 본문에 구체적 수치가 최소 3개 있는가?
- 각 칼럼 본론에 관련 뉴스 교차 참조가 최소 4개 있는가?
- 각 주목종목에 관련 뉴스가 3개 이상 참조되었는가?
- 모든 핵심 수치에 **볼드** 처리가 되었는가?
- 소제목(###)으로 파트가 명확히 구분되었는가?
- 어제 제목 리스트가 제공되면 동일/유사 제목 피했는가?
- 각 칼럼 본문이 4파트 × 2-3문단 = 총 10문단 이상인가?
- 각 뉴스 카드 본문이 4파트 총 12문장 이상인가?
- 각 주목종목 상세가 4파트 총 15문장 이상인가?
- 뒤쪽 항목(카드 4-6, 칼럼 2, 종목 2-3)이 앞쪽과 동일한 깊이인가?
</QUALITY_CHECKLIST>
```

#### user_prompt 템플릿

```
<TASK>
# 뉴스데스크 콘텐츠 생성 요청
**날짜**: {target_date.strftime('%Y년 %m월 %d일')}
</TASK>
{duplicate_warning}
<SOURCE_NEWS>
{news_text}
</SOURCE_NEWS>

<OUTPUT_FORMAT>

```json
{
  "columns": [
    {
      "id": 1,
      "title": "AI 칼럼 제목 (20-35자, 호기심 자극)",
      "summary": "썸네일용 요약 (3-4문장)",
      "content": "심층 분석 내용 (4파트 30-40문장, 마크다운, 소제목 ### 필수)",
      "category": "AI칼럼",
      "keywords": ["키워드1", "키워드2"],
      "sentiment": "positive|negative|neutral"
    }
  ],
  "news_cards": [
    {
      "id": 1,
      "title": "뉴스 제목 (15-25자)",
      "summary": "요약 (2-3문장)",
      "content": "상세 내용 (4파트 12-16문장, 마크다운, 소제목 ### 필수)",
      "source": "출처",
      "category": "국내|해외",
      "keywords": ["키워드1"],
      "sentiment": "positive|negative|neutral"
    }
  ],
  "keywords": [
    {
      "keyword": "반도체",
      "count": 15,
      "greed_score": 0.75,
      "category": "테크",
      "top_greed": ["HBM 수주 확대", "엔비디아 협력"],
      "top_fear": ["공급 과잉 우려"]
    }
  ],
  "sentiment": {
    "greed_ratio": 0.65,
    "fear_ratio": 0.35,
    "overall_score": 65,
    "top_greed": ["반도체 호황", "실적 개선", "AI 투자 확대"],
    "top_fear": ["금리 인상", "환율 불안"]
  },
  "top_stocks": [
    {
      "rank": 1,
      "ticker": "005930",
      "name": "삼성전자",
      "market": "KRX",
      "price_change": 2.3,
      "volume": 1200000000000,
      "mention_count": 12,
      "reason": "HBM 수주 확대로 주목 (1줄 요약)",
      "detail": "종목 상세 분석 (4파트 15-20문장, 마크다운, 소제목 ### 필수)",
      "sentiment": "positive",
      "related_news": ["삼성전자 HBM3E 양산 본격화", "엔비디아 협력 확대"]
    }
  ]
}
```
</OUTPUT_FORMAT>

<REQUIREMENTS>
- columns: AI 칼럼 2개 (국내 시장 1개 + 해외 시장 1개)
  - 국내: 코스피/코스닥/국내 종목 중심, category="국내"
  - 해외: 나스닥/S&P500/미국 종목 중심, category="해외"
  - 두 칼럼은 서로 다른 뉴스 활용, 중복 방지
  - COLUMN_SPEC의 본문 목표와 4파트 구성을 따를 것
- news_cards: 뉴스 카드 6개 (국내 3개 + 해외 3개)
  - NEWS_CARD_SPEC의 본문 목표와 4파트 구성을 따를 것
- keywords: 상위 키워드 8-12개
  - greed_score: 0.0(극도의 공포) ~ 1.0(극도의 탐욕)
  - category: 금융/테크/에너지/소비재/부동산/가상화폐/매크로 등
  - top_greed/top_fear: 각 1-3개 (뉴스 기반 구체적 사유)
- sentiment: 전체 시장 탐욕/공포 지수
  - greed_ratio + fear_ratio = 1.0
  - overall_score: 0(극도의 공포) ~ 50(중립) ~ 100(극도의 탐욕)
  - top_greed/top_fear: 키워드/이슈
- top_stocks: 오늘 가장 많이 언급된 종목 3개
  - TOP_STOCKS_SPEC의 detail 목표와 4파트 구성을 따를 것
</REQUIREMENTS>

<TIME_CONTEXT>
- 뉴스 목록은 **어제 + 오늘 새벽** 기사를 모두 포함
- 각 뉴스의 [MM/DD HH:MM] 발행시간을 참고하세요
- 어제(전일) 뉴스: 장중/장후 동향, 실적 발표, 이벤트 결과
- 오늘 새벽 뉴스: 야간장 움직임, 프리마켓, 해외 시장 마감
- 칼럼 작성 시 시간 흐름을 자연스럽게 연결:
  - "어제 장 마감 후... → 오늘 새벽 미국 시장에서는..."
  - "전일 발표된 실적이... → 시간외에서 주가가..."
</TIME_CONTEXT>

아래 JSON 형식으로 출력하세요. 각 텍스트 필드(content, detail)가 위 SPEC의 문단·문장 수 목표를 반드시 충족해야 합니다. 모든 항목을 끝까지 완전히 생성하세요.
```

#### JSON 출력 스키마

위의 OUTPUT_FORMAT에 정의된 JSON 구조 참조. 핵심 필드 요약:

| 섹션 | 필드 | 타입 | 필수 |
|------|------|------|------|
| `columns[]` | id, title, summary, content, category, keywords, sentiment | object | 2개 (국내 1 + 해외 1) |
| `news_cards[]` | id, title, summary, content, source, category, keywords, sentiment | object | 6개 (국내 3 + 해외 3) |
| `keywords[]` | keyword, count, greed_score, category, top_greed, top_fear | object | 8-12개 |
| `sentiment` | greed_ratio, fear_ratio, overall_score, top_greed, top_fear | object | 1개 |
| `top_stocks[]` | rank, ticker, name, market, price_change, volume, mention_count, reason, detail, sentiment, related_news | object | 3개 |

#### 어제 제목 중복 방지 로직

1. `_get_yesterday_titles(target_date)` 메서드로 전일 뉴스데스크에서 제목 목록 조회
2. 전일 뉴스데스크가 `status == "ready"` 상태일 때만 조회
3. 조회 대상: columns 제목, news_cards 제목, top_stocks 종목명
4. user_prompt에 `{duplicate_warning}` 블록으로 주입:

```
## 중복 방지 (어제 사용된 제목들)
- 칼럼: {cols}
- 뉴스: {news}
- 주목종목: {stocks}

위 제목들과 동일하거나 유사한 제목은 피해주세요. 같은 종목이라도 다른 관점으로 작성하세요.
```

#### AI 호출 방식 (2단계 폴백)

1. **1차: Responses API** (verbosity 지원, JSON은 프롬프트로 유도)
   - `client.responses.create(model, instructions, input, text={"verbosity": verbosity}, max_output_tokens, reasoning={"effort": reasoning_effort})`
2. **2차: Chat Completions API** (폴백, `response_format={"type": "json_object"}` 강제)
   - `client.chat.completions.create(model, messages, response_format={"type": "json_object"}, max_tokens, reasoning_effort)`
3. 응답 후 `_extract_json()` 메서드로 JSON 추출:
   - 1차: 그대로 `json.loads(text)` 시도
   - 2차: ` ```json ... ``` ` 코드블록에서 추출
   - 3차: 첫 `{` ~ 마지막 `}` 구간 추출

#### 설정값

| 설정 | 값 | 설명 |
|------|------|------|
| `openai_model` | `gpt-5-mini` | config default |
| `newsdesk_verbosity` | `high` | Responses API verbosity |
| `newsdesk_max_tokens` | `32768` | 최대 출력 토큰 |
| `newsdesk_reasoning_effort` | `medium` | reasoning effort |

---

## 2. 뉴스 크롤링 키워드 전체 목록

### 2.1 카테고리별 키워드 (14개 카테고리, 총 150개)

#### core (핵심 - 매일 필수) — 10개

```
증시, 코스피, 코스닥, 나스닥, 다우지수,
금리, 환율, 달러, 실적, 어닝
```

#### finance (금융) — 19개

```
시중은행, KB금융, 신한금융, 하나금융, 우리금융,
증권사, 미래에셋, 삼성증권, NH투자증권,
카드사, 신용카드, PG 수수료,
네이버페이, 카카오페이, 토스,
생명보험, 손해보험, 퇴직연금, ETF
```

#### realestate (부동산/건설) — 15개

```
아파트, 분양, 청약, 전세, 월세,
GTX, 재개발, 재건축, 경매,
현대건설, 대림, GS건설, HDC현대산업개발,
부동산, 주택, 임대차
```

#### consumer (소비재/유통) — 13개

```
이마트, 롯데마트, CU, GS25,
쿠팡, 배달의민족, 마켓컬리,
CJ제일제당, 농심, 오뚜기,
물가, 소비심리, 유통
```

#### labor (노동/고용) — 10개

```
고용, 실업률, 임금, 최저임금,
노조, 파업, 퇴직연금, 연금개혁,
인력난, 구인난
```

#### entertainment (엔터/게임/미디어) — 10개

```
HYBE, SM, JYP, YG,
넥슨, 엔씨소프트, 크래프톤,
넷플릭스, OTT, 콘텐츠
```

#### crypto (가상화폐) — 8개

```
비트코인, 이더리움, 빗썸, 업비트, 코인베이스,
가상화폐, 암호화폐, 코인
```

#### ai_semi (AI/반도체) — 13개

```
AI 반도체, HBM, GPU, AI 에이전트,
오픈AI, 딥시크, ChatGPT,
파운드리, TSMC, ASML,
엔비디아, SK하이닉스, 삼성전자
```

#### ev_mobility (전기차/배터리/모빌리티) — 10개

```
테슬라, 전기차, 배터리, 2차전지,
BYD, 자율주행, 로보택시,
현대차, 기아, LG에너지솔루션
```

#### bio_health (바이오/헬스케어) — 8개

```
바이오, 신약, 임상, FDA 승인,
셀트리온, 삼성바이오, GLP-1, 비만치료제
```

#### energy_infra (에너지/방산/인프라) — 8개

```
원전, SMR, 태양광, 수소,
방산, 한화에어로스페이스, 조선,
데이터센터, 전력망
```

#### macro_policy (매크로/정책) — 12개

```
연준, FOMC, 파월, 금리 인하,
인플레이션, CPI, 고용지표,
중국 경기, 엔화,
금투세, 밸류업, 공매도
```

#### bigtech (빅테크/플랫폼) — 8개

```
애플, 마이크로소프트, 구글, 아마존, 메타,
네이버, 카카오, 쿠팡
```

#### events (이벤트/테마) — 9개

```
IPO, 공모주, 상장, M&A, 인수합병,
트럼프, 관세, 무역전쟁,
배당, 자사주, 주주환원
```

---

### 2.2 네이버 검색 API 호출 세부

#### URL

```
https://openapi.naver.com/v1/search/news.json
```

#### 인증 헤더

```
X-Naver-Client-Id: {NAVER_CLIENT_ID}
X-Naver-Client-Secret: {NAVER_CLIENT_SECRET}
```

(환경변수 `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`에서 로드)

#### 파라미터

| 파라미터 | 값 | 설명 |
|----------|------|------|
| `query` | 키워드 (예: "삼성전자") | 검색 키워드 |
| `display` | `10` | 키워드당 최대 10개 |
| `sort` | `"date"` | 최신순 정렬 |

#### 페이지네이션

- 페이지네이션 없음 (키워드당 1회 호출, `display=10`)
- 총 ~150개 키워드 x 10개 = 최대 1,500건 수집 후 중복 제거

#### 날짜 필터 로직

1. API 자체에는 날짜 필터 파라미터 없음
2. 응답의 `pubDate` 필드를 파싱하여 `target_date`와 일치하는 기사만 수집
3. 날짜 파싱: `email.utils.parsedate_to_datetime()` 사용
   - 네이버 형식: `"Sat, 08 Feb 2026 10:30:00 +0900"`
4. `pub_date.date() != target_date` 이면 스킵

#### 중복 제거

1. **메모리 중복 제거**: `seen_links` set으로 같은 실행 내 동일 link 스킵
2. **DB 중복 제거**: `RawNews.link == link AND RawNews.newsdesk_date == newsdesk_date` 쿼리

#### HTML 클리닝

- `<[^>]+>` 정규식으로 HTML 태그 제거
- `&quot;` → `"`, `&amp;` → `&`, `&lt;` → `<`, `&gt;` → `>` 변환

#### 아침 브리핑 수집 모드 (`collect_for_morning_briefing`)

- 2월 8일 브리핑 = 2월 7일(어제) 전체 + 2월 8일(오늘) 새벽 뉴스
- 어제 뉴스: `_collect_naver_news(yesterday, newsdesk_date=briefing_date)`
- 오늘 뉴스: `_collect_naver_news(briefing_date, newsdesk_date=briefing_date)`
- 두 날짜 모두 같은 `newsdesk_date`로 저장

---

### 2.3 yfinance 뉴스 수집 세부

#### 대상 티커 목록 (8개)

```
^GSPC, ^IXIC, AAPL, NVDA, TSLA, MSFT, GOOGL, AMZN
```

(S&P 500 지수, NASDAQ Composite 지수, 주요 빅테크 6종)

#### 수집 방식

1. `yf.Ticker(ticker_symbol).news` 호출
2. 각 티커당 최대 5개 (`news[:5]`)
3. 뉴스 데이터 구조:
   ```python
   item["content"]["title"]           # 제목
   item["content"]["canonicalUrl"]["url"]  # URL (1차)
   item["content"]["clickThroughUrl"]["url"]  # URL (2차 폴백)
   item["content"]["pubDate"]         # 발행일 (ISO format)
   item["content"]["summary"]         # 요약 (최대 500자)
   ```
4. `source="yfinance"`로 저장
5. 날짜 파싱: `datetime.fromisoformat(pub_date_str.replace("Z", "+00:00"))`
6. 아침 브리핑 모드에서도 동일하게 `newsdesk_date` 매핑

---

## 3. 외부 API 연동 세부

### 3.1 Yahoo Finance (주가 조회)

#### 한국 주식: .KS → .KQ 폴백 로직

```
1. yahoo_ticker = f"{ticker}.KS"   (KOSPI 시도)
2. price = yf.Ticker(yahoo_ticker).fast_info.get("lastPrice")
3. if price is None:
   yahoo_ticker = f"{ticker}.KQ"   (KOSDAQ 시도)
   price = yf.Ticker(yahoo_ticker).fast_info.get("lastPrice")
```

- 동일 로직이 `get_korean_price()`, `_lookup_korean()`, `_get_korean_candles()`에서 반복 사용
- 비동기 래핑: `asyncio.get_event_loop().run_in_executor(None, sync_function)`

#### 미국 주식: 직접 조회

```python
stock = yf.Ticker(ticker)  # 예: "AAPL"
price = stock.fast_info.get("lastPrice") or stock.fast_info.get("regularMarketPrice")
```

#### 종목 정보 조회 (`_fetch_yfinance_info`)

```python
stock = yf.Ticker(ticker)
info = stock.info                    # 전체 정보
fast_info = stock.fast_info          # 빠른 조회
name = info.get("shortName") or info.get("longName") or ticker
price = fast_info.get("lastPrice") or fast_info.get("regularMarketPrice")
```

반환: `{"ticker": ticker, "name": name, "price": float(price)}`

#### 캔들 데이터 타임프레임 매핑

| 입력 timeframe | yfinance interval | period (기본) | period (before 있을 때) |
|---------------|-------------------|---------------|------------------------|
| `1d`, `day` | `1d` | `1y` | `max` |
| `1w`, `week` | `1wk` | `5y` | `max` |
| `1M`, `month` | `1mo` | `max` | `max` |
| `1h`, `hour` | `1h` | `2mo` | `2mo` |
| 기타 | `1d` | `1y` | `2y` |

#### 버그 보정 (Low=0 보정)

Yahoo Finance의 진행 중인 주봉/월봉에서 Low가 0으로 반환되는 버그 대응:

```python
# Low가 0이거나 Open/Close 최솟값의 10% 미만이면 보정
if low_price <= 0 or low_price < min(open_price, close_price) * 0.1:
    low_price = min(open_price, close_price)

# High가 0이면 보정
if high_price <= 0:
    high_price = max(open_price, close_price)
```

#### 캐시 전략 (1분)

```python
_cache: Dict[str, tuple[Decimal, datetime]] = {}
_cache_duration = timedelta(minutes=1)

# 캐시 키: "{market}:{ticker}" (예: "KOSPI:005930")
# 캐시 적중 조건: datetime.now() - cached_at < 1분
```

- 캐시는 클래스 변수 (싱글톤 `price_service` 인스턴스에서 공유)
- 캔들 데이터에는 캐시 적용 없음

#### Lazy Loading (before 파라미터)

- 캔들 조회에 `before` (Unix timestamp) 파라미터 지원
- `before` 이전 데이터만 필터링하여 과거 데이터 무한 스크롤 구현
- yfinance에서는 `period="max"`로 전체 요청 후 클라이언트 필터링

---

### 3.2 Binance API (암호화폐)

#### 시세 조회

- **URL**: `https://api.binance.com/api/v3/ticker/price`
- **파라미터**: `{"symbol": "BTCUSDT"}`
- **심볼 변환**: ticker가 "USDT"로 끝나지 않으면 자동 추가
  ```python
  symbol = ticker.upper()
  if not symbol.endswith("USDT"):
      symbol = f"{symbol}USDT"
  ```
- **응답 파싱**: `data.get("price", "0")` → `Decimal(price_str)`
- **HTTP 클라이언트**: `httpx.AsyncClient` (비동기)

#### 암호화폐 이름 매핑 (시세 조회용)

```python
crypto_names = {
    "BTC": "비트코인",
    "ETH": "이더리움",
    "XRP": "리플",
    "SOL": "솔라나",
    "DOGE": "도지코인",
    "ADA": "에이다",
    "AVAX": "아발란체",
    "MATIC": "폴리곤",
    "DOT": "폴카닷",
    "LINK": "체인링크"
}
```

#### 캔들 조회

- **URL**: `https://api.binance.com/api/v3/klines`
- **파라미터**:

| 파라미터 | 값 | 설명 |
|----------|------|------|
| `symbol` | `"BTCUSDT"` | USDT 페어 |
| `interval` | `"1d"` 등 | 아래 매핑 참조 |
| `limit` | `min(limit, 1000)` | 최대 1000개 |
| `endTime` | `before * 1000` | before가 있을 때만 (ms 단위) |

- **타임프레임 변환 매핑**:

```python
interval_map = {
    "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m",
    "1h": "1h", "4h": "4h", "1d": "1d", "day": "1d",
    "1w": "1w", "week": "1w", "1M": "1M", "month": "1M"
}
```

- **타임아웃**: 10초
- **응답 파싱**: Binance klines 배열 구조
  ```python
  # item[0]: Open time (ms) → time: int(item[0] / 1000)
  # item[1]: Open → open: float
  # item[2]: High → high: float
  # item[3]: Low → low: float
  # item[4]: Close → close: float
  # item[5]: Volume → volume: float
  ```

#### 에러 처리

- 모든 Binance API 호출은 try/except로 감싸짐
- 에러 시 `print()` 로깅 후 `None` 반환
- HTTP 상태 코드 200이 아니면 `None` 반환

---

### 3.3 네이버 검색 API

(크롤링 섹션 2.2와 동일 — 뉴스 크롤링에서만 사용)

- **URL**: `https://openapi.naver.com/v1/search/news.json`
- **인증 헤더**:
  - `X-Naver-Client-Id`: 환경변수 `NAVER_CLIENT_ID`
  - `X-Naver-Client-Secret`: 환경변수 `NAVER_CLIENT_SECRET`
- **파라미터**:
  - `query`: 검색 키워드
  - `display`: 10 (결과 수)
  - `sort`: `"date"` (최신순)
- **타임아웃**: 10초
- **응답 파싱**:
  ```python
  data = response.json()
  for item in data.get("items", []):
      title = item.get("title", "")        # HTML 태그 포함
      description = item.get("description", "")  # HTML 태그 포함
      link = item.get("link", "")           # 원문 URL
      pubDate = item.get("pubDate")         # RFC 2822 형식
  ```

---

### 3.4 한국투자증권 KIS API

- **config에 키 정의됨**: `kis_app_key`, `kis_app_secret` (둘 다 빈 문자열 기본값)
- **실제 사용 여부**: **미사용**
  - config에 설정 필드만 존재하고, 코드에서 `kis_app_key`/`kis_app_secret`를 참조하는 서비스 로직 없음
  - `price_service.py` 주석에 "한국 주식: 한국투자증권 API"라 언급되어 있지만, 실제로는 Yahoo Finance (.KS/.KQ) 사용
  - 향후 KIS API로 전환을 위한 예약 필드로 추정

---

## 4. 종목 검색 세부

### 4.1 한국 주식 (PyKRX)

#### 데이터 로드 방식

```python
from pykrx import stock as pykrx_stock

today = datetime.now().strftime("%Y%m%d")

# KOSPI 종목 조회
kospi_tickers = pykrx_stock.get_market_ticker_list(today, market="KOSPI")
for ticker in kospi_tickers:
    name = pykrx_stock.get_market_ticker_name(ticker)

# KOSDAQ 종목 조회
kosdaq_tickers = pykrx_stock.get_market_ticker_list(today, market="KOSDAQ")
for ticker in kosdaq_tickers:
    name = pykrx_stock.get_market_ticker_name(ticker)
```

- 동기 라이브러리를 `run_in_executor`로 비동기 래핑
- 30초 타임아웃 (`asyncio.wait_for`)
- `threading.Lock`으로 동시 로드 방지

#### 24시간 캐시

```python
_korean_cache_time: Optional[datetime] = None

# 캐시 유효 조건
if datetime.now() - self._korean_cache_time < timedelta(hours=24):
    return  # 스킵
```

- 캐시 데이터: `_korean_stocks` (Dict[str, str]: {ticker: name}), `_korean_stocks_list` (List[Dict])
- 서버 시작 시 `startup_event()`에서 미리 로드

#### 검색 점수 체계

| 조건 | 점수 | 설명 |
|------|------|------|
| 티커 정확 매칭 | 100 | `ticker == query_upper` |
| 이름 정확 매칭 | 95 | `name == query` |
| 티커 시작 매칭 | 90 | `ticker.startswith(query_upper)` |
| 이름 시작 매칭 | 85 | `name.startswith(query)` |
| 이름 포함 | 70 | `query in name` |
| 퍼지 매칭 (60점 이상) | `fuzzy_score * 0.6` | `fuzz.partial_ratio >= 60` |

---

### 4.2 미국 주식 인기 종목 정적 리스트 (25개)

| # | Ticker | Name | Market |
|---|--------|------|--------|
| 1 | AAPL | Apple Inc. | NASDAQ |
| 2 | MSFT | Microsoft Corporation | NASDAQ |
| 3 | GOOGL | Alphabet Inc. | NASDAQ |
| 4 | AMZN | Amazon.com Inc. | NASDAQ |
| 5 | NVDA | NVIDIA Corporation | NASDAQ |
| 6 | META | Meta Platforms Inc. | NASDAQ |
| 7 | TSLA | Tesla Inc. | NASDAQ |
| 8 | AMD | Advanced Micro Devices | NASDAQ |
| 9 | NFLX | Netflix Inc. | NASDAQ |
| 10 | INTC | Intel Corporation | NASDAQ |
| 11 | JPM | JPMorgan Chase & Co. | NYSE |
| 12 | V | Visa Inc. | NYSE |
| 13 | JNJ | Johnson & Johnson | NYSE |
| 14 | WMT | Walmart Inc. | NYSE |
| 15 | PG | Procter & Gamble | NYSE |
| 16 | MA | Mastercard Inc. | NYSE |
| 17 | UNH | UnitedHealth Group | NYSE |
| 18 | HD | Home Depot Inc. | NYSE |
| 19 | DIS | Walt Disney Company | NYSE |
| 20 | BAC | Bank of America | NYSE |
| 21 | COST | Costco Wholesale | NASDAQ |
| 22 | AVGO | Broadcom Inc. | NASDAQ |
| 23 | ADBE | Adobe Inc. | NASDAQ |
| 24 | CRM | Salesforce Inc. | NYSE |
| 25 | ORCL | Oracle Corporation | NYSE |

- 인기 종목에서 5개 미만 매칭 시 `yf.Search(query, max_results=10)` 폴백
- yfinance 검색 10초 타임아웃
- EQUITY 타입만 필터, 미국 거래소만 (NYQ/NYSE → NYSE, NMS/NGM/NASDAQ → NASDAQ)

---

### 4.3 암호화폐 정적 리스트 (20개)

| # | Ticker | Name | Market |
|---|--------|------|--------|
| 1 | BTC | 비트코인 (Bitcoin) | CRYPTO |
| 2 | ETH | 이더리움 (Ethereum) | CRYPTO |
| 3 | XRP | 리플 (Ripple) | CRYPTO |
| 4 | SOL | 솔라나 (Solana) | CRYPTO |
| 5 | DOGE | 도지코인 (Dogecoin) | CRYPTO |
| 6 | ADA | 에이다 (Cardano) | CRYPTO |
| 7 | AVAX | 아발란체 (Avalanche) | CRYPTO |
| 8 | DOT | 폴카닷 (Polkadot) | CRYPTO |
| 9 | MATIC | 폴리곤 (Polygon) | CRYPTO |
| 10 | LINK | 체인링크 (Chainlink) | CRYPTO |
| 11 | UNI | 유니스왑 (Uniswap) | CRYPTO |
| 12 | ATOM | 코스모스 (Cosmos) | CRYPTO |
| 13 | LTC | 라이트코인 (Litecoin) | CRYPTO |
| 14 | BCH | 비트코인캐시 (Bitcoin Cash) | CRYPTO |
| 15 | NEAR | 니어 프로토콜 (NEAR Protocol) | CRYPTO |
| 16 | APT | 앱토스 (Aptos) | CRYPTO |
| 17 | ARB | 아비트럼 (Arbitrum) | CRYPTO |
| 18 | OP | 옵티미즘 (Optimism) | CRYPTO |
| 19 | INJ | 인젝티브 (Injective) | CRYPTO |
| 20 | SUI | 수이 (Sui) | CRYPTO |

---

### 4.4 퍼지 검색 (rapidfuzz) 설정

```python
from rapidfuzz import fuzz, process

# 사용 함수: fuzz.partial_ratio
fuzzy_score = fuzz.partial_ratio(query_lower, name.lower())

# 임계값: 60점 이상이면 후보에 포함
if fuzzy_score >= 60:
    score = fuzzy_score * 0.6  # 0.6 가중치 적용 (최대 60점)
```

- 한국 주식, 미국 주식, 암호화폐 모두 동일 로직
- `process` 모듈은 import되어 있으나 실제 사용하지 않음 (개별 항목별 `fuzz.partial_ratio` 사용)

---

## 5. 이메일/Push 발송 세부

### 5.1 이메일 인증 (SMTP)

#### SMTP 설정

| 설정 | 값 | 환경변수 |
|------|------|---------|
| `smtp_host` | `smtp.gmail.com` | `SMTP_HOST` |
| `smtp_port` | `587` | `SMTP_PORT` |
| `smtp_user` | `""` (빈 문자열) | `SMTP_USER` |
| `smtp_password` | `""` (빈 문자열) | `SMTP_PASSWORD` |
| `smtp_from_email` | `""` (빈 문자열) | `SMTP_FROM_EMAIL` |

- `smtp_user` 또는 `smtp_password`가 비어있으면 콘솔에 인증 코드 출력 (개발 모드)
- 실제 발송 시 `STARTTLS` 사용

#### 이메일 발송 코드

```python
msg = MIMEMultipart()
msg['From'] = settings.smtp_from_email or settings.smtp_user
msg['To'] = email
msg['Subject'] = '[펀드팀 메신저] 이메일 인증 코드'

body = f"""
안녕하세요,

펀드팀 메신저 회원가입을 위한 인증 코드입니다.

인증 코드: {code}

이 코드는 10분간 유효합니다.

감사합니다.
펀드팀 메신저
"""

msg.attach(MIMEText(body, 'plain', 'utf-8'))

with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
    server.starttls()
    server.login(settings.smtp_user, settings.smtp_password)
    server.send_message(msg)
```

- HTML 템플릿 없음 (plain text만 사용)
- 이메일 인증 코드: 6자리 숫자 (`random.choices(string.digits, k=6)`)
- 인증 유효기간: 10분 (`datetime.utcnow() + timedelta(minutes=10)`)
- 기존 미인증 코드는 새 코드 생성 시 삭제

---

### 5.2 Web Push (VAPID)

#### VAPID 설정

| 설정 | 값 | 환경변수 |
|------|------|---------|
| `vapid_public_key` | `""` | `VAPID_PUBLIC_KEY` |
| `vapid_private_key` | `""` | `VAPID_PRIVATE_KEY` |
| `vapid_claims_email` | `mailto:fund@messenger.app` | `VAPID_CLAIMS_EMAIL` |

- VAPID 키가 미설정 시 서버 시작 시 자동 생성 (`_ensure_vapid_keys()`)
  - ECDSA P-256 키 쌍 생성 (cryptography 라이브러리)
  - base64url 인코딩 (no padding)
  - 콘솔에 키 출력 + 런타임 임시 설정

#### 페이로드 구조

```json
{
  "title": "알림 제목",
  "body": "알림 본문",
  "url": "/",
  "notification_type": "request|decision|chat|...",
  "related_type": "position|discussion|...",
  "related_id": 123,
  "tag": "fm-{notification_type}"
}
```

- `tag`: 미제공 시 `f"fm-{notification_type}"`으로 자동 생성

#### 발송 코드

```python
from pywebpush import webpush, WebPushException

webpush(
    subscription_info={
        "endpoint": sub.endpoint,
        "keys": {
            "p256dh": sub.p256dh,
            "auth": sub.auth,
        },
    },
    data=payload,  # JSON 문자열
    vapid_private_key=settings.vapid_private_key,
    vapid_claims={"sub": settings.vapid_claims_email},
)
```

- 사용자의 모든 기기(구독)에 순차 발송
- VAPID 키 미설정 시 발송 스킵 (`return`)

#### 만료 구독 자동 정리 로직

```python
expired_endpoints = []

for sub in subscriptions:
    try:
        webpush(...)
    except WebPushException as e:
        if hasattr(e, 'response') and e.response is not None:
            status = e.response.status_code
            if status in (404, 410):  # Not Found 또는 Gone
                expired_endpoints.append(sub.endpoint)

# 배치 삭제
if expired_endpoints:
    self.db.query(PushSubscription).filter(
        PushSubscription.endpoint.in_(expired_endpoints)
    ).delete(synchronize_session=False)
    self.db.commit()
```

- HTTP 404 (Not Found) 또는 410 (Gone) 응답 시 구독 만료로 판단
- 발송 루프 완료 후 일괄 삭제

#### 구독 관리

- **구독 등록** (`subscribe`): 같은 endpoint면 업데이트 (user_id, p256dh, auth 갱신)
- **구독 해제** (`unsubscribe`): user_id + endpoint 매칭으로 삭제
- **구독 조회** (`get_subscriptions`): user_id 기준 전체 구독 목록

---

## 6. 서버 설정 세부

### 6.1 CORS 설정

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost",
        "http://localhost:5173",
        "http://localhost:3000",
        "https://fundmessage.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)
```

| 설정 | 값 |
|------|------|
| `allow_origins` | localhost, localhost:5173, localhost:3000, fundmessage.vercel.app |
| `allow_credentials` | True |
| `allow_methods` | GET, POST, PUT, PATCH, DELETE, OPTIONS |
| `allow_headers` | `*` (전체 허용) |

---

### 6.2 Static Files (업로드 디렉토리)

- 현재 코드에서 Static Files 마운트 없음
- 파일 업로드 관련 미들웨어/마운트 없음

---

### 6.3 Lifespan (시작/종료 이벤트)

#### Startup (`@app.on_event("startup")`)

실행 순서:

1. **스케줄러 초기화**: `init_scheduler()` — APScheduler 시작
2. **VAPID 키 확인/생성**: `_ensure_vapid_keys()` — 미설정 시 ECDSA P-256 키 쌍 자동 생성
3. **PushSubscription 모델 import**: 테이블 생성 보장
4. **DB 테이블 생성**: `Base.metadata.create_all(bind=engine)` (2차 실행, Push 테이블 포함)
5. **뉴스데스크 시드 데이터 임포트**: `_seed_newsdesk_data()`
   - `seed_data/newsdesk_seed.json` 파일에서 NewsDesk + RawNews 레코드 임포트
   - DB에 해당 날짜 데이터가 이미 있으면 스킵
6. **한국 종목 목록 미리 로드**: `stock_search_service.load_korean_stocks()`
   - PyKRX를 사용하여 KOSPI + KOSDAQ 전 종목 로드
   - 첫 검색 시 지연 방지 목적

참고: DB 테이블 생성은 파일 최상단 `Base.metadata.create_all(bind=engine)`에서도 1차 실행됨

#### Shutdown (`@app.on_event("shutdown")`)

1. **스케줄러 종료**: `shutdown_scheduler()`

---

### 6.4 Middleware

- **CORS Middleware**: 위 6.1 참조
- 추가 커스텀 미들웨어 없음

#### WebSocket 엔드포인트

```python
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
```

- 토큰 인증: `decode_token(token)` → `payload.type == "access"` 확인
- 연결 관리: `manager.connect(websocket, user_id)` / `manager.disconnect(websocket, user_id)`
- 메시지 처리: `handle_websocket_message(websocket, message, user_id, manager, db)`
- DB 세션: 각 메시지마다 새 DB 세션 생성/종료

#### API 라우터 마운트

```python
app.include_router(api_router, prefix="/api/v1")
```

#### Health Check

```python
@app.get("/health")
async def health_check():
    return {"status": "healthy"}
```

---

## 부록: 설정 전체 목록 (config.py)

```python
class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://postgres:123580@localhost:5432/fundmessenger"

    # JWT
    secret_key: str = ""
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 30

    # SMTP
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""

    # KIS API (미사용)
    kis_app_key: str = ""
    kis_app_secret: str = ""

    # OpenAI API
    openai_api_key: str = ""
    openai_model: str = "gpt-5-mini"
    openai_temperature: float = 0.7

    # 뉴스데스크 AI 설정
    newsdesk_verbosity: str = "high"
    newsdesk_max_tokens: int = 32768
    newsdesk_reasoning_effort: str = "medium"

    # 의사결정서 AI 설정
    decision_verbosity: str = "medium"
    decision_max_tokens: int = 16384
    decision_reasoning_effort: str = "medium"

    # 운용보고서 AI 설정
    report_verbosity: str = "high"
    report_max_tokens: int = 16384
    report_reasoning_effort: str = "medium"

    # Web Push (VAPID)
    vapid_public_key: str = ""
    vapid_private_key: str = ""
    vapid_claims_email: str = "mailto:fund@messenger.app"

    # Environment
    environment: str = "development"

    class Config:
        env_file = ".env"
        extra = "ignore"
```
