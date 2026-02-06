from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class TeamColumnBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    content: str = Field(..., min_length=1)


class TeamColumnCreate(TeamColumnBase):
    pass


class TeamColumnUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    content: Optional[str] = Field(None, min_length=1)


class AuthorBrief(BaseModel):
    id: int
    username: str
    full_name: str

    class Config:
        from_attributes = True


class TeamColumnResponse(BaseModel):
    id: int
    title: str
    content: str
    author_id: int
    author: Optional[AuthorBrief] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TeamColumnListItem(BaseModel):
    id: int
    title: str
    author_id: int
    author: Optional[AuthorBrief] = None
    created_at: datetime

    class Config:
        from_attributes = True
