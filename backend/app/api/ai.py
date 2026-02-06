from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.schemas.common import APIResponse
from app.services.ai_service import AIService
from app.dependencies import get_current_user, get_manager_or_admin
from app.models.user import User

router = APIRouter()


class GenerateDecisionNoteRequest(BaseModel):
    session_ids: List[int]
    position_id: Optional[int] = None


class GenerateOperationReportRequest(BaseModel):
    position_id: int


@router.get("/status", response_model=APIResponse)
async def get_ai_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """AI 사용 가능 여부 및 남은 횟수 조회"""
    ai_service = AIService(db)
    status_data = ai_service.get_ai_status()

    return APIResponse(
        success=True,
        data=status_data
    )


@router.post("/generate-decision-note", response_model=APIResponse)
async def generate_decision_note(
    request: GenerateDecisionNoteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_manager_or_admin)
):
    """AI로 의사결정서 생성 (매니저/관리자만)

    토론 세션들을 분석하여 체계적인 의사결정서를 자동 생성합니다.
    일일 사용 제한: 팀 전체 3회
    """
    if not request.session_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="최소 1개 이상의 세션을 선택해주세요"
        )

    ai_service = AIService(db)
    result = ai_service.generate_decision_note(
        session_ids=request.session_ids,
        position_id=request.position_id
    )

    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error", "AI 생성에 실패했습니다")
        )

    return APIResponse(
        success=True,
        data={
            "content": result["content"],
            "remaining_uses": result["remaining_uses"],
            "sessions_analyzed": result["sessions_analyzed"]
        },
        message="의사결정서가 생성되었습니다"
    )


@router.post("/generate-operation-report", response_model=APIResponse)
async def generate_operation_report(
    request: GenerateOperationReportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_manager_or_admin)
):
    """AI로 운용보고서 생성 (매니저/관리자만)

    포지션의 모든 정보(요청, 매매계획, 의사결정서, 토론 등)를 수집하여
    구조화된 운용보고서를 자동 생성합니다.

    일일 사용 제한: 팀 전체 3회
    """
    ai_service = AIService(db)
    result = ai_service.generate_operation_report(position_id=request.position_id)

    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error", "AI 생성에 실패했습니다")
        )

    return APIResponse(
        success=True,
        data={
            "content": result["content"],
            "remaining_uses": result["remaining_uses"],
            "position_id": result["position_id"]
        },
        message="운용보고서가 생성되었습니다"
    )


@router.get("/position-data/{position_id}", response_model=APIResponse)
async def get_position_data(
    position_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """포지션의 모든 관련 데이터 조회 (운용보고서 미리보기용)"""
    ai_service = AIService(db)
    data = ai_service.collect_position_data(position_id)

    if not data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="포지션을 찾을 수 없습니다"
        )

    return APIResponse(
        success=True,
        data=data
    )
