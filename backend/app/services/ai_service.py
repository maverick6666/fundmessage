from datetime import date
from typing import Optional, List
from sqlalchemy.orm import Session
import openai

from app.config import settings
from app.models.team_settings import TeamSettings
from app.models.discussion import Discussion
from app.models.message import Message
from app.models.position import Position


class AIService:
    """AI 의사결정서 생성 서비스"""

    def __init__(self, db: Session):
        self.db = db
        if settings.openai_api_key:
            self.client = openai.OpenAI(api_key=settings.openai_api_key)
        else:
            self.client = None

    def _get_settings(self) -> TeamSettings:
        """팀 설정 조회 (없으면 생성)"""
        team_settings = self.db.query(TeamSettings).first()
        if not team_settings:
            team_settings = TeamSettings(
                ai_daily_limit=3,
                ai_usage_count=0,
                ai_usage_reset_date=date.today()
            )
            self.db.add(team_settings)
            self.db.commit()
            self.db.refresh(team_settings)
        return team_settings

    def get_ai_status(self) -> dict:
        """AI 사용 가능 여부 및 남은 횟수"""
        team_settings = self._get_settings()
        today = date.today()

        # 날짜가 바뀌었으면 리셋
        if team_settings.ai_usage_reset_date != today:
            team_settings.ai_usage_count = 0
            team_settings.ai_usage_reset_date = today
            self.db.commit()

        remaining = max(0, team_settings.ai_daily_limit - (team_settings.ai_usage_count or 0))

        return {
            "enabled": bool(self.client),
            "can_use": remaining > 0 and bool(self.client),
            "remaining_uses": remaining,
            "daily_limit": team_settings.ai_daily_limit,
            "used_today": team_settings.ai_usage_count or 0
        }

    def can_use_ai(self) -> bool:
        """AI 사용 가능 여부"""
        status = self.get_ai_status()
        return status["can_use"]

    def _increment_usage(self):
        """사용량 증가"""
        team_settings = self._get_settings()
        today = date.today()

        if team_settings.ai_usage_reset_date != today:
            team_settings.ai_usage_count = 1
            team_settings.ai_usage_reset_date = today
        else:
            team_settings.ai_usage_count = (team_settings.ai_usage_count or 0) + 1

        self.db.commit()

    def get_session_messages(self, session_ids: List[int]) -> str:
        """세션들의 메시지를 텍스트로 변환"""
        messages_text = []

        for session_id in session_ids:
            discussion = self.db.query(Discussion).filter(
                Discussion.id == session_id
            ).first()

            if discussion:
                messages = self.db.query(Message).filter(
                    Message.discussion_id == session_id
                ).order_by(Message.created_at).all()

                session_messages = []
                for msg in messages:
                    author = msg.user.full_name if msg.user else "알 수 없음"
                    session_messages.append(f"[{author}]: {msg.content}")

                if session_messages:
                    messages_text.append(f"=== 세션 #{session_id} ===\n" + "\n".join(session_messages))

        return "\n\n".join(messages_text)

    def generate_decision_note(
        self,
        session_ids: List[int],
        position_id: Optional[int] = None
    ) -> dict:
        """토론 세션들을 분석하여 의사결정서 생성"""
        if not self.client:
            return {
                "success": False,
                "error": "OpenAI API 키가 설정되지 않았습니다"
            }

        if not self.can_use_ai():
            return {
                "success": False,
                "error": "오늘 AI 사용 횟수를 모두 소진했습니다"
            }

        # 메시지 수집
        messages_text = self.get_session_messages(session_ids)
        if not messages_text:
            return {
                "success": False,
                "error": "선택한 세션에 메시지가 없습니다"
            }

        # 포지션 정보 추가
        position_context = ""
        if position_id:
            position = self.db.query(Position).filter(Position.id == position_id).first()
            if position:
                position_context = f"""
포지션 정보:
- 종목: {position.name or position.ticker} ({position.ticker})
- 시장: {position.market}
- 평균 매수가: {position.avg_buy_price}
- 수량: {position.quantity}
- 상태: {'보유중' if position.status == 'open' else '종료됨'}
"""

        # AI 호출
        try:
            prompt = f"""다음은 펀드팀의 투자 의사결정 토론 내용입니다. 이를 분석하여 체계적인 의사결정서를 작성해주세요.

{position_context}

토론 내용:
{messages_text}

다음 형식으로 의사결정서를 작성해주세요:

## 요약
(핵심 논의 사항 2-3문장)

## 주요 논점
1. (첫 번째 논점)
2. (두 번째 논점)
...

## 결론 및 투자 의견
(최종 의사결정 내용)

## 리스크 요인
(논의된 리스크 사항)

## 후속 조치
(필요한 후속 조치 사항)
"""

            response = self.client.chat.completions.create(
                model="gpt-4o-mini",  # 또는 gpt-4, gpt-3.5-turbo
                messages=[
                    {"role": "system", "content": "당신은 펀드팀의 투자 의사결정을 정리하는 전문가입니다. 토론 내용을 분석하여 명확하고 체계적인 의사결정서를 작성합니다."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=2000,
                temperature=0.3
            )

            content = response.choices[0].message.content

            # 사용량 증가
            self._increment_usage()

            # 남은 횟수 조회
            status = self.get_ai_status()

            return {
                "success": True,
                "content": content,
                "remaining_uses": status["remaining_uses"],
                "sessions_analyzed": len(session_ids)
            }

        except Exception as e:
            return {
                "success": False,
                "error": f"AI 생성 중 오류가 발생했습니다: {str(e)}"
            }
