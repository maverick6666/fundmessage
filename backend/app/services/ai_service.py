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
from app.utils.constants import KST


class AIService:
    """AI 의사결정서 생성 서비스"""

    def __init__(self, db: Session):
        self.db = db
        if settings.openai_api_key:
            self.client = openai.OpenAI(api_key=settings.openai_api_key)
        else:
            self.client = None

    def _call_ai(self, system_prompt: str, user_prompt: str, verbosity: str = None) -> str:
        """Responses API (verbosity 지원) + Chat Completions fallback"""
        import logging
        logger = logging.getLogger(__name__)

        effective_verbosity = verbosity or settings.openai_verbosity

        # 1차: Responses API with verbosity
        if effective_verbosity:
            try:
                response = self.client.responses.create(
                    model=settings.openai_model,
                    instructions=system_prompt,
                    input=user_prompt,
                    text={"verbosity": effective_verbosity},
                )
                if response.output_text:
                    logger.info(f"Responses API 성공 (verbosity={effective_verbosity})")
                    return response.output_text
            except Exception as e:
                logger.warning(f"Responses API 실패, Chat Completions fallback: {e}")

        # 2차: Chat Completions fallback
        api_params = {
            "model": settings.openai_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
        }
        if not any(x in settings.openai_model for x in ["gpt-5-mini", "gpt-5-nano"]):
            api_params["temperature"] = settings.openai_temperature
        response = self.client.chat.completions.create(**api_params)
        return response.choices[0].message.content

    def _get_today_kst(self) -> date:
        """한국시간(KST) 기준 오늘 날짜"""
        return datetime.now(KST).date()

    def _get_settings(self) -> TeamSettings:
        """팀 설정 조회 (없으면 생성)"""
        team_settings = self.db.query(TeamSettings).first()
        if not team_settings:
            team_settings = TeamSettings(
                ai_daily_limit=3,
                ai_usage_count=0,
                ai_usage_reset_date=self._get_today_kst()
            )
            self.db.add(team_settings)
            self.db.commit()
            self.db.refresh(team_settings)
        return team_settings

    def get_ai_status(self) -> dict:
        """AI 사용 가능 여부 및 남은 횟수"""
        team_settings = self._get_settings()
        today = self._get_today_kst()

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

    def _reserve_usage(self) -> bool:
        """사용량 예약 (check + increment 원자적 처리, 동시 요청 방지)

        Returns:
            True if usage was successfully reserved, False if limit exceeded
        """
        today = self._get_today_kst()

        # Row-level lock으로 동시 요청 시 경합 방지
        team_settings = self.db.query(TeamSettings).with_for_update().first()
        if not team_settings:
            team_settings = TeamSettings(
                ai_daily_limit=3,
                ai_usage_count=0,
                ai_usage_reset_date=today
            )
            self.db.add(team_settings)
            self.db.flush()
            team_settings = self.db.query(TeamSettings).with_for_update().first()

        # 날짜가 바뀌었으면 리셋
        if team_settings.ai_usage_reset_date != today:
            team_settings.ai_usage_count = 0
            team_settings.ai_usage_reset_date = today

        # 제한 체크
        current_count = team_settings.ai_usage_count or 0
        if current_count >= team_settings.ai_daily_limit:
            self.db.commit()  # lock 해제
            return False

        # 사용량 선점 (AI 호출 전에 카운트 증가)
        team_settings.ai_usage_count = current_count + 1
        self.db.commit()
        return True

    def _rollback_usage(self):
        """AI 호출 실패 시 사용량 복원"""
        team_settings = self.db.query(TeamSettings).with_for_update().first()
        if team_settings and (team_settings.ai_usage_count or 0) > 0:
            team_settings.ai_usage_count -= 1
            self.db.commit()

    def _increment_usage(self):
        """사용량 증가 (하위 호환용, _reserve_usage 사용 권장)"""
        team_settings = self._get_settings()
        today = self._get_today_kst()

        if team_settings.ai_usage_reset_date != today:
            team_settings.ai_usage_count = 1
            team_settings.ai_usage_reset_date = today
        else:
            team_settings.ai_usage_count = (team_settings.ai_usage_count or 0) + 1

        self.db.commit()

    def get_session_messages(self, session_ids: List[int]) -> str:
        """세션들의 메시지를 텍스트로 변환 (시간, 차트 데이터 포함)"""
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
                    # 시스템 메시지는 세션 구분용으로만 표시
                    if msg.message_type == 'system':
                        session_messages.append(f"[시스템] {msg.content}")
                        continue

                    author = msg.user.full_name if msg.user else "알 수 없음"
                    # KST 시간 포맷
                    msg_time = msg.created_at.astimezone(KST).strftime("%H:%M") if msg.created_at else ""

                    if msg.message_type == 'chart' and msg.chart_data:
                        # 차트 메시지: 내용 + OHLCV 데이터
                        chart_info = f"[{msg_time}] [{author}] 📈 차트 공유: {msg.content}"
                        try:
                            chart_data = msg.chart_data if isinstance(msg.chart_data, dict) else json.loads(msg.chart_data)
                            candles = chart_data.get("candles", [])
                            if candles:
                                chart_info += f"\n  차트 데이터 ({len(candles)}개 캔들): {json.dumps(candles[:5], ensure_ascii=False)}{'...' if len(candles) > 5 else ''}"
                        except (json.JSONDecodeError, TypeError):
                            pass
                        session_messages.append(chart_info)
                    else:
                        session_messages.append(f"[{msg_time}] [{author}]: {msg.content}")

                if session_messages:
                    # 세션 제목/의제 포함
                    session_header = f"=== 세션 #{session_id}"
                    if discussion.title:
                        session_header += f": {discussion.title}"
                    session_header += " ==="
                    messages_text.append(session_header + "\n" + "\n".join(session_messages))

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

        # 메시지 수집 (사용량 예약 전에 검증)
        messages_text = self.get_session_messages(session_ids)
        if not messages_text:
            return {
                "success": False,
                "error": "선택한 세션에 메시지가 없습니다"
            }

        # 사용량 원자적 예약 (check + increment)
        if not self._reserve_usage():
            return {
                "success": False,
                "error": "오늘 AI 사용 횟수를 모두 소진했습니다"
            }

        # 포지션 정보 추가 (매매계획, 요청이력 포함)
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
- 총 매수금액: {position.total_buy_amount}
- 상태: {'보유중' if position.status == 'open' else '종료됨'}
"""
                # 매매계획 정보
                buy_plan = position.buy_plan or []
                tp_targets = position.take_profit_targets or []
                sl_targets = position.stop_loss_targets or []
                if buy_plan or tp_targets or sl_targets:
                    position_context += "\n현재 매매계획:"
                    if buy_plan:
                        position_context += f"\n- 매수 계획: {json.dumps(buy_plan, ensure_ascii=False)}"
                    if tp_targets:
                        position_context += f"\n- 익절 목표: {json.dumps(tp_targets, ensure_ascii=False)}"
                    if sl_targets:
                        position_context += f"\n- 손절 목표: {json.dumps(sl_targets, ensure_ascii=False)}"

                # 요청 이력
                requests = self.db.query(Request).filter(
                    Request.position_id == position_id
                ).order_by(Request.created_at).all()
                if requests:
                    position_context += "\n\n요청 이력:"
                    for req in requests:
                        requester = self.db.query(User).filter(User.id == req.requester_id).first()
                        req_time = req.created_at.astimezone(KST).strftime("%m/%d %H:%M") if req.created_at else ""
                        position_context += f"\n- [{req_time}] {requester.full_name if requester else '알 수 없음'}: {req.request_type} {req.status} (가격: {req.buy_price}, 수량: {req.order_quantity})"

        # AI 호출
        try:
            system_prompt = """<ROLE>
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
</TABLE_RULES>"""

            prompt = f"""<TASK>
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
</OUTPUT_SPEC>"""

            # AI 호출 (의사결정서: verbosity=medium으로 과잉 길이 방지)
            content = self._call_ai(system_prompt, prompt, verbosity="medium")

            # 제목 추출 (첫 줄에서 **제목**: 패턴 찾기)
            title = "AI 의사결정서"
            import re
            title_match = re.search(r'\*\*제목\*\*:\s*(.+?)(?:\n|$)', content)
            if title_match:
                title = title_match.group(1).strip().strip('"\'')
                # 제목 줄을 본문에서 제거
                content = re.sub(r'\*\*제목\*\*:\s*.+?\n*', '', content, count=1).strip()

            # 남은 횟수 조회
            status = self.get_ai_status()

            return {
                "success": True,
                "title": title,
                "content": content,
                "remaining_uses": status["remaining_uses"],
                "sessions_analyzed": len(session_ids)
            }

        except Exception as e:
            # AI 호출 실패 시 사용량 복원
            self._rollback_usage()
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

        # 헬퍼 함수: KST 날짜 변환, 가격 포맷
        def to_kst_str(dt):
            if dt is None:
                return None
            if hasattr(dt, 'astimezone'):
                return dt.astimezone(KST).strftime("%Y-%m-%d %H:%M")
            return str(dt)

        def fmt_price(val):
            if val is None:
                return None
            v = float(val) if isinstance(val, Decimal) else val
            if v == int(v):
                return f"{int(v):,}원"
            return f"{v:,.2f}원"

        # 요청자/종료자 정보
        opener = self.db.query(User).filter(User.id == position.opened_by).first() if position.opened_by else None
        closer = self.db.query(User).filter(User.id == position.closed_by).first() if position.closed_by else None

        # 관련 요청들
        requests = self.db.query(Request).filter(Request.position_id == position_id).order_by(Request.created_at).all()
        requests_data = []
        for req in requests:
            requester = self.db.query(User).filter(User.id == req.requester_id).first()
            req_time = req.created_at.astimezone(KST).strftime("%Y-%m-%d %H:%M") if req.created_at and hasattr(req.created_at, 'astimezone') else self._serialize_value(req.created_at)
            requests_data.append({
                "type": "매수" if req.request_type == "buy" else "매도",
                "status": {"pending": "대기", "approved": "승인", "rejected": "거부", "discussion": "토론"}.get(req.status, req.status),
                "requester": requester.full_name if requester else "알 수 없음",
                "created_at": req_time,
                "price": fmt_price(req.buy_price) if req.buy_price else "-",
                "quantity": self._serialize_value(req.order_quantity),
                "memo": req.memo or "-"
            })

        # 의사결정 노트
        notes = self.db.query(DecisionNote).filter(DecisionNote.position_id == position_id).order_by(DecisionNote.created_at).all()
        notes_data = []
        for note in notes:
            author = self.db.query(User).filter(User.id == note.created_by).first()
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
                if msg.message_type == 'system':
                    msg_data.append({
                        "type": "system",
                        "content": msg.content,
                        "created_at": self._serialize_value(msg.created_at)
                    })
                    continue
                author = msg.user.full_name if msg.user else "알 수 없음"
                msg_entry = {
                    "type": msg.message_type or "text",
                    "author": author,
                    "content": msg.content,
                    "created_at": self._serialize_value(msg.created_at)
                }
                # 차트 데이터 포함 (캔들 수 제한하여 토큰 절약)
                if msg.message_type == 'chart' and msg.chart_data:
                    try:
                        chart = msg.chart_data if isinstance(msg.chart_data, dict) else json.loads(msg.chart_data)
                        candles = chart.get("candles", [])
                        msg_entry["chart_summary"] = {
                            "candle_count": len(candles),
                            "period": chart.get("period", ""),
                            "first_5": candles[:5] if candles else [],
                            "last_5": candles[-5:] if candles else []
                        }
                    except (json.JSONDecodeError, TypeError):
                        pass
                msg_data.append(msg_entry)
            discussions_data.append({
                "title": disc.title,
                "status": disc.status,
                "message_count": len([m for m in msg_data if m.get("type") != "system"]),
                "messages": msg_data
            })

        # 현재 매매계획 상태
        current_buy_plan = position.buy_plan or []
        current_tp = position.take_profit_targets or []
        current_sl = position.stop_loss_targets or []

        # 보유기간 계산
        holding_period = "-"
        if position.opened_at:
            end = position.closed_at or datetime.now(KST)
            if hasattr(position.opened_at, 'astimezone'):
                delta = end - position.opened_at
            else:
                delta = end - datetime.now(KST)
            days = delta.days
            hours = delta.seconds // 3600
            if days > 0:
                holding_period = f"{days}일 {hours}시간"
            else:
                holding_period = f"{hours}시간"

        return {
            "position": {
                "ticker": position.ticker,
                "ticker_name": position.ticker_name,
                "market": position.market,
                "status": "진행중" if position.status == "open" else "종료",
                "is_info_confirmed": "확인됨" if position.is_info_confirmed else "미확인",
                "average_buy_price": fmt_price(position.average_buy_price),
                "total_quantity": self._serialize_value(position.total_quantity),
                "total_buy_amount": fmt_price(position.total_buy_amount),
                "average_sell_price": fmt_price(position.average_sell_price),
                "total_sell_amount": fmt_price(position.total_sell_amount),
                "profit_loss": fmt_price(position.profit_loss),
                "profit_rate": self._serialize_value(position.profit_rate),
                "realized_profit_loss": fmt_price(position.realized_profit_loss),
                "holding_period": holding_period,
                "opened_at": to_kst_str(position.opened_at),
                "closed_at": to_kst_str(position.closed_at),
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

        # 모든 데이터 수집 (사용량 예약 전에 검증)
        data = self.collect_position_data(position_id)
        if not data:
            return {
                "success": False,
                "error": "포지션을 찾을 수 없습니다"
            }

        # 사용량 원자적 예약 (check + increment)
        if not self._reserve_usage():
            return {
                "success": False,
                "error": "오늘 AI 사용 횟수를 모두 소진했습니다"
            }

        # 데이터를 JSON으로 변환
        data_json = json.dumps(data, ensure_ascii=False, indent=2)

        try:
            prompt = f"""<INPUT_DATA>
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
</OUTPUT_SPEC>"""

            report_system_prompt = """<ROLE>
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
</DENSITY_REQUIREMENTS>"""

            # AI 호출 (Responses API + verbosity, fallback to Chat Completions)
            content = self._call_ai(report_system_prompt, prompt)

            # 남은 횟수 조회
            status = self.get_ai_status()

            return {
                "success": True,
                "content": content,
                "remaining_uses": status["remaining_uses"],
                "position_id": position_id
            }

        except Exception as e:
            # AI 호출 실패 시 사용량 복원
            self._rollback_usage()
            return {
                "success": False,
                "error": f"AI 생성 중 오류가 발생했습니다: {str(e)}"
            }
