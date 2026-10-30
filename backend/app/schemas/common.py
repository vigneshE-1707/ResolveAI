"""Shared/common schemas."""
from __future__ import annotations

from pydantic import BaseModel, Field


class PaginationMeta(BaseModel):
    page: int
    page_size: int
    total: int


class PaginatedResponse(BaseModel):
    data: list
    meta: PaginationMeta


class ErrorResponse(BaseModel):
    code: str
    message: str
    details: dict | None = None
    request_id: str | None = None


class HealthResponse(BaseModel):
    status: str
    database: str | None = None
    version: str = "0.1.0"


class MessageResponse(BaseModel):
    """Simple success message."""
    message: str
