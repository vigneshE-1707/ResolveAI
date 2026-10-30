"""Knowledge document repository."""
from __future__ import annotations

import uuid

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.knowledge import KnowledgeDocument


class KnowledgeDocumentRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, doc_id: uuid.UUID) -> KnowledgeDocument | None:
        return await self.session.get(KnowledgeDocument, doc_id)

    async def list_all(
        self, *, category: str | None = None, status: str | None = None,
        offset: int = 0, limit: int = 20,
    ) -> tuple[list[KnowledgeDocument], int]:
        stmt = select(KnowledgeDocument)
        count_stmt = select(func.count()).select_from(KnowledgeDocument)
        if category:
            stmt = stmt.where(KnowledgeDocument.category == category)
            count_stmt = count_stmt.where(KnowledgeDocument.category == category)
        if status:
            stmt = stmt.where(KnowledgeDocument.status == status)
            count_stmt = count_stmt.where(KnowledgeDocument.status == status)
        total = (await self.session.execute(count_stmt)).scalar() or 0
        stmt = stmt.order_by(KnowledgeDocument.created_at.desc()).offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all()), total

    async def create(self, doc: KnowledgeDocument) -> KnowledgeDocument:
        self.session.add(doc)
        await self.session.flush()
        return doc

    async def delete(self, doc_id: uuid.UUID) -> bool:
        doc = await self.get_by_id(doc_id)
        if not doc:
            return False
        await self.session.delete(doc)
        await self.session.flush()
        return True
