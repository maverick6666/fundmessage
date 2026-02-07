# backend/app/services/newsdesk_ai.py
import json
from datetime import date
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
        """원본 뉴스를 텍스트로 변환"""
        lines = []
        for i, news in enumerate(raw_news[:50], 1):  # 최대 50개
            source_label = "국내" if news.source == "naver" else "해외"
            lines.append(f"[{i}] [{source_label}] {news.title}")
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

## 품질 기준
- 칼럼: 전문적이고 통찰력 있는 분석
- 요약: 핵심만 간결하게
- 키워드: 실제 언급된 것만 추출
- 감성: 객관적 판단"""

    def _build_prompt(self, target_date: date, news_text: str) -> str:
        return f"""# 뉴스데스크 콘텐츠 생성 요청

**날짜**: {target_date.strftime('%Y년 %m월 %d일')}

## 수집된 뉴스 목록
{news_text}

---

## 생성할 JSON 구조

```json
{{
  "columns": [
    {{
      "id": 1,
      "title": "AI 칼럼 제목 (관심을 끄는 제목)",
      "summary": "썸네일용 2-3문장 요약",
      "content": "심층 분석 내용 (500-800자, 마크다운 지원)",
      "category": "AI칼럼",
      "keywords": ["키워드1", "키워드2"],
      "sentiment": "positive|negative|neutral"
    }}
  ],
  "news_cards": [
    {{
      "id": 1,
      "title": "뉴스 제목",
      "summary": "2-3문장 요약",
      "content": "상세 내용 (300-500자)",
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
      "reason": "HBM 수주 확대로 주목",
      "detail": "상세 분석 내용 (500-800자)",
      "sentiment": "positive",
      "related_news": ["삼성전자 HBM3E 양산 본격화", "엔비디아 협력 확대"]
    }}
  ]
}}
```

## 요구사항
- columns: AI 칼럼 2개 (오늘의 시장 분석)
- news_cards: 뉴스 카드 6개 (국내 3개 + 해외 3개)
- keywords: 상위 키워드 8-12개
- sentiment: 전체 시장 감성 분석
- top_stocks: 오늘 가장 많이 언급된 종목 3개

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
