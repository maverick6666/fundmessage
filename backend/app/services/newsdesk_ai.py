# backend/app/services/newsdesk_ai.py
import json
from datetime import date, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
import openai

from app.config import settings
from app.models.newsdesk import NewsDesk, RawNews


class NewsDeskAI:
    """뉴스데스크 AI 분석 서비스"""

    def __init__(self, db: Session):
        self.db = db
        if settings.openai_api_key:
            self.client = openai.OpenAI(api_key=settings.openai_api_key)
        else:
            self.client = None

    def generate_newsdesk(self, target_date: date, raw_news: List[RawNews]) -> Dict[str, Any]:
        """뉴스데스크 콘텐츠 생성"""
        if not self.client:
            raise ValueError("OpenAI API key not configured")

        if not raw_news:
            raise ValueError("No news to analyze")

        # 뉴스 데이터 준비
        news_text = self._prepare_news_text(raw_news)

        # AI 호출
        prompt = self._build_prompt(target_date, news_text)
        system_prompt = self._get_system_prompt()

        import logging
        logger = logging.getLogger(__name__)

        raw_text = None

        # 1차: Responses API + verbosity (JSON 껍데기는 프롬프트로 유도)
        if settings.openai_verbosity:
            try:
                response = self.client.responses.create(
                    model=settings.openai_model,
                    instructions=system_prompt,
                    input=prompt,
                    text={"verbosity": settings.openai_verbosity},
                    max_output_tokens=32768,
                    reasoning={"effort": "medium"},
                )
                if response.output_text:
                    raw_text = response.output_text
                    logger.info(f"Newsdesk: Responses API 성공 (verbosity={settings.openai_verbosity})")
            except Exception as e:
                logger.warning(f"Newsdesk: Responses API 실패, Chat Completions fallback: {e}")

        # 2차: Chat Completions + response_format fallback
        if not raw_text:
            response = self.client.chat.completions.create(
                model=settings.openai_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                max_tokens=32768,
                reasoning_effort="medium",
            )
            raw_text = response.choices[0].message.content

        # 텍스트에서 JSON 추출 (모델이 앞뒤에 설명을 붙일 수 있음)
        result = self._extract_json(raw_text)
        return result

    def _extract_json(self, text: str) -> Dict[str, Any]:
        """텍스트에서 JSON 객체 추출"""
        # 먼저 그대로 파싱 시도
        try:
            return json.loads(text)
        except (json.JSONDecodeError, TypeError):
            pass

        # ```json 코드블록 안의 JSON 추출
        import re
        code_block = re.search(r'```(?:json)?\s*(\{[\s\S]*\})\s*```', text)
        if code_block:
            try:
                return json.loads(code_block.group(1))
            except json.JSONDecodeError:
                pass

        # 첫 번째 { ~ 마지막 } 사이 추출
        start = text.find('{')
        end = text.rfind('}')
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(text[start:end + 1])
            except json.JSONDecodeError:
                pass

        raise ValueError(f"JSON 추출 실패. 응답 앞 200자: {text[:200]}")

    def _prepare_news_text(self, raw_news: List[RawNews]) -> str:
        """원본 뉴스를 텍스트로 변환 (발행시간 포함)"""
        lines = []
        for i, news in enumerate(raw_news[:50], 1):  # 최대 50개
            source_label = "국내" if news.source == "naver" else "해외"
            # 발행시간 표시 (어제 vs 오늘 구분용)
            pub_time = ""
            if news.pub_date:
                pub_time = news.pub_date.strftime("%m/%d %H:%M")
            lines.append(f"[{i}] [{source_label}] [{pub_time}] {news.title}")
            if news.description:
                lines.append(f"    요약: {news.description[:200]}")
            lines.append("")
        return "\n".join(lines)

    def _get_system_prompt(self) -> str:
        return """<ROLE>
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
</QUALITY_CHECKLIST>"""

    def _get_yesterday_titles(self, target_date: date) -> Dict[str, List[str]]:
        """어제 뉴스데스크의 제목들 조회 (중복 방지용)"""
        yesterday = target_date - timedelta(days=1)

        yesterday_newsdesk = self.db.query(NewsDesk).filter(
            NewsDesk.publish_date == yesterday,
            NewsDesk.status == "ready"
        ).first()

        if not yesterday_newsdesk:
            return {"columns": [], "news_cards": [], "top_stocks": []}

        return {
            "columns": [c.get("title", "") for c in (yesterday_newsdesk.columns or [])],
            "news_cards": [n.get("title", "") for n in (yesterday_newsdesk.news_cards or [])],
            "top_stocks": [s.get("name", "") for s in (yesterday_newsdesk.top_stocks or [])]
        }

    def _build_prompt(self, target_date: date, news_text: str) -> str:
        yesterday_titles = self._get_yesterday_titles(target_date)

        duplicate_warning = ""
        if any(yesterday_titles.values()):
            cols = ", ".join(yesterday_titles["columns"]) or "없음"
            news = ", ".join(yesterday_titles["news_cards"][:5]) or "없음"
            stocks = ", ".join(yesterday_titles["top_stocks"]) or "없음"
            duplicate_warning = f"""
## 중복 방지 (어제 사용된 제목들)
- 칼럼: {cols}
- 뉴스: {news}
- 주목종목: {stocks}

위 제목들과 동일하거나 유사한 제목은 피해주세요. 같은 종목이라도 다른 관점으로 작성하세요.
"""

        return f"""<TASK>
# 뉴스데스크 콘텐츠 생성 요청
**날짜**: {target_date.strftime('%Y년 %m월 %d일')}
</TASK>
{duplicate_warning}
<SOURCE_NEWS>
{news_text}
</SOURCE_NEWS>

<OUTPUT_FORMAT>

```json
{{
  "columns": [
    {{
      "id": 1,
      "title": "AI 칼럼 제목 (20-35자, 호기심 자극)",
      "summary": "썸네일용 요약 (3-4문장)",
      "content": "심층 분석 내용 (4파트 30-40문장, 마크다운, 소제목 ### 필수)",
      "category": "AI칼럼",
      "keywords": ["키워드1", "키워드2"],
      "sentiment": "positive|negative|neutral"
    }}
  ],
  "news_cards": [
    {{
      "id": 1,
      "title": "뉴스 제목 (15-25자)",
      "summary": "요약 (2-3문장)",
      "content": "상세 내용 (4파트 12-16문장, 마크다운, 소제목 ### 필수)",
      "source": "출처",
      "category": "국내|해외",
      "keywords": ["키워드1"],
      "sentiment": "positive|negative|neutral"
    }}
  ],
  "keywords": [
    {{
      "keyword": "반도체",
      "count": 15,
      "greed_score": 0.75,
      "category": "테크",
      "top_greed": ["HBM 수주 확대", "엔비디아 협력"],
      "top_fear": ["공급 과잉 우려"]
    }}
  ],
  "sentiment": {{
    "greed_ratio": 0.65,
    "fear_ratio": 0.35,
    "overall_score": 65,
    "top_greed": ["반도체 호황", "실적 개선", "AI 투자 확대"],
    "top_fear": ["금리 인상", "환율 불안"]
  }},
  "top_stocks": [
    {{
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
    }}
  ]
}}
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

아래 JSON 형식으로 출력하세요. 각 텍스트 필드(content, detail)가 위 SPEC의 문단·문장 수 목표를 반드시 충족해야 합니다. 모든 항목을 끝까지 완전히 생성하세요."""

    def save_newsdesk(self, target_date: date, content: Dict[str, Any], raw_news_count: int) -> NewsDesk:
        """생성된 콘텐츠를 DB에 저장"""
        from datetime import datetime
        from zoneinfo import ZoneInfo

        # 한국시간으로 현재 시각
        kst = ZoneInfo("Asia/Seoul")
        now_kst = datetime.now(kst)

        # 기존 데이터 확인
        existing = self.db.query(NewsDesk).filter(
            NewsDesk.publish_date == target_date
        ).first()

        if existing:
            existing.columns = content.get("columns")
            existing.news_cards = content.get("news_cards")
            existing.keywords = content.get("keywords")
            existing.sentiment = content.get("sentiment")
            existing.top_stocks = content.get("top_stocks")
            existing.status = "ready"
            existing.raw_news_count = raw_news_count
            existing.error_message = None
            existing.generation_count = (existing.generation_count or 0) + 1
            existing.last_generated_at = now_kst
            newsdesk = existing
        else:
            newsdesk = NewsDesk(
                publish_date=target_date,
                columns=content.get("columns"),
                news_cards=content.get("news_cards"),
                keywords=content.get("keywords"),
                sentiment=content.get("sentiment"),
                top_stocks=content.get("top_stocks"),
                status="ready",
                raw_news_count=raw_news_count,
                generation_count=1,
                last_generated_at=now_kst,
            )
            self.db.add(newsdesk)

        self.db.commit()
        self.db.refresh(newsdesk)
        return newsdesk
