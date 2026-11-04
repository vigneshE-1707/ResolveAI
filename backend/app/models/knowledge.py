"""KnowledgeDocument and KnowledgeChunk models."""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator

from app.db.base import Base, UUIDMixin, TimestampMixin


class VectorType(TypeDecorator):
    """Universal vector representation supporting native pgvector or JSONB storage."""

    impl = JSONB
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if hasattr(value, "tolist"):
            return value.tolist()
        return list(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
                if isinstance(parsed, list):
                    return [float(x) for x in parsed]
            except Exception:
                cleaned = value.strip("[]() ")
                if not cleaned:
                    return []
                return [float(x) for x in cleaned.split(",")]
        if isinstance(value, (list, tuple)):
            return [float(x) for x in value]
        return value


class KnowledgeDocument(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "knowledge_documents"

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(30), nullable=False)
    source_type: Mapped[str] = mapped_column(String(20), default="seed", server_default="'seed'")
    content_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="processing")
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    embedding_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    embedding_dim: Mapped[int | None] = mapped_column(Integer, nullable=True)
    chunk_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_by: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)

    chunks: Mapped[list[KnowledgeChunk]] = relationship(
        "KnowledgeChunk", back_populates="document", cascade="all, delete-orphan",
    )


class KnowledgeChunk(Base, UUIDMixin):
    __tablename__ = "knowledge_chunks"

    document_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("knowledge_documents.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    token_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSONB, nullable=True)
    embedding: Mapped[list[float] | None] = mapped_column("embedding", VectorType, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )

    document: Mapped[KnowledgeDocument] = relationship("KnowledgeDocument", back_populates="chunks")
