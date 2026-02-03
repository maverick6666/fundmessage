from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.models.position import Position, PositionStatus
from app.models.request import Request, RequestStatus, RequestType
from app.models.user import User


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

        # Calculate profit factor
        total_gains = sum([p.profit_loss for p in closed_positions if p.profit_loss and p.profit_loss > 0])
        total_losses = abs(sum([p.profit_loss for p in closed_positions if p.profit_loss and p.profit_loss < 0]))
        profit_factor = float(total_gains / total_losses) if total_losses > 0 else 0

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
                "avg_holding_hours": int(avg_holding_hours),
                "profit_factor": profit_factor
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
            } if worst_trade else None
        }

    def get_team_stats(self, start_date: Optional[date] = None, end_date: Optional[date] = None) -> dict:
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

        # 열린 포지션 통계
        open_count = len(open_positions)
        open_invested = sum([p.total_buy_amount or Decimal(0) for p in open_positions])

        # 종료된 포지션 통계
        closed_count = len(closed_positions)
        realized_profit_loss = sum([p.profit_loss or Decimal(0) for p in closed_positions])
        total_volume = sum([p.total_buy_amount or Decimal(0) for p in closed_positions])
        winning_trades = len([p for p in closed_positions if p.profit_loss and p.profit_loss > 0])
        losing_trades = len([p for p in closed_positions if p.profit_loss and p.profit_loss < 0])
        win_rate = winning_trades / closed_count if closed_count > 0 else 0

        # 수익 팩터
        total_gains = sum([p.profit_loss for p in closed_positions if p.profit_loss and p.profit_loss > 0])
        total_losses = abs(sum([p.profit_loss for p in closed_positions if p.profit_loss and p.profit_loss < 0]))
        profit_factor = float(total_gains / total_losses) if total_losses > 0 else 0

        # Leaderboard by user (종료된 포지션 기준)
        user_stats = {}
        for position in closed_positions:
            user_id = position.opened_by
            if user_id not in user_stats:
                user = self.db.query(User).filter(User.id == user_id).first()
                user_stats[user_id] = {
                    "user": {"id": user.id, "username": user.username, "full_name": user.full_name} if user else {"id": user_id, "username": "Unknown", "full_name": "Unknown"},
                    "total_profit_loss": Decimal(0),
                    "win_count": 0,
                    "trades": 0
                }

            user_stats[user_id]["total_profit_loss"] += position.profit_loss or Decimal(0)
            user_stats[user_id]["trades"] += 1
            if position.profit_loss and position.profit_loss > 0:
                user_stats[user_id]["win_count"] += 1

        leaderboard = sorted(
            [
                {
                    "user": s["user"],
                    "total_profit_loss": float(s["total_profit_loss"]),
                    "win_rate": s["win_count"] / s["trades"] if s["trades"] > 0 else 0,
                    "trades": s["trades"]
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
                    "profit_loss": Decimal(0),
                    "total_holding_hours": 0
                }

            if position.status == PositionStatus.OPEN.value:
                ticker_stats[ticker]["open_count"] += 1
                ticker_stats[ticker]["invested"] += position.total_buy_amount or Decimal(0)
            else:
                ticker_stats[ticker]["closed_count"] += 1
                ticker_stats[ticker]["profit_loss"] += position.profit_loss or Decimal(0)
                ticker_stats[ticker]["total_holding_hours"] += position.holding_period_hours or 0

        by_ticker = sorted(
            [
                {
                    "ticker": s["ticker"],
                    "ticker_name": s["ticker_name"],
                    "market": s["market"],
                    "open_count": s["open_count"],
                    "closed_count": s["closed_count"],
                    "invested": float(s["invested"]),
                    "profit_loss": float(s["profit_loss"]),
                    "avg_holding_hours": s["total_holding_hours"] // s["closed_count"] if s["closed_count"] > 0 else 0
                }
                for s in ticker_stats.values()
            ],
            key=lambda x: (x["open_count"], x["profit_loss"]),
            reverse=True
        )

        return {
            "period": {
                "start": start_date.isoformat() if start_date else None,
                "end": end_date.isoformat() if end_date else None
            },
            "open_positions": {
                "count": open_count,
                "total_invested": float(open_invested)
            },
            "closed_positions": {
                "count": closed_count,
                "winning_trades": winning_trades,
                "losing_trades": losing_trades,
                "win_rate": win_rate,
                "realized_profit_loss": float(realized_profit_loss),
                "total_volume": float(total_volume),
                "profit_factor": profit_factor
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
