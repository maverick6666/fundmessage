from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.auth import (
    LoginRequest, RefreshRequest, Token, TokenRefreshResponse,
    SendVerificationRequest, VerifyCodeRequest, SignupRequest, SignupResponse
)
from app.schemas.user import UserCreate, UserResponse
from app.schemas.common import APIResponse
from app.services.auth_service import AuthService
from app.services.email_service import EmailService
from app.utils.security import create_access_token, create_refresh_token, decode_token
from app.config import settings
from app.dependencies import get_manager_or_admin
from app.models.user import User, UserRole

router = APIRouter()


# ===== 회원가입 관련 =====

@router.post("/send-verification", response_model=APIResponse)
async def send_verification(
    data: SendVerificationRequest,
    db: Session = Depends(get_db)
):
    """이메일 인증 코드 발송"""
    auth_service = AuthService(db)
    email_service = EmailService(db)

    # 이미 가입된 이메일인지 확인
    if auth_service.get_user_by_email(data.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="이미 가입된 이메일입니다"
        )

    # 인증 코드 생성 및 발송
    code = email_service.create_verification(data.email)
    success = email_service.send_verification_email(data.email, code)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="이메일 발송에 실패했습니다"
        )

    return APIResponse(
        success=True,
        message="인증 코드가 발송되었습니다"
    )


@router.post("/verify-code", response_model=APIResponse)
async def verify_code(
    data: VerifyCodeRequest,
    db: Session = Depends(get_db)
):
    """이메일 인증 코드 확인"""
    email_service = EmailService(db)

    if not email_service.verify_code(data.email, data.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="유효하지 않거나 만료된 인증 코드입니다"
        )

    return APIResponse(
        success=True,
        message="이메일이 인증되었습니다"
    )


@router.post("/signup", response_model=APIResponse, status_code=status.HTTP_201_CREATED)
async def signup(
    data: SignupRequest,
    db: Session = Depends(get_db)
):
    """회원가입 (팀장 승인 필요)"""
    auth_service = AuthService(db)

    # 이미 가입된 이메일인지 확인
    if auth_service.get_user_by_email(data.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="이미 가입된 이메일입니다"
        )

    # username 자동 생성 (이메일 앞부분 사용)
    username = data.username or data.email.split('@')[0]

    # 이미 사용 중인 사용자명인지 확인 (중복 시 숫자 추가)
    base_username = username
    counter = 1
    while auth_service.get_user_by_username(username):
        username = f"{base_username}{counter}"
        counter += 1

    # 첫 번째 사용자는 팀장으로 자동 설정, 이후는 모두 팀원
    is_first_user = auth_service.get_user_count() == 0
    role = UserRole.MANAGER.value if is_first_user else UserRole.MEMBER.value

    user_data = UserCreate(
        email=data.email,
        password=data.password,
        username=username,
        full_name=data.full_name,
        role=role
    )

    user = auth_service.create_user(user_data, is_active=is_first_user)

    if is_first_user:
        return APIResponse(
            success=True,
            data=SignupResponse(
                message="회원가입이 완료되었습니다. 바로 로그인할 수 있습니다.",
                requires_approval=False
            )
        )
    else:
        return APIResponse(
            success=True,
            data=SignupResponse(
                message="회원가입이 완료되었습니다. 팀장의 승인 후 로그인할 수 있습니다.",
                requires_approval=True
            )
        )


# ===== 로그인 관련 =====

@router.post("/login", response_model=APIResponse)
async def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    """로그인"""
    auth_service = AuthService(db)

    # 먼저 사용자 존재 여부 확인
    user = auth_service.get_user_by_email(login_data.email)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="이메일 또는 비밀번호가 올바르지 않습니다"
        )

    # 비밀번호 확인
    from app.utils.security import verify_password
    if not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="이메일 또는 비밀번호가 올바르지 않습니다"
        )

    # 활성화 상태 확인
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="계정이 아직 승인되지 않았습니다. 팀장의 승인을 기다려주세요."
        )

    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})

    return APIResponse(
        success=True,
        data=Token(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=settings.access_token_expire_minutes * 60,
            user=UserResponse.model_validate(user)
        )
    )


@router.post("/refresh", response_model=APIResponse)
async def refresh_token(refresh_data: RefreshRequest, db: Session = Depends(get_db)):
    """Access Token 갱신"""
    payload = decode_token(refresh_data.refresh_token)

    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 토큰입니다"
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 토큰입니다"
        )

    auth_service = AuthService(db)
    user = auth_service.get_user_by_id(int(user_id))

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="사용자를 찾을 수 없거나 비활성화된 계정입니다"
        )

    access_token = create_access_token(data={"sub": str(user.id)})

    return APIResponse(
        success=True,
        data=TokenRefreshResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=settings.access_token_expire_minutes * 60
        )
    )


# ===== 기존 관리자 등록 (하위 호환) =====

@router.post("/register", response_model=APIResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_manager_or_admin)
):
    """사용자 등록 (관리자/팀장 전용)"""
    auth_service = AuthService(db)
    user = auth_service.create_user(user_data, is_active=True)

    return APIResponse(
        success=True,
        data={"user": UserResponse.model_validate(user)},
        message="사용자가 등록되었습니다"
    )
