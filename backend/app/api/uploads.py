import os
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.common import APIResponse
from app.dependencies import get_current_user
from app.models.user import User
from app.config import settings

router = APIRouter()

# 업로드 디렉토리 설정
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
MAX_FILE_SIZE = 200 * 1024  # 200KB
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}


@router.post("/image", response_model=APIResponse)
async def upload_image(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """이미지 업로드 (최대 200KB)"""
    # 파일 타입 검증
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"허용되지 않는 파일 형식입니다. 허용: {', '.join(ALLOWED_TYPES)}"
        )

    # 파일 크기 읽기
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"파일 크기가 너무 큽니다. 최대 {MAX_FILE_SIZE // 1024}KB까지 허용됩니다."
        )

    # 업로드 디렉토리 생성
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    # 고유 파일명 생성
    ext = os.path.splitext(file.filename)[1] or ".png"
    unique_name = f"{datetime.utcnow().strftime('%Y%m%d')}_{uuid.uuid4().hex[:8]}{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_name)

    # 파일 저장
    with open(file_path, "wb") as f:
        f.write(content)

    # URL 생성
    file_url = f"/api/v1/uploads/files/{unique_name}"

    return APIResponse(
        success=True,
        data={
            "url": file_url,
            "filename": unique_name,
            "size": len(content),
            "content_type": file.content_type
        },
        message="이미지가 업로드되었습니다"
    )


@router.get("/files/{filename}")
async def get_file(filename: str):
    """업로드된 파일 조회"""
    from fastapi.responses import FileResponse

    file_path = os.path.join(UPLOAD_DIR, filename)

    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="파일을 찾을 수 없습니다"
        )

    return FileResponse(file_path)


@router.get("/disk-usage", response_model=APIResponse)
async def get_disk_usage(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """업로드 디스크 사용량 조회"""
    if not os.path.exists(UPLOAD_DIR):
        return APIResponse(
            success=True,
            data={
                "total_size": 0,
                "file_count": 0,
                "formatted_size": "0 KB"
            }
        )

    total_size = 0
    file_count = 0
    for filename in os.listdir(UPLOAD_DIR):
        file_path = os.path.join(UPLOAD_DIR, filename)
        if os.path.isfile(file_path):
            total_size += os.path.getsize(file_path)
            file_count += 1

    # 포맷팅
    if total_size < 1024:
        formatted = f"{total_size} B"
    elif total_size < 1024 * 1024:
        formatted = f"{total_size / 1024:.1f} KB"
    else:
        formatted = f"{total_size / (1024 * 1024):.1f} MB"

    return APIResponse(
        success=True,
        data={
            "total_size": total_size,
            "file_count": file_count,
            "formatted_size": formatted
        }
    )
