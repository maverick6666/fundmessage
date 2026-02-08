from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class CommentCreate(BaseModel):
    document_type: str = Field(..., description="문서 유형: decision_note, report, column, ai_column, news")
    document_id: int = Field(..., description="문서 ID")
    content: str = Field(..., min_length=1, max_length=2000, description="댓글 내용")


class CommentUpdate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000, description="수정할 댓글 내용")


class CommentAuthor(BaseModel):
    id: int
    username: str
    full_name: str

    class Config:
        from_attributes = True


class CommentResponse(BaseModel):
    id: int
    user_id: int
    user: Optional[CommentAuthor] = None
    document_type: str
    document_id: int
    content: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CommentListResponse(BaseModel):
    comments: List[CommentResponse]
    total: int
