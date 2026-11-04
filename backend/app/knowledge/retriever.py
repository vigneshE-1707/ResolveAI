"""Vector search and retrieval over knowledge chunks."""
from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from typing import Any

import numpy as np
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.knowledge.embeddings import get_embedding_service
from app.models.knowledge import KnowledgeChunk, KnowledgeDocument

logger = logging.getLogger("resolveai.knowledge")


@dataclass(frozen=True)
class KnowledgeHit:
    document_id: uuid.UUID
    chunk_id: uuid.UUID
    title: str
    category: str
    chunk_index: int
    content: str
    score: float

    def to_dict(self) -> dict[str, Any]:
        return {
            "document_id": str(self.document_id),
            "chunk_id": str(self.chunk_id),
            "title": self.title,
            "category": self.category,
            "chunk_index": self.chunk_index,
            "content": self.content,
            "score": round(self.score, 4),
        }


async def _has_pgvector_extension(session: AsyncSession) -> bool:
    """Check if pgvector extension is installed in Postgres."""
    try:
        res = await session.execute(
            text("SELECT 1 FROM pg_extension WHERE extname = 'vector';")
        )
        return bool(res.scalar())
    except Exception:
        return False


async def search_knowledge_base(
    session: AsyncSession,
    query: str,
    *,
    top_k: int = 4,
    category: str | None = None,
    min_score: float = 0.20,
) -> list[KnowledgeHit]:
    """Retrieve the most relevant knowledge chunks for a query.

    Only searches documents whose status is 'ready'. Uses pgvector native cosine
    distance when available, or high-performance vector dot-product when in offline/fallback mode.
    """
    if not query or not query.strip():
        return []

    # Sanitize category
    if not isinstance(category, str) or not category.strip():
        category = None

    embed_service = get_embedding_service()
    query_vec = await embed_service.embed_query(query.strip())
    q_norm = float(np.linalg.norm(query_vec))
    if q_norm < 1e-9:
        return []

    use_pgvector = await _has_pgvector_extension(session)

    if use_pgvector:
        try:
            sql = """
                SELECT c.id, c.document_id, c.chunk_index, c.content, d.title, d.category,
                       (1.0 - (c.embedding <=> :query_vec::vector)) as score
                FROM knowledge_chunks c
                JOIN knowledge_documents d ON c.document_id = d.id
                WHERE d.status = 'ready'
                  AND c.embedding IS NOT NULL
            """
            params: dict[str, Any] = {"query_vec": str(query_vec)}
            if category:
                sql += " AND d.category = :category"
                params["category"] = category
            sql += " ORDER BY c.embedding <=> :query_vec::vector ASC LIMIT :top_k"
            params["top_k"] = top_k

            res = await session.execute(text(sql), params)
            hits: list[KnowledgeHit] = []
            for row in res.fetchall():
                score = float(row[6])
                if score >= min_score:
                    hits.append(
                        KnowledgeHit(
                            chunk_id=row[0],
                            document_id=row[1],
                            chunk_index=row[2],
                            content=row[3],
                            title=row[4],
                            category=row[5],
                            score=score,
                        )
                    )
            return hits
        except Exception as exc:
            logger.warning("Native pgvector search failed; falling back to in-memory: %s", exc)

    # In-memory vector similarity fallback (Windows without Docker or offline)
    stmt = (
        select(KnowledgeChunk)
        .join(KnowledgeDocument, KnowledgeChunk.document_id == KnowledgeDocument.id)
        .where(
            KnowledgeDocument.status == "ready",
            KnowledgeChunk.embedding.isnot(None),
        )
        .options(selectinload(KnowledgeChunk.document))
    )
    if category:
        stmt = stmt.where(KnowledgeDocument.category == category)

    res = await session.execute(stmt)
    chunks = res.scalars().all()
    if not chunks:
        return []

    candidates: list[tuple[float, KnowledgeChunk]] = []
    q_arr = np.array(query_vec, dtype=np.float32)

    for chunk in chunks:
        if not chunk.embedding:
            continue
        c_arr = np.array(chunk.embedding, dtype=np.float32)
        c_norm = float(np.linalg.norm(c_arr))
        if c_norm < 1e-9:
            continue
        cos_sim = float(np.dot(q_arr, c_arr) / (q_norm * c_norm))
        if cos_sim >= min_score:
            candidates.append((cos_sim, chunk))

    candidates.sort(key=lambda x: x[0], reverse=True)
    top_candidates = candidates[:top_k]

    hits = [
        KnowledgeHit(
            document_id=chunk.document_id,
            chunk_id=chunk.id,
            title=chunk.document.title if chunk.document else "",
            category=chunk.document.category if chunk.document else "",
            chunk_index=chunk.chunk_index,
            content=chunk.content,
            score=score,
        )
        for score, chunk in top_candidates
    ]
    return hits
