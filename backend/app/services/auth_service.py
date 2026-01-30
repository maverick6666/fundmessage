from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException, status

from app.models.user import User, UserRole
from app.schemas.user import UserCreate
from app.utils.security import verify_password, get_password_hash


class AuthService:
    def __init__(self, db: Session):
        self.db = db

    def get_user_by_email(self, email: str) -> Optional[User]:
        return self.db.query(User).filter(User.email == email).first()

    def get_user_by_username(self, username: str) -> Optional[User]:
        return self.db.query(User).filter(User.username == username).first()

    def get_user_by_id(self, user_id: int) -> Optional[User]:
        return self.db.query(User).filter(User.id == user_id).first()

    def get_manager(self) -> Optional[User]:
        """팀장 조회"""
        return self.db.query(User).filter(User.role == UserRole.MANAGER.value).first()

    def get_user_count(self) -> int:
        """전체 사용자 수"""
        return self.db.query(func.count(User.id)).scalar()

    def get_pending_users(self) -> List[User]:
        """승인 대기 중인 사용자 목록"""
        return self.db.query(User).filter(User.is_active == False).all()

    def approve_user(self, user_id: int) -> User:
        """사용자 승인"""
        user = self.get_user_by_id(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="사용자를 찾을 수 없습니다"
            )
        user.is_active = True
        self.db.commit()
        self.db.refresh(user)
        return user

    def deactivate_user(self, user_id: int) -> User:
        """사용자 비활성화"""
        user = self.get_user_by_id(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="사용자를 찾을 수 없습니다"
            )
        user.is_active = False
        self.db.commit()
        self.db.refresh(user)
        return user

    def create_user(self, user_data: UserCreate, is_active: bool = True) -> User:
        # Check if email exists
        if self.get_user_by_email(user_data.email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="이미 가입된 이메일입니다"
            )

        # Check if username exists
        if self.get_user_by_username(user_data.username):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="이미 사용 중인 사용자명입니다"
            )

        user = User(
            email=user_data.email,
            username=user_data.username,
            password_hash=get_password_hash(user_data.password),
            full_name=user_data.full_name,
            role=user_data.role,
            is_active=is_active
        )

        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)

    def authenticate_user(self, email: str, password: str) -> Optional[User]:
        user = self.get_user_by_email(email)
        if not user:
            return None
        if not verify_password(password, user.password_hash):
            return None
        if not user.is_active:
            return None
        return user

    def get_all_users(self, role: Optional[str] = None, is_active: Optional[bool] = None):
        query = self.db.query(User)

        if role:
            query = query.filter(User.role == role)
        if is_active is not None:
            query = query.filter(User.is_active == is_active)

        return query.all()

    def update_user_role(self, user_id: int, new_role: str) -> User:
        user = self.get_user_by_id(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        user.role = new_role
        self.db.commit()
        self.db.refresh(user)

        return user
