from datetime import date, datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel

from app.database import get_db
from app.schemas.common import APIResponse
from app.models.attendance import Attendance
from app.models.team_column import TeamColumn
from app.dependencies import get_current_user, get_manager, get_writer_user
from app.models.user import User

# 한국 시간대 (UTC+9)
KST = timezone(timedelta(hours=9))


def get_kst_today():
    """한국 시간 기준 오늘 날짜 반환"""
    return datetime.now(KST).date()

router = APIRouter()


class RecoverRequest(BaseModel):
    column_id: int
    date: str  # YYYY-MM-DD format


def attendance_to_dict(att: Attendance) -> dict:
    return {
        "id": att.id,
        "user_id": att.user_id,
        "date": att.date.isoformat() if att.date else None,
        "status": att.status,
        "recovered_by_column_id": att.recovered_by_column_id,
        "approved_by": att.approved_by,
        "created_at": att.created_at.isoformat() if att.created_at else None
    }


@router.post("/check-in", response_model=APIResponse)
async def check_in(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_writer_user)
):
    """오늘 출석 체크 (한국 시간 기준)

    방패 자동 소모: 어제 미출석(absent)이고 방패가 있으면 어제를 자동 출석 처리
    """
    today = get_kst_today()

    # 이미 출석했는지 확인
    existing = db.query(Attendance).filter(
        Attendance.user_id == current_user.id,
        Attendance.date == today
    ).first()

    if existing:
        return APIResponse(
            success=True,
            data=attendance_to_dict(existing),
            message="이미 출석 체크되었습니다"
        )

    # 방패 자동 소모: 어제 미출석이고 방패가 있으면 어제를 자동 출석 처리
    yesterday = today - timedelta(days=1)
    shield_used = False
    shield_recovered_date = None

    yesterday_attendance = db.query(Attendance).filter(
        Attendance.user_id == current_user.id,
        Attendance.date == yesterday
    ).first()

    if yesterday_attendance and yesterday_attendance.status == 'absent':
        shields = current_user.attendance_shields or 0
        if shields > 0:
            yesterday_attendance.status = 'recovered'
            current_user.attendance_shields = shields - 1
            shield_used = True
            shield_recovered_date = yesterday.isoformat()

    # 출석 기록 생성
    attendance = Attendance(
        user_id=current_user.id,
        date=today,
        status='present'
    )
    db.add(attendance)
    db.commit()
    db.refresh(attendance)

    message = "출석 체크 완료!"
    if shield_used:
        remaining = current_user.attendance_shields or 0
        message += f" (방패를 사용하여 {shield_recovered_date} 결석이 자동 복구되었습니다. 남은 방패: {remaining}개)"

    return APIResponse(
        success=True,
        data={
            **attendance_to_dict(attendance),
            "shield_used": shield_used,
            "shield_recovered_date": shield_recovered_date,
            "remaining_shields": current_user.attendance_shields or 0
        },
        message=message
    )


@router.get("/me", response_model=APIResponse)
async def get_my_attendance(
    year: Optional[int] = None,
    month: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """내 출석 기록 조회 (캘린더용)"""
    target_year = year or date.today().year
    target_month = month or date.today().month

    # 해당 월의 시작/끝 날짜
    start_date = date(target_year, target_month, 1)
    if target_month == 12:
        end_date = date(target_year + 1, 1, 1) - timedelta(days=1)
    else:
        end_date = date(target_year, target_month + 1, 1) - timedelta(days=1)

    attendances = db.query(Attendance).filter(
        Attendance.user_id == current_user.id,
        Attendance.date >= start_date,
        Attendance.date <= end_date
    ).all()

    return APIResponse(
        success=True,
        data={
            "year": target_year,
            "month": target_month,
            "attendances": [attendance_to_dict(a) for a in attendances]
        }
    )


@router.get("/me/stats", response_model=APIResponse)
async def get_my_attendance_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """내 출석률 통계 (한국 시간 기준)"""
    today = get_kst_today()

    # 전체 출석률 (가입 후)
    total_records = db.query(Attendance).filter(
        Attendance.user_id == current_user.id
    ).count()

    total_present = db.query(Attendance).filter(
        Attendance.user_id == current_user.id,
        Attendance.status.in_(['present', 'recovered'])
    ).count()

    # 이번 주 출석률
    week_start = today - timedelta(days=today.weekday())
    week_records = db.query(Attendance).filter(
        Attendance.user_id == current_user.id,
        Attendance.date >= week_start,
        Attendance.date <= today
    ).count()

    week_present = db.query(Attendance).filter(
        Attendance.user_id == current_user.id,
        Attendance.date >= week_start,
        Attendance.date <= today,
        Attendance.status.in_(['present', 'recovered'])
    ).count()

    # 이번 달 출석률
    month_start = date(today.year, today.month, 1)
    month_records = db.query(Attendance).filter(
        Attendance.user_id == current_user.id,
        Attendance.date >= month_start,
        Attendance.date <= today
    ).count()

    month_present = db.query(Attendance).filter(
        Attendance.user_id == current_user.id,
        Attendance.date >= month_start,
        Attendance.date <= today,
        Attendance.status.in_(['present', 'recovered'])
    ).count()

    # 연속 출석 일수
    streak = 0
    current_date = today
    while True:
        att = db.query(Attendance).filter(
            Attendance.user_id == current_user.id,
            Attendance.date == current_date,
            Attendance.status.in_(['present', 'recovered'])
        ).first()
        if att:
            streak += 1
            current_date -= timedelta(days=1)
        else:
            break

    return APIResponse(
        success=True,
        data={
            "total_rate": (total_present / total_records * 100) if total_records > 0 else 0,
            "week_rate": (week_present / week_records * 100) if week_records > 0 else 0,
            "month_rate": (month_present / month_records * 100) if month_records > 0 else 0,
            "streak": streak,
            "total_present": total_present,
            "total_records": total_records,
            "week_present": week_present,
            "week_records": week_records,
            "month_present": month_present,
            "month_records": month_records,
            "attendance_shields": current_user.attendance_shields or 0
        }
    )


@router.post("/recover", response_model=APIResponse)
async def request_recovery(
    request: RecoverRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """칼럼으로 결석 복구 요청"""
    # 칼럼 확인 (본인 작성 칼럼만)
    column = db.query(TeamColumn).filter(
        TeamColumn.id == request.column_id,
        TeamColumn.author_id == current_user.id
    ).first()

    if not column:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="본인이 작성한 칼럼만 사용할 수 있습니다"
        )

    # 날짜 파싱
    try:
        target_date = date.fromisoformat(request.date)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="잘못된 날짜 형식입니다 (YYYY-MM-DD)"
        )

    # 해당 날짜 출석 기록 확인
    attendance = db.query(Attendance).filter(
        Attendance.user_id == current_user.id,
        Attendance.date == target_date
    ).first()

    if not attendance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="해당 날짜의 출석 기록이 없습니다"
        )

    if attendance.status == 'present':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 출석 처리된 날짜입니다"
        )

    if attendance.status == 'recovered':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 복구된 날짜입니다"
        )

    # 복구 요청 (대기 상태 - 매니저 승인 필요)
    attendance.recovered_by_column_id = column.id
    attendance.status = 'pending_recovery'
    db.commit()
    db.refresh(attendance)

    return APIResponse(
        success=True,
        data=attendance_to_dict(attendance),
        message="복구 요청이 제출되었습니다. 팀장 승인을 기다려주세요."
    )


@router.get("/pending", response_model=APIResponse)
async def get_pending_recoveries(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_manager)
):
    """복구 대기 중인 출석 기록 (매니저만)"""
    pending = db.query(Attendance).filter(
        Attendance.status == 'pending_recovery'
    ).all()

    result = []
    for att in pending:
        user = db.query(User).filter(User.id == att.user_id).first()
        column = db.query(TeamColumn).filter(TeamColumn.id == att.recovered_by_column_id).first() if att.recovered_by_column_id else None

        result.append({
            **attendance_to_dict(att),
            "user": {
                "id": user.id,
                "username": user.username,
                "full_name": user.full_name
            } if user else None,
            "column": {
                "id": column.id,
                "title": column.title
            } if column else None
        })

    return APIResponse(
        success=True,
        data={"pending": result, "total": len(result)}
    )


@router.post("/{attendance_id}/approve", response_model=APIResponse)
async def approve_recovery(
    attendance_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_manager)
):
    """복구 승인 (매니저만)"""
    attendance = db.query(Attendance).filter(Attendance.id == attendance_id).first()

    if not attendance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="출석 기록을 찾을 수 없습니다"
        )

    if attendance.status != 'pending_recovery':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="복구 대기 상태가 아닙니다"
        )

    attendance.status = 'recovered'
    attendance.approved_by = current_user.id
    db.commit()
    db.refresh(attendance)

    return APIResponse(
        success=True,
        data=attendance_to_dict(attendance),
        message="복구가 승인되었습니다"
    )


@router.post("/{attendance_id}/reject", response_model=APIResponse)
async def reject_recovery(
    attendance_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_manager)
):
    """복구 거부 (매니저만)"""
    attendance = db.query(Attendance).filter(Attendance.id == attendance_id).first()

    if not attendance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="출석 기록을 찾을 수 없습니다"
        )

    if attendance.status != 'pending_recovery':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="복구 대기 상태가 아닙니다"
        )

    attendance.status = 'absent'
    attendance.recovered_by_column_id = None
    db.commit()
    db.refresh(attendance)

    return APIResponse(
        success=True,
        data=attendance_to_dict(attendance),
        message="복구 요청이 거부되었습니다"
    )


@router.get("/user/{user_id}", response_model=APIResponse)
async def get_user_attendance(
    user_id: int,
    year: Optional[int] = None,
    month: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """특정 사용자의 출석 기록 조회"""
    target_year = year or date.today().year
    target_month = month or date.today().month

    start_date = date(target_year, target_month, 1)
    if target_month == 12:
        end_date = date(target_year + 1, 1, 1) - timedelta(days=1)
    else:
        end_date = date(target_year, target_month + 1, 1) - timedelta(days=1)

    attendances = db.query(Attendance).filter(
        Attendance.user_id == user_id,
        Attendance.date >= start_date,
        Attendance.date <= end_date
    ).all()

    return APIResponse(
        success=True,
        data={
            "user_id": user_id,
            "year": target_year,
            "month": target_month,
            "attendances": [attendance_to_dict(a) for a in attendances]
        }
    )
