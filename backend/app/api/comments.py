from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.schemas.common import APIResponse
from app.schemas.comment import CommentCreate, CommentUpdate
from app.models.comment import Comment
from app.dependencies import get_current_user
from app.models.user import User
from app.utils.constants import KST

VALID_DOCUMENT_TYPES = {"decision_note", "report", "column", "ai_column", "news"}

router = APIRouter()


def comment_to_dict(comment: Comment) -> dict:
    return {
        "id": comment.id,
        "user_id": comment.user_id,
        "user": {
            "id": comment.user.id,
            "username": comment.user.username,
            "full_name": comment.user.full_name
        } if comment.user else None,
        "document_type": comment.document_type,
        "document_id": comment.document_id,
        "content": comment.content,
        "created_at": comment.created_at.isoformat() if comment.created_at else None,
        "updated_at": comment.updated_at.isoformat() if comment.updated_at else None,
    }


@router.get("", response_model=APIResponse)
async def get_comments(
    document_type: str = Query(..., description="문서 유형"),
    document_id: int = Query(..., description="문서 ID"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """댓글 목록 조회"""
    if document_type not in VALID_DOCUMENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"유효하지 않은 문서 유형입니다. 허용: {', '.join(VALID_DOCUMENT_TYPES)}"
        )

    query = db.query(Comment).options(
        joinedload(Comment.user)
    ).filter(
        Comment.document_type == document_type,
        Comment.document_id == document_id
    )

    total = query.count()
    comments = query.order_by(Comment.created_at.asc()).offset(skip).limit(limit).all()

    return APIResponse(
        success=True,
        data={
            "comments": [comment_to_dict(c) for c in comments],
            "total": total,
        }
    )


@router.post("", response_model=APIResponse)
async def create_comment(
    comment_data: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """댓글 작성 (모든 인증 사용자 - viewer 포함)"""
    if comment_data.document_type not in VALID_DOCUMENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"유효하지 않은 문서 유형입니다. 허용: {', '.join(VALID_DOCUMENT_TYPES)}"
        )

    comment = Comment(
        user_id=current_user.id,
        document_type=comment_data.document_type,
        document_id=comment_data.document_id,
        content=comment_data.content,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    # Reload with user relationship
    comment = db.query(Comment).options(
        joinedload(Comment.user)
    ).filter(Comment.id == comment.id).first()

    return APIResponse(
        success=True,
        data=comment_to_dict(comment),
        message="댓글이 작성되었습니다"
    )


@router.put("/{comment_id}", response_model=APIResponse)
async def update_comment(
    comment_id: int,
    comment_data: CommentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """댓글 수정 (작성자만)"""
    comment = db.query(Comment).options(
        joinedload(Comment.user)
    ).filter(Comment.id == comment_id).first()

    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="댓글을 찾을 수 없습니다"
        )

    if comment.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="작성자만 수정할 수 있습니다"
        )

    comment.content = comment_data.content
    comment.updated_at = datetime.now(KST)

    db.commit()
    db.refresh(comment)

    return APIResponse(
        success=True,
        data=comment_to_dict(comment),
        message="댓글이 수정되었습니다"
    )


@router.delete("/{comment_id}", response_model=APIResponse)
async def delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """댓글 삭제 (작성자 또는 manager)"""
    comment = db.query(Comment).filter(Comment.id == comment_id).first()

    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="댓글을 찾을 수 없습니다"
        )

    is_author = comment.user_id == current_user.id
    is_manager = current_user.role == 'manager'

    if not is_author and not is_manager:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="작성자 또는 팀장만 삭제할 수 있습니다"
        )

    db.delete(comment)
    db.commit()

    return APIResponse(
        success=True,
        message="댓글이 삭제되었습니다"
    )
