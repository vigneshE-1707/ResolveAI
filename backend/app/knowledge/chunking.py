"""Text chunking utilities for the knowledge retrieval pipeline."""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class TextChunk:
    chunk_index: int
    content: str
    token_count: int
    metadata: dict[str, Any]


_WHITESPACE_RE = re.compile(r"\s+")


def count_tokens(text: str) -> int:
    """Approximate token count based on whitespace and punctuation."""
    if not text:
        return 0
    words = _WHITESPACE_RE.split(text.strip())
    return max(1, int(len(words) * 1.3))


def chunk_document(
    text: str,
    *,
    max_tokens: int = 350,
    overlap_sentences: int = 1,
) -> list[TextChunk]:
    """Split text into semantically cohesive chunks.

    Separates by paragraphs (double newlines). If an individual paragraph exceeds
    ``max_tokens``, it is split at sentence boundaries.
    """
    if not text or not text.strip():
        return []

    raw_paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    if not raw_paragraphs:
        raw_paragraphs = [text.strip()]

    chunks: list[TextChunk] = []
    chunk_idx = 0

    for paragraph in raw_paragraphs:
        p_tokens = count_tokens(paragraph)

        # If paragraph exceeds max_tokens, split into sentence-based sub-chunks
        if p_tokens > max_tokens:
            sentences = re.split(r"(?<=[.!?])\s+", paragraph)
            sub_parts: list[str] = []
            sub_tokens = 0
            for sent in sentences:
                sent = sent.strip()
                if not sent:
                    continue
                s_toks = count_tokens(sent)
                if sub_tokens + s_toks > max_tokens and sub_parts:
                    combined = " ".join(sub_parts)
                    chunks.append(
                        TextChunk(
                            chunk_index=chunk_idx,
                            content=combined,
                            token_count=count_tokens(combined),
                            metadata={"chunk_index": chunk_idx},
                        )
                    )
                    chunk_idx += 1
                    sub_parts = sub_parts[-overlap_sentences:] if overlap_sentences > 0 else []
                    sub_tokens = sum(count_tokens(s) for s in sub_parts)
                sub_parts.append(sent)
                sub_tokens += s_toks
            if sub_parts:
                combined = " ".join(sub_parts)
                chunks.append(
                    TextChunk(
                        chunk_index=chunk_idx,
                        content=combined,
                        token_count=count_tokens(combined),
                        metadata={"chunk_index": chunk_idx},
                    )
                )
                chunk_idx += 1
        else:
            chunks.append(
                TextChunk(
                    chunk_index=chunk_idx,
                    content=paragraph,
                    token_count=p_tokens,
                    metadata={"chunk_index": chunk_idx},
                )
            )
            chunk_idx += 1

    return chunks
