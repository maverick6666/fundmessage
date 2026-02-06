from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List
from sqlalchemy.orm import Session
import openai
import json

from app.config import settings
from app.models.team_settings import TeamSettings
from app.models.discussion import Discussion
from app.models.message import Message
from app.models.position import Position
from app.models.request import Request
from app.models.decision_note import DecisionNote
from app.models.trading_plan import TradingPlan
from app.models.user import User


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
- 종목: {position.ticker_name or position.ticker} ({position.ticker})
- 시장: {position.market}
- 평균 매수가: {position.average_buy_price}
- 수량: {position.total_quantity}
- 상태: {'보유중' if position.status == 'open' else '종료됨'}
"""

        # AI 호출
        try:
            system_prompt = """당신은 펀드팀의 투자 의사결정서를 작성하는 전문 애널리스트입니다.

## 역할
토론 내용을 분석하여 누가 어떤 주장을 했고, 어떤 과정을 거쳐 결론에 도달했는지를 정확하게 문서화합니다.

## 핵심 원칙
1. **정확성**: 토론에서 실제로 언급된 내용만 기록합니다. 추측하거나 창작하지 않습니다.
2. **인용**: 중요한 발언은 "발언자: 내용" 형식으로 직접 인용합니다.
3. **일관성**: 제시된 형식을 정확히 따릅니다. 섹션을 임의로 추가하거나 제거하지 않습니다.
4. **객관성**: 개인적인 평가나 의견을 넣지 않습니다. 사실만 기록합니다.
5. **완결성**: 모든 섹션을 빠짐없이 작성합니다. 해당 내용이 없으면 "논의되지 않음"으로 표기합니다.

## 출력 형식
반드시 아래 마크다운 형식을 정확히 따르세요. 형식을 변경하지 마세요."""

            prompt = f"""# 의사결정서 작성 요청

## 입력 데이터
{position_context}

### 토론 내용
{messages_text}

---

## 출력 형식 (이 형식을 정확히 따르세요)

# 투자 의사결정서

## 1. 개요
| 항목 | 내용 |
|------|------|
| 종목 | [종목명 (티커)] |
| 토론 일시 | [YYYY-MM-DD] |
| 참여자 | [참여자 목록, 쉼표로 구분] |
| 최종 결론 | [한 문장으로 요약] |

## 2. 참여자별 의견

### 2.1 [참여자명]
- **입장**: [매수/매도/관망/기타]
- **핵심 주장**: [1-2문장]
- **근거**:
  1. [근거 1]
  2. [근거 2]
- **주요 발언**: "[직접 인용]"

(토론에 참여한 모든 인원에 대해 위 형식 반복)

## 3. 토론 전개 과정

### 3.1 논의 시작
[토론이 어떻게 시작되었는지, 누가 어떤 안건을 제기했는지]

### 3.2 주요 쟁점
| 쟁점 | 찬성 측 | 반대 측 |
|------|---------|---------|
| [쟁점1] | [의견] | [의견] |
| [쟁점2] | [의견] | [의견] |

### 3.3 합의 도출
[어떤 과정을 거쳐 의견이 수렴되었는지, 누구의 의견이 어떻게 반영되었는지]

## 4. 최종 의사결정

### 4.1 결정 사항
| 구분 | 내용 |
|------|------|
| 투자 방향 | [매수/매도/관망] |
| 목표가 | [금액 또는 "논의되지 않음"] |
| 손절가 | [금액 또는 "논의되지 않음"] |
| 투자 비중 | [비중 또는 "논의되지 않음"] |

### 4.2 결정 근거
[최종 결정의 핵심 근거 2-3가지]

## 5. 리스크 및 유의사항
| 리스크 유형 | 내용 | 언급자 |
|-------------|------|--------|
| [유형] | [내용] | [이름] |

(토론에서 언급된 리스크만 기록. 없으면 "논의된 리스크 없음"으로 표기)

## 6. 후속 조치
- [ ] [조치 1]
- [ ] [조치 2]

(토론에서 합의된 후속 조치만 기록. 없으면 "합의된 후속 조치 없음"으로 표기)

---
*본 의사결정서는 토론 내용을 기반으로 AI가 정리한 초안입니다.*
"""

            # API 호출 파라미터 구성
            api_params = {
                "model": settings.openai_model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ]
            }
            # gpt-5-mini는 temperature 미지원
            if "gpt-5-mini" not in settings.openai_model:
                api_params["temperature"] = settings.openai_temperature
            # max_tokens가 0보다 크면 설정
            if settings.openai_max_tokens > 0:
                api_params["max_tokens"] = settings.openai_max_tokens

            response = self.client.chat.completions.create(**api_params)

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

    def _serialize_value(self, value):
        """값을 JSON 직렬화 가능한 형태로 변환"""
        if isinstance(value, Decimal):
            return float(value)
        if isinstance(value, datetime):
            return value.isoformat()
        if isinstance(value, date):
            return value.isoformat()
        return value

    def collect_position_data(self, position_id: int) -> dict:
        """포지션의 모든 관련 정보 수집"""
        position = self.db.query(Position).filter(Position.id == position_id).first()
        if not position:
            return None

        # 요청자/종료자 정보
        opener = self.db.query(User).filter(User.id == position.opened_by).first() if position.opened_by else None
        closer = self.db.query(User).filter(User.id == position.closed_by).first() if position.closed_by else None

        # 관련 요청들
        requests = self.db.query(Request).filter(Request.position_id == position_id).order_by(Request.created_at).all()
        requests_data = []
        for req in requests:
            requester = self.db.query(User).filter(User.id == req.requested_by).first()
            requests_data.append({
                "type": req.request_type,
                "status": req.status,
                "requester": requester.full_name if requester else "알 수 없음",
                "created_at": self._serialize_value(req.created_at),
                "buy_price": self._serialize_value(req.buy_price),
                "order_quantity": self._serialize_value(req.order_quantity),
                "memo": req.memo
            })

        # 의사결정 노트
        notes = self.db.query(DecisionNote).filter(DecisionNote.position_id == position_id).order_by(DecisionNote.created_at).all()
        notes_data = []
        for note in notes:
            author = self.db.query(User).filter(User.id == note.author_id).first()
            notes_data.append({
                "title": note.title,
                "content": note.content,
                "author": author.full_name if author else "알 수 없음",
                "created_at": self._serialize_value(note.created_at)
            })

        # 매매계획 이력
        plans = self.db.query(TradingPlan).filter(TradingPlan.position_id == position_id).order_by(TradingPlan.created_at).all()
        plans_data = []
        for plan in plans:
            author = self.db.query(User).filter(User.id == plan.user_id).first()
            plans_data.append({
                "version": plan.version,
                "author": author.full_name if author else "알 수 없음",
                "status": plan.status,
                "buy_plan": plan.buy_plan,
                "take_profit_targets": plan.take_profit_targets,
                "stop_loss_targets": plan.stop_loss_targets,
                "memo": plan.memo,
                "created_at": self._serialize_value(plan.created_at),
                "submitted_at": self._serialize_value(plan.submitted_at) if plan.submitted_at else None
            })

        # 토론 세션들
        discussions = self.db.query(Discussion).filter(Discussion.position_id == position_id).all()
        discussions_data = []
        for disc in discussions:
            messages = self.db.query(Message).filter(Message.discussion_id == disc.id).order_by(Message.created_at).all()
            msg_data = []
            for msg in messages:
                author = msg.user.full_name if msg.user else "알 수 없음"
                msg_data.append({
                    "author": author,
                    "content": msg.content,
                    "created_at": self._serialize_value(msg.created_at)
                })
            discussions_data.append({
                "title": disc.title,
                "status": disc.status,
                "messages": msg_data
            })

        # 현재 매매계획 상태
        current_buy_plan = position.buy_plan or []
        current_tp = position.take_profit_targets or []
        current_sl = position.stop_loss_targets or []

        return {
            "position": {
                "ticker": position.ticker,
                "ticker_name": position.ticker_name,
                "market": position.market,
                "status": position.status,
                "is_info_confirmed": position.is_info_confirmed,
                "average_buy_price": self._serialize_value(position.average_buy_price),
                "total_quantity": self._serialize_value(position.total_quantity),
                "total_buy_amount": self._serialize_value(position.total_buy_amount),
                "average_sell_price": self._serialize_value(position.average_sell_price),
                "total_sell_amount": self._serialize_value(position.total_sell_amount),
                "profit_loss": self._serialize_value(position.profit_loss),
                "profit_rate": self._serialize_value(position.profit_rate),
                "realized_profit_loss": self._serialize_value(position.realized_profit_loss),
                "holding_period_hours": position.holding_period_hours,
                "opened_at": self._serialize_value(position.opened_at),
                "closed_at": self._serialize_value(position.closed_at),
                "opened_by": opener.full_name if opener else None,
                "closed_by": closer.full_name if closer else None
            },
            "current_trading_plan": {
                "buy_plan": current_buy_plan,
                "take_profit_targets": current_tp,
                "stop_loss_targets": current_sl,
                "completed_buys": len([b for b in current_buy_plan if b.get("completed")]),
                "completed_take_profits": len([t for t in current_tp if t.get("completed")]),
                "completed_stop_losses": len([s for s in current_sl if s.get("completed")])
            },
            "requests": requests_data,
            "decision_notes": notes_data,
            "trading_plan_history": plans_data,
            "discussions": discussions_data
        }

    def generate_operation_report(self, position_id: int) -> dict:
        """포지션의 모든 정보를 구조화한 운용보고서 생성"""
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

        # 모든 데이터 수집
        data = self.collect_position_data(position_id)
        if not data:
            return {
                "success": False,
                "error": "포지션을 찾을 수 없습니다"
            }

        # 데이터를 JSON으로 변환
        data_json = json.dumps(data, ensure_ascii=False, indent=2)

        try:
            prompt = f"""다음은 펀드팀의 포지션에 대한 모든 정보입니다. 이 데이터를 바탕으로 체계적인 운용보고서를 작성해주세요.

**중요 규칙:**
1. 주어진 데이터만 사용하세요. 절대로 없는 정보를 만들어내지 마세요.
2. 숫자는 주어진 그대로 사용하세요. 계산이 필요하면 정확히 계산하세요.
3. 날짜, 인물, 금액 등 사실 정보는 변경하지 마세요.
4. 데이터가 없는 항목은 "해당 없음" 또는 "기록 없음"으로 표시하세요.

포지션 데이터:
```json
{data_json}
```

다음 형식으로 운용보고서를 작성해주세요:

# 운용보고서: [종목명] ([티커])

## 1. 포지션 개요
| 항목 | 내용 |
|------|------|
| 종목 | [종목명 (티커)] |
| 시장 | [시장] |
| 상태 | [진행중/종료] |
| 진입일 | [날짜] |
| 담당자 | [이름] |
| 보유기간 | [기간] |

## 2. 매매 현황
### 진입
| 항목 | 내용 |
|------|------|
| 평균 매수가 | [가격] |
| 수량 | [수량] |
| 총 매수금액 | [금액] |

### 청산 (해당 시)
| 항목 | 내용 |
|------|------|
| 평균 매도가 | [가격] |
| 청산금액 | [금액] |
| 실현손익 | [금액] |
| 수익률 | [%] |

## 3. 매매계획 및 실행
### 매수 계획
(완료된 계획과 미완료 계획 구분하여 정리)

### 익절 계획
(완료된 계획과 미완료 계획 구분하여 정리)

### 손절 계획
(완료된 계획과 미완료 계획 구분하여 정리)

## 4. 요청 이력
(누가 언제 어떤 요청을 했는지 시간순 정리)

## 5. 의사결정 기록
(의사결정 노트 내용 요약)

## 6. 토론 요약
(토론 세션별 핵심 논의 사항 정리)

## 7. 종합 평가
(전체 운용 과정에 대한 객관적 정리 - 창작하지 말고 데이터 기반으로만)
"""

            # API 호출 파라미터 구성
            api_params = {
                "model": settings.openai_model,
                "messages": [
                    {
                        "role": "system",
                        "content": """당신은 펀드팀의 운용보고서를 작성하는 전문가입니다.

## 핵심 원칙 (반드시 준수)
1. **데이터 무결성**: 주어진 데이터만 사용. 절대 정보를 창작하거나 추측하지 않음
2. **숫자 정확성**: 모든 숫자(가격, 수량, 금액, 수익률)는 원본 그대로 기재
3. **인용 정확성**: 날짜, 인물명, 종목명은 변경 없이 그대로 사용
4. **결측 표시**: 데이터가 없는 항목은 "기록 없음" 또는 "-"로 표시
5. **객관적 서술**: 주관적 평가나 예측 없이 사실만 기술

## 작성 스타일
- 명확하고 간결한 문장 사용
- 마크다운 테이블로 수치 정보 정리
- 시간순으로 이벤트 나열
- 핵심 정보를 먼저 제시"""
                    },
                    {"role": "user", "content": prompt}
                ]
            }
            # gpt-5-mini는 temperature 미지원
            if "gpt-5-mini" not in settings.openai_model:
                api_params["temperature"] = settings.openai_temperature
            # max_tokens가 0보다 크면 설정
            if settings.openai_max_tokens_report > 0:
                api_params["max_tokens"] = settings.openai_max_tokens_report

            response = self.client.chat.completions.create(**api_params)

            content = response.choices[0].message.content

            # 사용량 증가
            self._increment_usage()

            # 남은 횟수 조회
            status = self.get_ai_status()

            return {
                "success": True,
                "content": content,
                "remaining_uses": status["remaining_uses"],
                "position_id": position_id
            }

        except Exception as e:
            return {
                "success": False,
                "error": f"AI 생성 중 오류가 발생했습니다: {str(e)}"
            }
