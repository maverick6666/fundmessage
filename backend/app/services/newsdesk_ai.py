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

        response = self.client.chat.completions.create(
            model="gpt-5-mini",
            messages=[
                {"role": "system", "content": self._get_system_prompt()},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
        )

        content = response.choices[0].message.content
        result = json.loads(content)

        return result

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
        return """당신은 금융 뉴스 분석 전문가입니다. 주어진 뉴스 목록을 분석하여 뉴스데스크 콘텐츠를 생성합니다.

## 출력 규칙
1. 반드시 유효한 JSON 형식으로 출력
2. 모든 필드를 빠짐없이 채울 것
3. 한국어로 작성 (해외 뉴스도 한국어로 번역/요약)
4. 투자 조언이 아닌 정보 전달 목적임을 명심
5. 이모지 사용 금지
6. 마크다운 형식 사용 (###, **굵게**, > 인용블록 등)

---

## 뉴스 카드 작성 가이드

### UX 구조
- **메인 화면**: 제목 + 요약만 노출 (3초 안에 핵심 파악)
- **뷰어 모드**: 클릭 후 전체 본문 (2-3분 읽기)

### 제목 (15-25자)
- 역할: 관심 끌기 (Attention Grabbing)
- 기법: 숫자, 고유명사, 동사 활용
- 좋은 예: "SK하이닉스, HBM3E 12단 업계 최초 양산"
- 나쁜 예: "반도체 업계 소식" (너무 일반적)
- 체크: 제목만 봐도 "누가 무엇을 했는지" 명확한가?

### 요약 (100-150자, 2-3문장)
- 역할: 뉴스 가치 전달 (클릭 여부 결정)
- 구조: 핵심 팩트 + 왜 중요한가
- 좋은 예: "SK하이닉스가 HBM3E 12단 제품 양산을 시작했다. 기존 대비 용량 50% 증가하며 AI 반도체 시장 선점에 나섰다."
- 나쁜 예: "SK하이닉스가 신제품을 출시했다. 업계의 주목을 받고 있다." (구체성 부족)

### 본문 (800-1,200자)
- 역할: 상세 정보 제공
- 구조:
  1. 도입 (150자): 핵심 재확인 + 맥락
  2. 전개 (600자): 구체적 수치, 배경, 비교
  3. 마무리 (150자): 시장 반응, 향후 일정
- 단락을 3-4개로 나눠 가독성 확보
- 최소 3개 이상의 구체적 수치 포함

### 금기사항
- 제목/요약에 전문 용어 남발 금지
- 요약이 본문 복사 금지
- 단락 구분 없는 긴 텍스트 금지

---

## AI 칼럼 작성 가이드

### UX 구조
- **메인 화면**: 제목 + 요약 (3-5초 판단)
- **뷰어 모드**: 전체 칼럼 (5-7분 독서)

### 제목 (20-35자)
- 역할: 호기심 자극 (Curiosity Gap)
- 기법:
  - 질문형: "HBM 경쟁, 기술력보다 공급망이 승부처?"
  - 주장형: "반도체 호황, 이번엔 다르다"
  - 대조형: "삼성 vs SK하이닉스, 엇갈린 운명"

### 요약 (150-200자, 3-4문장)
- 역할: 칼럼의 핵심 주장 미리보기
- 구조: Hook(이슈) + 논지(핵심주장) + 시사점(읽어야 할 이유)

### 본문 (2,000-2,500자)
- 구조:
  1. **도입부 (300-400자)**: 최근 이슈로 Hook, 문제 제기, 논지 예고
  2. **본론1 (700-900자)**: 현황 분석, 데이터 3개+, 시계열/주체별 비교
  3. **본론2 (700-900자)**: 리스크와 기회, 긍정/부정 요인 각 3개
  4. **결론 (300-400자)**: 핵심 주장, 시사점, 향후 이벤트
- 소제목(###) 활용 권장
- 숫자와 핵심 문장은 **굵게**

### 금기사항
- 요약이 본문과 동일 금지
- 도입부 장황한 배경 설명 금지
- 데이터 없는 주장 금지
- 결론에 새로운 내용 금지

---

## 주목 종목 작성 가이드

### 구조
- **메인 화면**: 종목명, 순위, 언급횟수, 간단 사유
- **뷰어 모드**: 상세 분석 (detail 필드)

### detail (1,000자)
- 구조:
  1. **왜 주목받나 (200자)**: 오늘 화제가 된 이유
  2. **주요 언급 내용 (400자)**: 어떤 뉴스에서 어떻게 언급됐는지
  3. **종목 기본 정보 (200자)**: 시가총액, 업종, 주요 사업
  4. **시장 반응 (200자)**: 가격 변동, 거래량, 투자자 동향
- 마크다운 소제목(###) 사용
- 구체적 수치 필수

---

## 품질 체크리스트

### 메인 화면 (라이트 유저)
- 제목만 봐도 내용 감이 오는가?
- 요약 2-3문장이 명확한가?
- 3초 안에 "읽을까 말까" 판단 가능한가?

### 뷰어 모드 (클릭 후)
- 본문이 요약보다 실질적 정보를 더 제공하는가?
- 단락이 적절히 나뉘어 스크롤이 편한가?
- 읽고 나서 "시간 낭비" 느낌이 없는가?

### 중복 방지
- 어제 제목 리스트가 제공되면 동일/유사 제목 피할 것
- 키워드는 중복 허용"""

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

        return f"""# 뉴스데스크 콘텐츠 생성 요청

**날짜**: {target_date.strftime('%Y년 %m월 %d일')}
{duplicate_warning}
## 수집된 뉴스 목록
{news_text}

---

## 생성할 JSON 구조

```json
{{
  "columns": [
    {{
      "id": 1,
      "title": "AI 칼럼 제목 (20-35자, 호기심 자극)",
      "summary": "썸네일용 요약 (150-200자, 3-4문장)",
      "content": "심층 분석 내용 (2,000-2,500자, 마크다운, 소제목 ### 사용)",
      "category": "AI칼럼",
      "keywords": ["키워드1", "키워드2"],
      "sentiment": "positive|negative|neutral"
    }}
  ],
  "news_cards": [
    {{
      "id": 1,
      "title": "뉴스 제목 (15-25자)",
      "summary": "요약 (100-150자, 2-3문장)",
      "content": "상세 내용 (800-1,200자, 마크다운, 단락 구분)",
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
      "sentiment": "positive",
      "sentiment_ratio": {{"positive": 0.7, "negative": 0.2, "neutral": 0.1}}
    }}
  ],
  "sentiment": {{
    "positive_count": 25,
    "negative_count": 10,
    "neutral_count": 15,
    "positive_ratio": 0.5,
    "negative_ratio": 0.2,
    "top_positive": ["반도체 호황", "실적 개선"],
    "top_negative": ["금리 인상", "환율 불안"]
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
      "detail": "종목 상세 분석 (1,000자, 마크다운, 왜 주목받나/주요 언급/기본정보/시장반응)",
      "sentiment": "positive",
      "related_news": ["삼성전자 HBM3E 양산 본격화", "엔비디아 협력 확대"]
    }}
  ]
}}
```

## 요구사항
- columns: AI 칼럼 2개 (국내 시장 1개 + 해외 시장 1개)
  - 국내 칼럼: 코스피/코스닥/국내 종목 중심, category="국내"
  - 해외 칼럼: 나스닥/S&P500/미국 종목 중심, category="해외"
  - 두 칼럼은 서로 다른 뉴스를 활용하여 중복 내용 방지
- news_cards: 뉴스 카드 6개 (국내 3개 + 해외 3개)
- keywords: 상위 키워드 8-12개
- sentiment: 전체 시장 감성 분석
- top_stocks: 오늘 가장 많이 언급된 종목 3개

## 중요: 날짜 범위와 시간 맥락
- 뉴스 목록은 **어제 + 오늘 새벽** 기사를 모두 포함
- 각 뉴스의 [MM/DD HH:MM] 발행시간을 참고하세요
- 어제(전일) 뉴스: 장중/장후 동향, 실적 발표, 이벤트 결과
- 오늘 새벽 뉴스: 야간장 움직임, 프리마켓, 해외 시장 마감
- 칼럼 작성 시 시간 흐름을 자연스럽게 연결:
  - "어제 장 마감 후... → 오늘 새벽 미국 시장에서는..."
  - "전일 발표된 실적이... → 시간외에서 주가가..."

JSON만 출력하세요."""

    def save_newsdesk(self, target_date: date, content: Dict[str, Any], raw_news_count: int) -> NewsDesk:
        """생성된 콘텐츠를 DB에 저장"""
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
            )
            self.db.add(newsdesk)

        self.db.commit()
        self.db.refresh(newsdesk)
        return newsdesk
