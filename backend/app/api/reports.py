from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from app.database import get_db
from app.schemas.common import APIResponse
from app.models.decision_note import DecisionNote
from app.models.position import Position
from app.dependencies import get_current_user
from app.models.user import User

router = APIRouter()


@router.get("", response_model=APIResponse)
async def get_reports(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """운용보고서 목록 (포지션별 DecisionNote 그룹화)

    각 포지션의 최신 DecisionNote를 기준으로 정렬
    """
    # 포지션별로 DecisionNote가 있는 포지션만 조회
    subquery = db.query(
        DecisionNote.position_id,
        func.count(DecisionNote.id).label('note_count'),
        func.max(DecisionNote.created_at).label('latest_note_at')
    ).group_by(DecisionNote.position_id).subquery()

    query = db.query(Position, subquery.c.note_count, subquery.c.latest_note_at).join(
        subquery, Position.id == subquery.c.position_id
    ).options(
        joinedload(Position.opener)
    )

    total = query.count()
    positions_with_notes = query.order_by(
        subquery.c.latest_note_at.desc()
    ).offset(skip).limit(limit).all()

    reports = []
    for position, note_count, latest_note_at in positions_with_notes:
        reports.append({
            "position_id": position.id,
            "ticker": position.ticker,
            "name": position.name,
            "market": position.market,
            "status": position.status,
            "profit_rate": position.profit_rate,
            "note_count": note_count,
            "latest_note_at": latest_note_at.isoformat() if latest_note_at else None,
            "opener": {
                "id": position.opener.id,
                "username": position.opener.username,
                "full_name": position.opener.full_name
            } if position.opener else None
        })

    return APIResponse(
        success=True,
        data={
            "reports": reports,
            "total": total,
            "skip": skip,
            "limit": limit
        }
    )


@router.get("/position/{position_id}", response_model=APIResponse)
async def get_position_report(
    position_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """특정 포지션의 운용보고서 (모든 DecisionNote)"""
    position = db.query(Position).options(
        joinedload(Position.opener),
        joinedload(Position.closer)
    ).filter(Position.id == position_id).first()

    if not position:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="포지션을 찾을 수 없습니다"
        )

    notes = db.query(DecisionNote).options(
        joinedload(DecisionNote.author)
    ).filter(
        DecisionNote.position_id == position_id
    ).order_by(DecisionNote.created_at.desc()).all()

    return APIResponse(
        success=True,
        data={
            "position": {
                "id": position.id,
                "ticker": position.ticker,
                "name": position.name,
                "market": position.market,
                "status": position.status,
                "avg_buy_price": position.avg_buy_price,
                "quantity": position.quantity,
                "profit_rate": position.profit_rate,
                "opened_at": position.opened_at.isoformat() if position.opened_at else None,
                "closed_at": position.closed_at.isoformat() if position.closed_at else None,
                "opener": {
                    "id": position.opener.id,
                    "username": position.opener.username,
                    "full_name": position.opener.full_name
                } if position.opener else None,
                "closer": {
                    "id": position.closer.id,
                    "username": position.closer.username,
                    "full_name": position.closer.full_name
                } if position.closer else None
            },
            "notes": [{
                "id": n.id,
                "title": n.title,
                "content": n.content,
                "author": {
                    "id": n.author.id,
                    "username": n.author.username,
                    "full_name": n.author.full_name
                } if n.author else None,
                "created_at": n.created_at.isoformat() if n.created_at else None,
                "updated_at": n.updated_at.isoformat() if n.updated_at else None
            } for n in notes]
        }
    )
