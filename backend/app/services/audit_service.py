"""Audit trail writer.

Callers own the transaction: ``record`` only stages the row so the audit entry
commits atomically with the mutation it describes.
"""
from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import request_id_var
from app.models.audit import AuditLog
from app.repositories.analytics_repo import AuditLogRepository


class AuditService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = AuditLogRepository(session)

    async def record(
        self,
        *,
        actor_user_id: uuid.UUID | None,
        actor_role: str,
        action: str,
        entity_type: str,
        entity_id: uuid.UUID | None = None,
        conversation_id: uuid.UUID | None = None,
        meta: dict | None = None,
    ) -> AuditLog:
        entry = AuditLog(
            actor_user_id=actor_user_id,
            actor_role=actor_role,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            conversation_id=conversation_id,
            request_id=request_id_var.get(),
            meta=meta,
        )
        return await self.repo.create(entry)
