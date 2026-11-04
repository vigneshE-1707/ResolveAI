"""Integration tests for the Knowledge Retrieval pipeline (Milestone 6)."""
from __future__ import annotations

import pytest
from sqlalchemy import select

from app.db.session import async_session_factory
from app.knowledge.ingest import ingest_document
from app.knowledge.retriever import search_knowledge_base
from app.mcp_client.client import MCPClient
from app.models.knowledge import KnowledgeChunk, KnowledgeDocument
from app.models.user import Customer


@pytest.mark.asyncio
async def test_ingest_and_retrieve_document(make_user):
    user_id = await make_user("CUSTOMER", "ingest_user@resolveai.app")
    async with async_session_factory() as session:
        # 1. Create document in processing state
        doc = KnowledgeDocument(
            title="International Shipping Policy",
            category="shipping",
            content_text=(
                "We offer express international delivery to over 50 countries worldwide.\n\n"
                "Customs fees and import tariffs are the sole responsibility of the customer.\n\n"
                "Standard transit times range from 7 to 14 business days depending on destination."
            ),
            status="processing",
            created_by=user_id,
        )
        session.add(doc)
        await session.flush()

        # 2. Ingest document
        updated_doc = await ingest_document(session, doc.id)
        assert updated_doc.status == "ready"
        assert updated_doc.chunk_count == 3
        assert updated_doc.version == 2
        assert updated_doc.embedding_model is not None
        assert updated_doc.embedding_dim == 768

        # 3. Verify chunks in DB
        chunks_stmt = select(KnowledgeChunk).where(KnowledgeChunk.document_id == doc.id)
        chunks = (await session.execute(chunks_stmt)).scalars().all()
        assert len(chunks) == 3
        for chunk in chunks:
            assert chunk.embedding is not None
            assert len(chunk.embedding) == 768

        # 4. Search knowledge base
        hits = await search_knowledge_base(session, "How long does international delivery take?")
        assert len(hits) >= 1
        top_hit = hits[0]
        assert top_hit.title == "International Shipping Policy"
        assert top_hit.category == "shipping"
        assert any("international delivery" in h.content for h in hits)
        assert top_hit.score > 0.20


@pytest.mark.asyncio
async def test_document_reindex_on_edit(make_user):
    user_id = await make_user("CUSTOMER", "reindex_user@resolveai.app")
    async with async_session_factory() as session:
        doc = KnowledgeDocument(
            title="Cancellation Policy",
            category="cancellation",
            content_text="Orders can be cancelled within 1 hour of placement.",
            status="processing",
            created_by=user_id,
        )
        session.add(doc)
        await session.flush()

        await ingest_document(session, doc.id)
        assert doc.version == 2

        # Update content to 2 hours
        new_text = (
            "Orders can be cancelled within 2 hours of placement before warehouse processing begins.\n\n"
            "After 2 hours, orders cannot be cancelled and must be returned after delivery."
        )
        updated = await ingest_document(session, doc.id, content_text=new_text)
        assert updated.version == 3
        assert updated.chunk_count == 2

        # Search for new terms returns the updated content
        hits = await search_knowledge_base(session, "Can I cancel an order after 1 hour?")
        assert len(hits) >= 1
        assert "2 hours" in hits[0].content


@pytest.mark.asyncio
async def test_search_category_filter(make_user):
    async with async_session_factory() as session:
        doc1 = KnowledgeDocument(
            title="Laptop Warranty Policy",
            category="warranty",
            content_text="Laptops include a 2-year manufacturer repair warranty against hardware defects.",
            status="processing",
        )
        doc2 = KnowledgeDocument(
            title="Shipping Damage Policy",
            category="shipping",
            content_text="If your package is damaged during transit, notify customer support within 48 hours.",
            status="processing",
        )
        session.add_all([doc1, doc2])
        await session.flush()

        await ingest_document(session, doc1.id)
        await ingest_document(session, doc2.id)

        # Search specifically for warranty category
        warranty_hits = await search_knowledge_base(
            session, "damaged hardware defects", category="warranty"
        )
        assert len(warranty_hits) >= 1
        assert all(h.category == "warranty" for h in warranty_hits)


@pytest.mark.asyncio
async def test_mcp_search_knowledge_base_tool(make_user):
    user_id = await make_user("CUSTOMER", "mcp_kb_user@resolveai.app")
    async with async_session_factory() as session:
        stmt = select(Customer).where(Customer.user_id == user_id)
        customer = (await session.execute(stmt)).scalar_one()

        # Ingest a policy doc so search returns hits
        doc = KnowledgeDocument(
            title="Returns & Exchanges Policy",
            category="returns",
            content_text="Items may be returned within 30 days of delivery.",
            status="processing",
        )
        session.add(doc)
        await session.flush()
        await ingest_document(session, doc.id)
        await session.commit()

    async with MCPClient(customer_id=customer.id) as client:
        res = await client.call_tool(
            "search_knowledge_base",
            {"query": "return window", "top_k": 3},
        )
        assert res.get("ok") is True
        assert "hits" in res
        assert isinstance(res["hits"], list)
        assert len(res["hits"]) >= 1
