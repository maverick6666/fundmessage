from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.schemas.common import APIResponse
from app.schemas.team_column import TeamColumnCreate, TeamColumnUpdate
from app.models.team_column import TeamColumn
from app.dependencies import get_current_user
from app.models.user import User

router = APIRouter()


def column_to_dict(col: TeamColumn) -> dict:
    return {
        "id": col.id,
        "title": col.title,
        "content": col.content,
        "author_id": col.author_id,
        "author": {
            "id": col.author.id,
            "username": col.author.username,
            "full_name": col.author.full_name
        } if col.author else None,
        "created_at": col.created_at.isoformat() if col.created_at else None,
        "updated_at": col.updated_at.isoformat() if col.updated_at else None
    }


def column_to_list_item(col: TeamColumn) -> dict:
    return {
        "id": col.id,
        "title": col.title,
        "author_id": col.author_id,
        "author": {
            "id": col.author.id,
            "username": col.author.username,
            "full_name": col.author.full_name
        } if col.author else None,
        "created_at": col.created_at.isoformat() if col.created_at else None
    }


@router.get("", response_model=APIResponse)
async def get_columns(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    author_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """칼럼 목록 조회"""
    query = db.query(TeamColumn).options(joinedload(TeamColumn.author))

    if author_id:
        query = query.filter(TeamColumn.author_id == author_id)

    total = query.count()
    columns = query.order_by(TeamColumn.created_at.desc()).offset(skip).limit(limit).all()

    return APIResponse(
        success=True,
        data={
            "columns": [column_to_list_item(c) for c in columns],
            "total": total,
            "skip": skip,
            "limit": limit
        }
    )


@router.get("/{column_id}", response_model=APIResponse)
async def get_column(
    column_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """칼럼 상세 조회"""
    col = db.query(TeamColumn).options(
        joinedload(TeamColumn.author)
    ).filter(TeamColumn.id == column_id).first()

    if not col:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="칼럼을 찾을 수 없습니다"
        )

    return APIResponse(
        success=True,
        data=column_to_dict(col)
    )


@router.post("", response_model=APIResponse)
async def create_column(
    column_data: TeamColumnCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """칼럼 작성 (모든 인증된 사용자)"""
    col = TeamColumn(
        title=column_data.title,
        content=column_data.content,
        author_id=current_user.id
    )
    db.add(col)
    db.commit()
    db.refresh(col)

    return APIResponse(
        success=True,
        data=column_to_dict(col),
        message="칼럼이 작성되었습니다"
    )


@router.put("/{column_id}", response_model=APIResponse)
async def update_column(
    column_id: int,
    column_data: TeamColumnUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """칼럼 수정 (작성자만)"""
    col = db.query(TeamColumn).filter(TeamColumn.id == column_id).first()

    if not col:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="칼럼을 찾을 수 없습니다"
        )

    if col.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="작성자만 수정할 수 있습니다"
        )

    if column_data.title is not None:
        col.title = column_data.title
    if column_data.content is not None:
        col.content = column_data.content

    db.commit()
    db.refresh(col)

    return APIResponse(
        success=True,
        data=column_to_dict(col),
        message="칼럼이 수정되었습니다"
    )


@router.delete("/{column_id}", response_model=APIResponse)
async def delete_column(
    column_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """칼럼 삭제 (작성자 또는 매니저)"""
    col = db.query(TeamColumn).filter(TeamColumn.id == column_id).first()

    if not col:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="칼럼을 찾을 수 없습니다"
        )

    is_author = col.author_id == current_user.id
    is_manager = current_user.role == 'manager'

    if not is_author and not is_manager:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="작성자 또는 팀장만 삭제할 수 있습니다"
        )

    db.delete(col)
    db.commit()

    return APIResponse(
        success=True,
        message="칼럼이 삭제되었습니다"
    )
