"""Unit tests for knowledge chunking logic."""
from app.knowledge.chunking import chunk_document, count_tokens


def test_count_tokens():
    assert count_tokens("") == 0
    assert count_tokens("hello world") == 2
    long_str = " ".join(["word"] * 100)
    assert count_tokens(long_str) == 130


def test_chunk_empty_document():
    assert chunk_document("") == []
    assert chunk_document("   ") == []


def test_chunk_document_paragraphs():
    doc = (
        "Paragraph one is about return policies and warranties.\n\n"
        "Paragraph two is about refund processing within five business days.\n\n"
        "Paragraph three covers exceptions like final sale items."
    )
    chunks = chunk_document(doc, max_tokens=100)
    assert len(chunks) == 3
    assert "Paragraph one" in chunks[0].content
    assert "Paragraph two" in chunks[1].content
    assert "Paragraph three" in chunks[2].content


def test_chunk_document_large_paragraph_splits():
    # Construct a paragraph with multiple sentences that exceeds max_tokens
    sentence = "Items returned after thirty days are subject to restocking fees. "
    large_paragraph = sentence * 20  # ~260 tokens
    chunks = chunk_document(large_paragraph, max_tokens=50)
    assert len(chunks) > 1
    for c in chunks:
        assert c.token_count <= 80
        assert c.chunk_index >= 0
