"""Ingestion pipeline for knowledge base documents."""
from __future__ import annotations

import logging
import uuid

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.knowledge.chunking import chunk_document
from app.knowledge.embeddings import get_embedding_service
from app.models.knowledge import KnowledgeChunk, KnowledgeDocument

logger = logging.getLogger("resolveai.knowledge")


async def ingest_document(
    session: AsyncSession,
    document_id: uuid.UUID,
    content_text: str | None = None,
) -> KnowledgeDocument:
    """Process a knowledge document: chunk, embed, and store its chunks.

    Handles both initial ingestion and re-indexing when document content is updated.
    Guarantees atomic chunk replacement and sets status to 'ready' on completion
    or 'failed' on error.
    """
    doc = await session.get(KnowledgeDocument, document_id)
    if not doc:
        raise ValueError(f"KnowledgeDocument {document_id} not found")

    text_to_ingest = content_text if content_text is not None else doc.content_text
    if not text_to_ingest or not text_to_ingest.strip():
        # Empty document - remove chunks and mark ready with 0 chunks
        await session.execute(
            delete(KnowledgeChunk).where(KnowledgeChunk.document_id == document_id)
        )
        doc.status = "ready"
        doc.chunk_count = 0
        doc.content_text = text_to_ingest
        await session.flush()
        return doc

    doc.status = "processing"
    doc.content_text = text_to_ingest
    await session.flush()

    try:
        # 1. Chunk document
        chunks_data = chunk_document(text_to_ingest)
        if not chunks_data:
            doc.status = "ready"
            doc.chunk_count = 0
            await session.flush()
            return doc

        # 2. Generate embeddings
        embed_service = get_embedding_service()
        chunk_texts = [c.content for c in chunks_data]
        embeddings = await embed_service.embed_texts(chunk_texts)

        # 3. Atomically remove stale chunks (ensures no orphaned embeddings on doc edit)
        await session.execute(
            delete(KnowledgeChunk).where(KnowledgeChunk.document_id == document_id)
        )

        # 4. Insert new chunks
        for data, emb in zip(chunks_data, embeddings):
            chunk = KnowledgeChunk(
                document_id=doc.id,
                chunk_index=data.chunk_index,
                content=data.content,
                token_count=data.token_count,
                metadata_={
                    **data.metadata,
                    "title": doc.title,
                    "category": doc.category,
                    "version": doc.version + 1,
                },
                embedding=emb,
            )
            session.add(chunk)

        # 5. Update document metadata and status
        doc.status = "ready"
        doc.version = doc.version + 1
        doc.chunk_count = len(chunks_data)
        doc.embedding_model = embed_service.model_name
        doc.embedding_dim = embed_service.dim

        await session.flush()
        logger.info(
            "Ingested knowledge document %s ('%s'): %d chunks created (v%d)",
            doc.id,
            doc.title,
            doc.chunk_count,
            doc.version,
        )
        return doc

    except Exception as exc:
        logger.exception(
            "Knowledge ingestion failed for document %s: %s",
            document_id,
            exc,
        )
        doc.status = "failed"
        await session.flush()
        raise


async def reindex_all_seed_knowledge(session: AsyncSession) -> int:
    """Re-index all seeded knowledge documents with embeddings."""
    stmt = select(KnowledgeDocument).where(KnowledgeDocument.content_text.isnot(None))
    docs = (await session.execute(stmt)).scalars().all()
    count = 0
    for doc in docs:
        await ingest_document(session, doc.id)
        count += 1
    await session.commit()
    return count
