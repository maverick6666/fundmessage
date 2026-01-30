from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.common import APIResponse
from app.services.stats_service import StatsService
from app.dependencies import get_current_user
from app.models.user import User

router = APIRouter()


@router.get("/users/{user_id}", response_model=APIResponse)
async def get_user_stats(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get user statistics"""
    stats_service = StatsService(db)
    stats = stats_service.get_user_stats(user_id)

    if not stats:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return APIResponse(
        success=True,
        data=stats
    )


@router.get("/team", response_model=APIResponse)
async def get_team_stats(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get team statistics"""
    stats_service = StatsService(db)
    stats = stats_service.get_team_stats(start_date, end_date)

    return APIResponse(
        success=True,
        data=stats
    )
