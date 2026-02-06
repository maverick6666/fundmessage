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


@router.get("/positions", response_model=APIResponse)
async def get_positions_for_report(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """운용보고서용 포지션 목록 (토론, 의사결정서 개수 포함)"""
    query = db.query(Position).options(
        joinedload(Position.opener)
    )

    if status:
        query = query.filter(Position.status == status)

    total = query.count()
    positions = query.order_by(Position.opened_at.desc()).offset(skip).limit(limit).all()

    result = []
    for p in positions:
        # 의사결정서 개수
        note_count = db.query(func.count(DecisionNote.id)).filter(
            DecisionNote.position_id == p.id
        ).scalar()

        # 토론 개수
        from app.models.discussion import Discussion
        discussion_count = db.query(func.count(Discussion.id)).filter(
            Discussion.position_id == p.id
        ).scalar()

        result.append({
            "id": p.id,
            "ticker": p.ticker,
            "ticker_name": p.ticker_name,
            "market": p.market,
            "status": p.status,
            "average_buy_price": float(p.average_buy_price) if p.average_buy_price else None,
            "total_quantity": float(p.total_quantity) if p.total_quantity else None,
            "profit_rate": float(p.profit_rate) if p.profit_rate else None,
            "opened_at": p.opened_at.isoformat() if p.opened_at else None,
            "opener": {
                "id": p.opener.id,
                "full_name": p.opener.full_name
            } if p.opener else None,
            "note_count": note_count,
            "discussion_count": discussion_count,
            "has_data": note_count > 0 or discussion_count > 0
        })

    return APIResponse(
        success=True,
        data={
            "positions": result,
            "total": total,
            "skip": skip,
            "limit": limit
        }
    )


@router.get("/decision-notes", response_model=APIResponse)
async def get_all_decision_notes(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """전체 의사결정서 목록 (모든 포지션)"""
    query = db.query(DecisionNote).options(
        joinedload(DecisionNote.author),
        joinedload(DecisionNote.position)
    ).order_by(DecisionNote.created_at.desc())

    total = query.count()
    notes = query.offset(skip).limit(limit).all()

    return APIResponse(
        success=True,
        data={
            "notes": [{
                "id": n.id,
                "title": n.title,
                "content": n.content[:200] + "..." if n.content and len(n.content) > 200 else n.content,
                "position": {
                    "id": n.position.id,
                    "ticker": n.position.ticker,
                    "ticker_name": n.position.ticker_name,
                    "market": n.position.market,
                    "status": n.position.status
                } if n.position else None,
                "author": {
                    "id": n.author.id,
                    "full_name": n.author.full_name
                } if n.author else None,
                "created_at": n.created_at.isoformat() if n.created_at else None
            } for n in notes],
            "total": total,
            "skip": skip,
            "limit": limit
        }
    )


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
            "ticker_name": position.ticker_name,
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
                "ticker_name": position.ticker_name,
                "market": position.market,
                "status": position.status,
                "average_buy_price": position.average_buy_price,
                "total_quantity": position.total_quantity,
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
