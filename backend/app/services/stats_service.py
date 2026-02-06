from datetime import datetime, date, timezone, timedelta
from decimal import Decimal
from typing import Optional, List, Dict
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.models.position import Position, PositionStatus
from app.models.request import Request, RequestStatus, RequestType
from app.models.user import User
from app.models.attendance import Attendance

# 한국 시간대 (UTC+9)
KST = timezone(timedelta(hours=9))


def get_kst_today():
    """한국 시간 기준 오늘 날짜 반환"""
    return datetime.now(KST).date()


class StatsService:
    def __init__(self, db: Session):
        self.db = db

    def get_user_stats(self, user_id: int) -> dict:
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return {}

        # Get all closed positions where user was the opener
        closed_positions = self.db.query(Position).filter(
            Position.opened_by == user_id,
            Position.status == PositionStatus.CLOSED.value
        ).all()

        total_trades = len(closed_positions)
        winning_trades = len([p for p in closed_positions if p.profit_loss and p.profit_loss > 0])
        losing_trades = len([p for p in closed_positions if p.profit_loss and p.profit_loss < 0])

        total_profit_loss = sum([p.profit_loss or Decimal(0) for p in closed_positions])
        avg_profit_rate = (
            sum([p.profit_rate or Decimal(0) for p in closed_positions]) / total_trades
            if total_trades > 0 else Decimal(0)
        )
        avg_holding_hours = (
            sum([p.holding_period_hours or 0 for p in closed_positions]) / total_trades
            if total_trades > 0 else 0
        )

        win_rate = winning_trades / total_trades if total_trades > 0 else 0

        # Best and worst trades
        best_trade = max(closed_positions, key=lambda p: p.profit_rate or Decimal(0)) if closed_positions else None
        worst_trade = min(closed_positions, key=lambda p: p.profit_rate or Decimal(0)) if closed_positions else None

        return {
            "user": {
                "id": user.id,
                "username": user.username,
                "full_name": user.full_name
            },
            "overall": {
                "total_trades": total_trades,
                "winning_trades": winning_trades,
                "losing_trades": losing_trades,
                "win_rate": win_rate,
                "total_profit_loss": float(total_profit_loss),
                "avg_profit_rate": float(avg_profit_rate),
                "avg_holding_hours": int(avg_holding_hours)
            },
            "best_trade": {
                "ticker": best_trade.ticker,
                "profit_rate": float(best_trade.profit_rate or 0),
                "closed_at": best_trade.closed_at.isoformat() if best_trade.closed_at else None
            } if best_trade else None,
            "worst_trade": {
                "ticker": worst_trade.ticker,
                "profit_rate": float(worst_trade.profit_rate or 0),
                "closed_at": worst_trade.closed_at.isoformat() if worst_trade.closed_at else None
            } if worst_trade else None,
            "attendance": self._get_user_attendance_stats(user_id)
        }

    def _get_user_attendance_stats(self, user_id: int) -> dict:
        """사용자 출석률 통계"""
        today = get_kst_today()

        # 전체 출석
        total_records = self.db.query(Attendance).filter(
            Attendance.user_id == user_id
        ).count()

        total_present = self.db.query(Attendance).filter(
            Attendance.user_id == user_id,
            Attendance.status.in_(['present', 'recovered'])
        ).count()

        # 이번 달 출석
        month_start = date(today.year, today.month, 1)
        month_records = self.db.query(Attendance).filter(
            Attendance.user_id == user_id,
            Attendance.date >= month_start,
            Attendance.date <= today
        ).count()

        month_present = self.db.query(Attendance).filter(
            Attendance.user_id == user_id,
            Attendance.date >= month_start,
            Attendance.date <= today,
            Attendance.status.in_(['present', 'recovered'])
        ).count()

        # 연속 출석 일수
        streak = 0
        current_date = today
        while True:
            att = self.db.query(Attendance).filter(
                Attendance.user_id == user_id,
                Attendance.date == current_date,
                Attendance.status.in_(['present', 'recovered'])
            ).first()
            if att:
                streak += 1
                current_date -= timedelta(days=1)
            else:
                break

        return {
            "total_rate": round((total_present / total_records * 100), 1) if total_records > 0 else 0,
            "month_rate": round((month_present / month_records * 100), 1) if month_records > 0 else 0,
            "streak": streak,
            "total_present": total_present,
            "total_records": total_records,
            "month_present": month_present,
            "month_days": month_records
        }

    def get_team_stats(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        price_data: Optional[Dict[int, Dict]] = None
    ) -> dict:
        # 열린 포지션
        open_positions = self.db.query(Position).filter(
            Position.status == PositionStatus.OPEN.value
        ).all()

        # 종료된 포지션
        closed_query = self.db.query(Position).filter(Position.status == PositionStatus.CLOSED.value)
        if start_date:
            closed_query = closed_query.filter(Position.closed_at >= datetime.combine(start_date, datetime.min.time()))
        if end_date:
            closed_query = closed_query.filter(Position.closed_at <= datetime.combine(end_date, datetime.max.time()))
        closed_positions = closed_query.all()

        # 통화별 열린 포지션 통계 (KRW / USD / USDT)
        currency_stats = {}
        for p in open_positions:
            currency = self._get_currency(p.market)
            if currency not in currency_stats:
                currency_stats[currency] = {
                    "invested": Decimal(0),
                    "evaluation": Decimal(0),
                    "unrealized_pl": Decimal(0),
                    "count": 0
                }
            currency_stats[currency]["count"] += 1
            invested = p.total_buy_amount or Decimal(0)
            currency_stats[currency]["invested"] += invested

            # 시세 데이터가 있으면 평가금액 계산
            if price_data and p.id in price_data and price_data[p.id].get("evaluation_amount"):
                eval_amt = Decimal(str(price_data[p.id]["evaluation_amount"]))
                currency_stats[currency]["evaluation"] += eval_amt
                currency_stats[currency]["unrealized_pl"] += eval_amt - invested
            else:
                currency_stats[currency]["evaluation"] += invested  # 시세 없으면 투자금액 = 평가금액

        open_count = len(open_positions)
        open_invested = sum([p.total_buy_amount or Decimal(0) for p in open_positions])

        # 종료된 포지션 통계
        closed_count = len(closed_positions)
        realized_profit_loss = sum([p.profit_loss or Decimal(0) for p in closed_positions])
        total_volume = sum([p.total_buy_amount or Decimal(0) for p in closed_positions])
        winning_trades = len([p for p in closed_positions if p.profit_loss and p.profit_loss > 0])
        losing_trades = len([p for p in closed_positions if p.profit_loss and p.profit_loss < 0])
        win_rate = winning_trades / closed_count if closed_count > 0 else 0

        # 평균 보유 시간, 평균 수익률 (진행중 + 종료 포지션 모두 포함)
        all_for_avg = open_positions + closed_positions
        total_for_avg = len(all_for_avg)

        # 진행중 포지션의 보유 시간 계산
        open_holding_hours = 0
        open_profit_rates = []
        for p in open_positions:
            if p.opened_at:
                now = datetime.now(timezone.utc)
                opened = p.opened_at if p.opened_at.tzinfo else p.opened_at.replace(tzinfo=timezone.utc)
                hours = (now - opened).total_seconds() / 3600
                open_holding_hours += hours
            # 진행중 포지션의 수익률은 시세 데이터에서 가져옴
            if price_data and p.id in price_data and price_data[p.id].get("profit_rate") is not None:
                open_profit_rates.append(float(price_data[p.id]["profit_rate"]))

        closed_holding_hours = sum([p.holding_period_hours or 0 for p in closed_positions])
        closed_profit_rates = [float(p.profit_rate or 0) for p in closed_positions]

        avg_holding_hours = (
            (closed_holding_hours + open_holding_hours) / total_for_avg
            if total_for_avg > 0 else 0
        )

        all_profit_rates = closed_profit_rates + open_profit_rates
        avg_profit_rate = (
            sum(all_profit_rates) / len(all_profit_rates)
            if len(all_profit_rates) > 0 else 0
        )

        # Leaderboard by user (종료 + 진행중 포지션 모두 포함)
        user_stats = {}
        for position in closed_positions:
            user_id = position.opened_by
            if user_id not in user_stats:
                user = self.db.query(User).filter(User.id == user_id).first()
                user_stats[user_id] = {
                    "user": {"id": user.id, "username": user.username, "full_name": user.full_name} if user else {"id": user_id, "username": "Unknown", "full_name": "Unknown"},
                    "realized_pl": Decimal(0),
                    "unrealized_pl": Decimal(0),
                    "win_count": 0,
                    "closed_trades": 0,
                    "open_trades": 0
                }

            user_stats[user_id]["realized_pl"] += position.profit_loss or Decimal(0)
            user_stats[user_id]["closed_trades"] += 1
            if position.profit_loss and position.profit_loss > 0:
                user_stats[user_id]["win_count"] += 1

        # 진행중 포지션의 미실현 손익 추가
        for position in open_positions:
            user_id = position.opened_by
            if user_id not in user_stats:
                user = self.db.query(User).filter(User.id == user_id).first()
                user_stats[user_id] = {
                    "user": {"id": user.id, "username": user.username, "full_name": user.full_name} if user else {"id": user_id, "username": "Unknown", "full_name": "Unknown"},
                    "realized_pl": Decimal(0),
                    "unrealized_pl": Decimal(0),
                    "win_count": 0,
                    "closed_trades": 0,
                    "open_trades": 0
                }

            user_stats[user_id]["open_trades"] += 1
            if price_data and position.id in price_data and price_data[position.id].get("profit_loss") is not None:
                user_stats[user_id]["unrealized_pl"] += Decimal(str(price_data[position.id]["profit_loss"]))

        leaderboard = sorted(
            [
                {
                    "user": s["user"],
                    "realized_pl": float(s["realized_pl"]),
                    "unrealized_pl": float(s["unrealized_pl"]),
                    "total_profit_loss": float(s["realized_pl"] + s["unrealized_pl"]),
                    "win_rate": s["win_count"] / s["closed_trades"] if s["closed_trades"] > 0 else 0,
                    "closed_trades": s["closed_trades"],
                    "open_trades": s["open_trades"]
                }
                for s in user_stats.values()
            ],
            key=lambda x: x["total_profit_loss"],
            reverse=True
        )

        for i, entry in enumerate(leaderboard):
            entry["rank"] = i + 1

        # 모든 포지션 (open + closed) 종목별 통계
        all_positions = open_positions + closed_positions
        ticker_stats = {}
        for position in all_positions:
            ticker = position.ticker
            if ticker not in ticker_stats:
                ticker_stats[ticker] = {
                    "ticker": ticker,
                    "ticker_name": position.ticker_name,
                    "market": position.market,
                    "open_count": 0,
                    "closed_count": 0,
                    "invested": Decimal(0),
                    "evaluation": Decimal(0),
                    "unrealized_pl": Decimal(0),
                    "profit_loss": Decimal(0),
                    "total_holding_hours": 0,
                    "closed_volume": Decimal(0),
                    "profit_rates": []
                }

            if position.status == PositionStatus.OPEN.value:
                ticker_stats[ticker]["open_count"] += 1
                invested = position.total_buy_amount or Decimal(0)
                ticker_stats[ticker]["invested"] += invested
                # 시세 데이터로 평가금액/미실현손익 계산
                if price_data and position.id in price_data:
                    pd = price_data[position.id]
                    if pd.get("evaluation_amount"):
                        eval_amt = Decimal(str(pd["evaluation_amount"]))
                        ticker_stats[ticker]["evaluation"] += eval_amt
                        ticker_stats[ticker]["unrealized_pl"] += eval_amt - invested
                    else:
                        ticker_stats[ticker]["evaluation"] += invested
                    if pd.get("profit_rate") is not None:
                        ticker_stats[ticker]["profit_rates"].append(float(pd["profit_rate"]))
                else:
                    ticker_stats[ticker]["evaluation"] += invested
            else:
                ticker_stats[ticker]["closed_count"] += 1
                ticker_stats[ticker]["profit_loss"] += position.profit_loss or Decimal(0)
                ticker_stats[ticker]["closed_volume"] += position.total_buy_amount or Decimal(0)
                ticker_stats[ticker]["total_holding_hours"] += position.holding_period_hours or 0
                if position.profit_rate is not None:
                    ticker_stats[ticker]["profit_rates"].append(float(position.profit_rate))

        by_ticker = sorted(
            [
                {
                    "ticker": s["ticker"],
                    "ticker_name": s["ticker_name"],
                    "market": s["market"],
                    "open_count": s["open_count"],
                    "closed_count": s["closed_count"],
                    "invested": float(s["invested"]),
                    "evaluation": float(s["evaluation"]),
                    "unrealized_pl": float(s["unrealized_pl"]),
                    "unrealized_rate": float(s["unrealized_pl"] / s["invested"]) if s["invested"] > 0 else 0,
                    "profit_loss": float(s["profit_loss"]),
                    "closed_volume": float(s["closed_volume"]),
                    "profit_rate": float(s["profit_loss"] / s["closed_volume"]) if s["closed_volume"] > 0 else 0,
                    "avg_profit_rate": sum(s["profit_rates"]) / len(s["profit_rates"]) if s["profit_rates"] else 0,
                    "avg_holding_hours": s["total_holding_hours"] // s["closed_count"] if s["closed_count"] > 0 else 0
                }
                for s in ticker_stats.values()
            ],
            key=lambda x: (x["open_count"], x["profit_loss"]),
            reverse=True
        )

        # 통화별 통계를 직렬화
        by_currency = {
            currency: {
                "count": stats["count"],
                "invested": float(stats["invested"]),
                "evaluation": float(stats["evaluation"]),
                "unrealized_pl": float(stats["unrealized_pl"]),
                "pl_rate": float(stats["unrealized_pl"] / stats["invested"]) if stats["invested"] > 0 else 0
            }
            for currency, stats in currency_stats.items()
        }

        return {
            "period": {
                "start": start_date.isoformat() if start_date else None,
                "end": end_date.isoformat() if end_date else None
            },
            "open_positions": {
                "count": open_count,
                "total_invested": float(open_invested),
                "by_currency": by_currency
            },
            "closed_positions": {
                "count": closed_count,
                "winning_trades": winning_trades,
                "losing_trades": losing_trades,
                "win_rate": win_rate,
                "realized_profit_loss": float(realized_profit_loss),
                "total_volume": float(total_volume),
                "avg_holding_hours": int(avg_holding_hours),
                "avg_profit_rate": avg_profit_rate
            },
            "overall": {
                "total_positions": open_count + closed_count,
                "total_invested": float(open_invested),
                "realized_profit_loss": float(realized_profit_loss),
                "win_rate": win_rate,
                "total_volume": float(total_volume)
            },
            "leaderboard": leaderboard,
            "by_ticker": by_ticker
        }

    def _get_currency(self, market: str) -> str:
        """시장으로부터 통화를 결정"""
        if market in ('KOSPI', 'KOSDAQ', 'KRX'):
            return 'KRW'
        elif market in ('NASDAQ', 'NYSE'):
            return 'USD'
        elif market == 'CRYPTO':
            return 'USDT'
        return 'KRW'
