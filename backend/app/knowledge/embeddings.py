"""Embeddings generation for knowledge documents and search queries.

Uses Gemini embeddings (dimension 768) when configured with GOOGLE_API_KEY,
with an offline deterministic semantic embedding fallback for local testing.
"""
from __future__ import annotations

import hashlib
import logging
import math
import re
from typing import Sequence

from app.core.config import settings

logger = logging.getLogger("resolveai.knowledge")

EMBEDDING_DIM: int = 768
DEFAULT_EMBEDDING_MODEL: str = "gemini-embedding-001"

_STOP_WORDS = {
    "a", "about", "above", "after", "again", "all", "am", "an", "and", "any", "are",
    "as", "at", "be", "because", "been", "before", "being", "below", "between",
    "both", "by", "can", "did", "do", "does", "doing", "down", "during", "each",
    "few", "for", "from", "further", "had", "has", "have", "having", "he", "her",
    "here", "hers", "herself", "him", "himself", "his", "how", "i", "if", "in",
    "into", "is", "it", "its", "itself", "just", "me", "more", "most", "my",
    "myself", "no", "nor", "not", "now", "of", "off", "on", "once", "only", "or",
    "other", "our", "ours", "ourselves", "out", "over", "own", "same", "she",
    "should", "so", "some", "such", "than", "that", "the", "their", "theirs",
    "them", "themselves", "then", "there", "these", "they", "this", "those",
    "through", "to", "too", "under", "until", "up", "very", "was", "we", "were",
    "what", "when", "where", "which", "while", "who", "whom", "why", "with",
    "would", "you", "your", "yours", "yourself", "yourselves",
}


def _deterministic_semantic_vector(text: str, dim: int = EMBEDDING_DIM) -> list[float]:
    """Generate a deterministic, semantic, L2-normalized vector for testing/offline use.

    Uses stemmed word frequency, character n-grams, and stop-word filtering
    so that documents sharing vocabulary produce high cosine similarity.
    """
    if not text:
        return [0.0] * dim

    vec = [0.0] * dim
    clean = text.lower()
    raw_words = re.findall(r"\w+", clean)
    words = [w for w in raw_words if w not in _STOP_WORDS]
    if not words:
        words = raw_words  # fallback if all were stop words

    for w in words:
        # 1. Stem approximation (suffix stripping)
        stem = re.sub(r"(ing|edly|edly|ed|es|s|ly|tion|ment)$", "", w)
        if len(stem) >= 3:
            sh = int(hashlib.sha256(f"stem:{stem}".encode()).hexdigest(), 16) % dim
            vec[sh] += 3.5

        # 2. Exact word hash
        wh = int(hashlib.sha256(f"word:{w}".encode()).hexdigest(), 16) % dim
        vec[wh] += 2.0

        # 3. Character 3-grams and 4-grams for subword similarity
        for n in (3, 4):
            for i in range(len(w) - n + 1):
                gram = w[i : i + n]
                gh = int(hashlib.md5(f"gram:{gram}".encode()).hexdigest(), 16) % dim
                vec[gh] += 0.6

    norm = math.sqrt(sum(v * v for v in vec))
    if norm < 1e-9:
        return [0.0] * dim
    return [v / norm for v in vec]


def _normalize_vec(vec: Sequence[float]) -> list[float]:
    norm = math.sqrt(sum(v * v for v in vec))
    if norm < 1e-9:
        return [0.0] * len(vec)
    return [v / norm for v in vec]


class EmbeddingService:
    """Generates embeddings for knowledge chunks and search queries."""

    def __init__(self, model_name: str = DEFAULT_EMBEDDING_MODEL, dim: int = EMBEDDING_DIM):
        self.model_name = model_name
        self.dim = dim
        self._live_embedder = None
        self._init_live_embedder()

    def _init_live_embedder(self) -> None:
        api_key = settings.google_api_key
        if not api_key:
            logger.info("No GOOGLE_API_KEY configured; using offline deterministic embeddings.")
            return

        try:
            from langchain_google_genai import GoogleGenerativeAIEmbeddings

            self._live_embedder = GoogleGenerativeAIEmbeddings(
                model=f"models/{self.model_name}",
                google_api_key=api_key,
                output_dimensionality=self.dim,
            )
            logger.info("Initialized live Gemini embeddings model: %s", self.model_name)
        except Exception as exc:
            logger.warning(
                "Failed to initialize live Gemini embedder; falling back to offline embeddings: %s",
                exc,
            )
            self._live_embedder = None

    async def embed_texts(self, texts: Sequence[str]) -> list[list[float]]:
        """Embed a list of text passages."""
        if not texts:
            return []

        cleaned_texts = [t.strip() for t in texts]

        if self._live_embedder is not None:
            try:
                embeddings = await self._live_embedder.aembed_documents(list(texts))
                return [_normalize_vec(list(emb)) for emb in embeddings]
            except Exception as exc:
                logger.warning(
                    "Live embedding call failed, using deterministic fallback: %s",
                    exc,
                )

        return [_deterministic_semantic_vector(t, self.dim) for t in texts]

    async def embed_query(self, query: str) -> list[float]:
        """Embed a single search query."""
        if not query or not query.strip():
            return [0.0] * self.dim

        if self._live_embedder is not None:
            try:
                emb = await self._live_embedder.aembed_query(query)
                return _normalize_vec(list(emb))
            except Exception as exc:
                logger.warning(
                    "Live query embedding call failed, using deterministic fallback: %s",
                    exc,
                )

        return _deterministic_semantic_vector(query, self.dim)


_embedding_service: EmbeddingService | None = None


def get_embedding_service() -> EmbeddingService:
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service
