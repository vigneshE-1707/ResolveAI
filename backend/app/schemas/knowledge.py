"""Knowledge base schemas."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class KnowledgeDocumentCreate(BaseModel):
    title: str = Field(max_length=255)
    category: str = Field(pattern=r"^(returns|refunds|shipping|cancellation|warranty|faq)$")
    content_text: str | None = None


class KnowledgeDocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    category: str
    source_type: str
    status: str
    version: int
    embedding_model: str | None = None
    embedding_dim: int | None = None
    chunk_count: int
    created_at: datetime
    updated_at: datetime
