from typing import Any, Optional
from pydantic import BaseModel


class APIResponse(BaseModel):
    success: bool = True
    data: Optional[Any] = None
    message: str = "Success"


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: Optional[dict] = None


class ErrorResponse(BaseModel):
    success: bool = False
    error: ErrorDetail


class PaginationParams(BaseModel):
    page: int = 1
    limit: int = 20


class PaginatedResponse(BaseModel):
    total: int
    page: int
    limit: int
