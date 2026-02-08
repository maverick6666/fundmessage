from datetime import datetime, date, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.schemas.common import APIResponse
from app.schemas.team_column import TeamColumnCreate, TeamColumnUpdate
from app.models.team_column import TeamColumn
from app.models.attendance import Attendance
from app.dependencies import get_current_user, get_manager
from app.models.user import User

# 한국 시간대
KST = timezone(timedelta(hours=9))

router = APIRouter()


def column_to_dict(col: TeamColumn) -> dict:
    return {
        "id": col.id,
        "title": col.title,
        "content": col.content,
        "blocks": col.blocks,  # Editor.js 블록 데이터
        "author_id": col.author_id,
        "author": {
            "id": col.author.id,
            "username": col.author.username,
            "full_name": col.author.full_name
        } if col.author else None,
        "is_verified": col.is_verified,
        "verified_by": col.verified_by,
        "verified_at": col.verified_at.isoformat() if col.verified_at else None,
        "shield_granted": col.shield_granted,
        "verifier": {
            "id": col.verifier.id,
            "full_name": col.verifier.full_name
        } if col.verifier else None,
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
        "is_verified": col.is_verified,
        "created_at": col.created_at.isoformat() if col.created_at else None
    }


@router.get("", response_model=APIResponse)
async def get_columns(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    author_id: Optional[int] = None,
    verified: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """칼럼 목록 조회"""
    query = db.query(TeamColumn).options(joinedload(TeamColumn.author))

    if author_id:
        query = query.filter(TeamColumn.author_id == author_id)

    if verified is not None:
        query = query.filter(TeamColumn.is_verified == verified)

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
        joinedload(TeamColumn.author),
        joinedload(TeamColumn.verifier)
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
        blocks=column_data.blocks,
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
    if column_data.blocks is not None:
        col.blocks = column_data.blocks

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


@router.post("/{column_id}/verify", response_model=APIResponse)
async def verify_column(
    column_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_manager)
):
    """칼럼 검증 (파란 체크마크) - 팀장/관리자만

    검증 시 혜택:
    - 미출석이 있으면: 작성자의 가장 최근 결석(absent)을 자동으로 출석(recovered)으로 변경
    - 미출석이 없으면(출석률 100%): 출석 방패 +1 적립 (미래 결석 시 자동 소모)
    """
    col = db.query(TeamColumn).options(
        joinedload(TeamColumn.author),
        joinedload(TeamColumn.verifier)
    ).filter(TeamColumn.id == column_id).first()

    if not col:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="칼럼을 찾을 수 없습니다"
        )

    if col.is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 검증된 칼럼입니다"
        )

    # 본인 칼럼은 검증 불가
    if col.author_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="본인이 작성한 칼럼은 검증할 수 없습니다"
        )

    # 검증 처리
    col.is_verified = True
    col.verified_by = current_user.id
    col.verified_at = datetime.now(KST)

    # 출석 혜택: 작성자의 가장 최근 결석을 복구, 없으면 방패 적립
    latest_absent = db.query(Attendance).filter(
        Attendance.user_id == col.author_id,
        Attendance.status == 'absent'
    ).order_by(Attendance.date.desc()).first()

    recovered_date = None
    shield_granted = False

    if latest_absent:
        # 미출석이 있으면 → 기존 로직대로 출석 복구
        latest_absent.status = 'recovered'
        latest_absent.recovered_by_column_id = col.id
        latest_absent.approved_by = current_user.id
        recovered_date = latest_absent.date.isoformat()
    else:
        # 미출석이 없으면(출석률 100%) → 방패 +1 적립
        author = db.query(User).filter(User.id == col.author_id).first()
        if author:
            author.attendance_shields = (author.attendance_shields or 0) + 1
            col.shield_granted = True
            shield_granted = True

    db.commit()
    db.refresh(col)

    message = "칼럼이 검증되었습니다"
    if recovered_date:
        message += f" ({recovered_date} 결석이 출석으로 복구되었습니다)"
    elif shield_granted:
        author = db.query(User).filter(User.id == col.author_id).first()
        shield_count = author.attendance_shields if author else 0
        message += f" (출석 방패 +1 적립! 현재 방패: {shield_count}개)"

    return APIResponse(
        success=True,
        data={
            **column_to_dict(col),
            "recovered_date": recovered_date,
            "shield_granted": shield_granted
        },
        message=message
    )


@router.post("/{column_id}/unverify", response_model=APIResponse)
async def unverify_column(
    column_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_manager)
):
    """칼럼 검증 취소 - 팀장/관리자만"""
    col = db.query(TeamColumn).filter(TeamColumn.id == column_id).first()

    if not col:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="칼럼을 찾을 수 없습니다"
        )

    if not col.is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="검증되지 않은 칼럼입니다"
        )

    # 검증 취소 시 출석 복구도 취소 또는 방패 차감
    recovered_attendance = db.query(Attendance).filter(
        Attendance.recovered_by_column_id == col.id
    ).first()

    shield_deducted = False

    if recovered_attendance:
        # 출석 복구가 있었다면 → 복구 취소
        recovered_attendance.status = 'absent'
        recovered_attendance.recovered_by_column_id = None
        recovered_attendance.approved_by = None
    elif col.shield_granted:
        # 방패가 적립되었다면 → 방패 차감
        author = db.query(User).filter(User.id == col.author_id).first()
        if author and (author.attendance_shields or 0) > 0:
            author.attendance_shields -= 1
            shield_deducted = True

    col.is_verified = False
    col.verified_by = None
    col.verified_at = None
    col.shield_granted = False

    db.commit()
    db.refresh(col)

    message = "검증이 취소되었습니다"
    if shield_deducted:
        message += " (적립된 방패 1개가 차감되었습니다)"

    return APIResponse(
        success=True,
        data=column_to_dict(col),
        message=message
    )
