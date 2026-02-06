from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

from app.schemas.user import UserBrief


class DiscussionCreate(BaseModel):
    request_id: Optional[int] = None
    position_id: Optional[int] = None
    title: str = Field(..., max_length=200)


class DiscussionClose(BaseModel):
    summary: Optional[str] = None


class MessageCreate(BaseModel):
    content: str = Field(..., min_length=1)
    message_type: str = "text"  # text, chart
    chart_data: Optional[dict] = None  # 차트 메시지일 때 캔들 데이터


class MessageResponse(BaseModel):
    id: int
    discussion_id: int
    user: UserBrief
    content: str
    message_type: str
    chart_data: Optional[dict] = None
    created_at: datetime

    class Config:
        from_attributes = True


class DiscussionResponse(BaseModel):
    id: int
    request_id: Optional[int] = None
    position_id: Optional[int] = None
    title: str
    status: str
    summary: Optional[str]
    opened_by: UserBrief
    closed_by: Optional[UserBrief] = None
    opened_at: datetime
    closed_at: Optional[datetime]
    message_count: int = 0

    class Config:
        from_attributes = True


class DiscussionExport(BaseModel):
    discussion: dict
    participants: List[dict]
    messages: List[dict]


class DiscussionMessagesResponse(BaseModel):
    messages: List[MessageResponse]
    total: int
    page: int = 1
    limit: int = 50
