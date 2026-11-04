"""Knowledge retrieval subsystem: chunking, embedding, ingestion, and vector search."""
from app.knowledge.chunking import TextChunk, chunk_document, count_tokens
from app.knowledge.embeddings import (
    DEFAULT_EMBEDDING_MODEL,
    EMBEDDING_DIM,
    EmbeddingService,
    get_embedding_service,
)
from app.knowledge.ingest import ingest_document, reindex_all_seed_knowledge
from app.knowledge.retriever import KnowledgeHit, search_knowledge_base

__all__ = [
    "TextChunk",
    "chunk_document",
    "count_tokens",
    "EMBEDDING_DIM",
    "DEFAULT_EMBEDDING_MODEL",
    "EmbeddingService",
    "get_embedding_service",
    "ingest_document",
    "reindex_all_seed_knowledge",
    "KnowledgeHit",
    "search_knowledge_base",
]
