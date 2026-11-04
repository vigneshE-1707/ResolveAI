"""Unit tests for knowledge embedding generation."""
import math
import pytest
from app.knowledge.embeddings import (
    EMBEDDING_DIM,
    EmbeddingService,
    _deterministic_semantic_vector,
)


def cosine_similarity(v1: list[float], v2: list[float]) -> float:
    return sum(a * b for a, b in zip(v1, v2))


@pytest.mark.asyncio
async def test_embedding_dimension_and_norm():
    svc = EmbeddingService()
    vec = await svc.embed_query("What is the return policy?")
    assert len(vec) == EMBEDDING_DIM
    norm = math.sqrt(sum(x * x for x in vec))
    assert pytest.approx(norm, abs=1e-4) == 1.0


@pytest.mark.asyncio
async def test_empty_string_embedding():
    svc = EmbeddingService()
    vec = await svc.embed_query("")
    assert len(vec) == EMBEDDING_DIM
    assert all(x == 0.0 for x in vec)


@pytest.mark.asyncio
async def test_semantic_similarity_relative_ordering():
    svc = EmbeddingService()
    q = await svc.embed_query("How do I return a damaged product?")
    doc_returns = await svc.embed_query(
        "Items may be returned within 30 days of delivery. Proof of purchase required."
    )
    doc_warranty = await svc.embed_query(
        "Laptops and monitors include a 1-year limited manufacturer hardware warranty."
    )

    sim_returns = cosine_similarity(q, doc_returns)
    sim_warranty = cosine_similarity(q, doc_warranty)

    assert sim_returns > sim_warranty
    assert sim_returns > 0.20
