from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.user import UserResponse, UserRoleUpdate
from app.schemas.common import APIResponse
from app.services.auth_service import AuthService
from app.dependencies import get_current_user, get_manager_or_admin, get_manager
from app.models.user import User
from app.models.notification import Notification
from app.models.discussion import Discussion
from app.models.message import Message
from app.models.request import Request
from app.models.audit_log import AuditLog
from app.models.decision_note import DecisionNote

router = APIRouter()


@router.get("/me", response_model=APIResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user info"""
    return APIResponse(
        success=True,
        data=UserResponse.model_validate(current_user)
    )


@router.get("", response_model=APIResponse)
async def get_users(
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_manager_or_admin)
):
    """Get all users (admin/manager only)"""
    auth_service = AuthService(db)
    users = auth_service.get_all_users(role=role, is_active=is_active)

    return APIResponse(
        success=True,
        data={
            "users": [UserResponse.model_validate(u) for u in users],
            "total": len(users)
        }
    )


@router.get("/pending", response_model=APIResponse)
async def get_pending_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_manager_or_admin)
):
    """승인 대기 중인 사용자 목록 (팀장/관리자만)"""
    auth_service = AuthService(db)
    users = auth_service.get_pending_users()

    return APIResponse(
        success=True,
        data={
            "users": [UserResponse.model_validate(u) for u in users],
            "total": len(users)
        }
    )


@router.get("/{user_id}", response_model=APIResponse)
async def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get user by ID"""
    auth_service = AuthService(db)
    user = auth_service.get_user_by_id(user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return APIResponse(
        success=True,
        data=UserResponse.model_validate(user)
    )


@router.patch("/{user_id}/role", response_model=APIResponse)
async def update_user_role(
    user_id: int,
    role_data: UserRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_manager)
):
    """사용자 역할 변경 (팀장만 가능)"""
    from app.models.user import UserRole

    auth_service = AuthService(db)

    # 팀장으로 변경하려는 경우 확인
    if role_data.role == UserRole.MANAGER.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="팀장은 한 명만 가능합니다. 팀장 위임 기능을 사용하세요."
        )

    user = auth_service.update_user_role(user_id, role_data.role)

    return APIResponse(
        success=True,
        data={
            "id": user.id,
            "username": user.username,
            "role": user.role
        },
        message="역할이 변경되었습니다"
    )


@router.post("/{user_id}/approve", response_model=APIResponse)
async def approve_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_manager_or_admin)
):
    """사용자 승인 (팀장/관리자만)"""
    auth_service = AuthService(db)
    user = auth_service.approve_user(user_id)

    return APIResponse(
        success=True,
        data=UserResponse.model_validate(user),
        message=f"{user.full_name}님의 가입이 승인되었습니다"
    )


@router.post("/{user_id}/deactivate", response_model=APIResponse)
async def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_manager)
):
    """사용자 비활성화 (팀장만)"""
    auth_service = AuthService(db)

    # 자기 자신은 비활성화 불가
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="자기 자신은 비활성화할 수 없습니다"
        )

    user = auth_service.deactivate_user(user_id)

    return APIResponse(
        success=True,
        data=UserResponse.model_validate(user),
        message=f"{user.full_name}님의 계정이 비활성화되었습니다"
    )


@router.delete("/{user_id}", response_model=APIResponse)
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_manager)
):
    """사용자 완전 삭제 (팀장만) - 관련 데이터 모두 삭제"""
    auth_service = AuthService(db)

    # 자기 자신은 삭제 불가
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="자기 자신은 삭제할 수 없습니다"
        )

    user = auth_service.get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다"
        )

    if user.role == 'manager':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="팀장은 삭제할 수 없습니다"
        )

    user_name = user.full_name

    # 관련 데이터 삭제
    # 1. 알림 삭제
    db.query(Notification).filter(Notification.user_id == user_id).delete(synchronize_session=False)

    # 2. 메시지 user_id null 처리 (메시지 내용 보존)
    db.query(Message).filter(Message.user_id == user_id).update(
        {"user_id": None}, synchronize_session=False
    )

    # 3. 의사결정 노트 삭제
    db.query(DecisionNote).filter(DecisionNote.created_by == user_id).delete(synchronize_session=False)

    # 4. 감사 로그에서 user_id null 처리
    db.query(AuditLog).filter(AuditLog.user_id == user_id).update(
        {"user_id": None}, synchronize_session=False
    )

    # 5. 요청에서 requester_id, approved_by null 처리
    db.query(Request).filter(Request.requester_id == user_id).update(
        {"requester_id": None}, synchronize_session=False
    )
    db.query(Request).filter(Request.approved_by == user_id).update(
        {"approved_by": None}, synchronize_session=False
    )

    # 6. 토론에서 opened_by, closed_by null 처리
    db.query(Discussion).filter(Discussion.opened_by == user_id).update(
        {"opened_by": None}, synchronize_session=False
    )
    db.query(Discussion).filter(Discussion.closed_by == user_id).update(
        {"closed_by": None}, synchronize_session=False
    )

    # 7. 사용자 삭제
    db.delete(user)
    db.commit()

    return APIResponse(
        success=True,
        message=f"{user_name}님의 계정이 삭제되었습니다"
    )


@router.post("/{user_id}/transfer-manager", response_model=APIResponse)
async def transfer_manager_role(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_manager)
):
    """팀장 권한 이전 (현재 팀장만 가능)"""
    from app.models.user import UserRole

    auth_service = AuthService(db)

    # 자기 자신에게 이전 불가
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="자기 자신에게 이전할 수 없습니다"
        )

    # 대상 유저 확인
    new_manager = auth_service.get_user_by_id(user_id)
    if not new_manager:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="유저를 찾을 수 없습니다"
        )

    if not new_manager.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="비활성화된 유저에게 이전할 수 없습니다"
        )

    # 권한 이전: 현재 팀장 → 팀원, 대상 → 팀장
    current_user.role = UserRole.MEMBER.value
    new_manager.role = UserRole.MANAGER.value
    db.commit()

    return APIResponse(
        success=True,
        data={
            "previous_manager": current_user.full_name,
            "new_manager": new_manager.full_name
        },
        message=f"팀장 권한이 {new_manager.full_name}님에게 이전되었습니다"
    )
