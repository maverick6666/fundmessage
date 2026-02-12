from typing import Optional
from pydantic import BaseModel, EmailStr, Field

from app.schemas.user import UserResponse


class LoginRequest(BaseModel):
    email: str  # 로그인 시에는 DB 조회만 하므로 엄격한 검증 불필요
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


# 회원가입 관련 스키마
class SendVerificationRequest(BaseModel):
    email: EmailStr


class VerifyCodeRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6)


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    username: Optional[str] = Field(None, min_length=3, max_length=50)  # 자동 생성
    full_name: str = Field(..., min_length=2, max_length=100)
    role: str = Field(default="member", pattern="^(member|manager|admin)$")  # 기본값: 팀원


class SignupResponse(BaseModel):
    message: str
    requires_approval: bool = True  # 팀장 승인 필요


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse


class TokenRefreshResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    expires_in: int


class TokenPayload(BaseModel):
    sub: Optional[str] = None
    exp: Optional[int] = None
    type: Optional[str] = None
