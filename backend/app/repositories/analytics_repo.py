"""Analytics, audit, and stats repositories."""
from __future__ import annotations

import uuid

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AiRun, AuditLog, IdempotencyKey
from app.models.conversation import Conversation
from app.models.ticket import SupportTicket


class AiRunRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, ai_run: AiRun) -> AiRun:
        self.session.add(ai_run)
        await self.session.flush()
        return ai_run

    async def list_all(
        self, *, status: str | None = None, trace_id: str | None = None,
        offset: int = 0, limit: int = 20,
    ) -> tuple[list[AiRun], int]:
        stmt = select(AiRun)
        count_stmt = select(func.count()).select_from(AiRun)
        if status:
            stmt = stmt.where(AiRun.status == status)
            count_stmt = count_stmt.where(AiRun.status == status)
        if trace_id:
            stmt = stmt.where(AiRun.trace_id == trace_id)
            count_stmt = count_stmt.where(AiRun.trace_id == trace_id)
        total = (await self.session.execute(count_stmt)).scalar() or 0
        stmt = stmt.order_by(AiRun.created_at.desc()).offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all()), total


class AuditLogRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, log: AuditLog) -> AuditLog:
        self.session.add(log)
        await self.session.flush()
        return log

    async def list_all(
        self, *, action: str | None = None, entity_type: str | None = None,
        actor_user_id: uuid.UUID | None = None, offset: int = 0, limit: int = 20,
    ) -> tuple[list[AuditLog], int]:
        stmt = select(AuditLog)
        count_stmt = select(func.count()).select_from(AuditLog)
        if action:
            stmt = stmt.where(AuditLog.action == action)
            count_stmt = count_stmt.where(AuditLog.action == action)
        if entity_type:
            stmt = stmt.where(AuditLog.entity_type == entity_type)
            count_stmt = count_stmt.where(AuditLog.entity_type == entity_type)
        if actor_user_id:
            stmt = stmt.where(AuditLog.actor_user_id == actor_user_id)
            count_stmt = count_stmt.where(AuditLog.actor_user_id == actor_user_id)
        total = (await self.session.execute(count_stmt)).scalar() or 0
        stmt = stmt.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all()), total


class IdempotencyKeyRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def exists(self, key: str) -> bool:
        stmt = select(func.count()).select_from(IdempotencyKey).where(IdempotencyKey.key == key)
        count = (await self.session.execute(stmt)).scalar() or 0
        return count > 0

    async def create(self, idem_key: IdempotencyKey) -> IdempotencyKey:
        self.session.add(idem_key)
        await self.session.flush()
        return idem_key


class StatsRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_overview_stats(self) -> dict:
        total_conv = (await self.session.execute(select(func.count()).select_from(Conversation))).scalar() or 0
        active_conv = (await self.session.execute(select(func.count()).select_from(Conversation).where(Conversation.status == "open"))).scalar() or 0
        escalated = (await self.session.execute(select(func.count()).select_from(Conversation).where(Conversation.status == "escalated"))).scalar() or 0
        open_tickets = (await self.session.execute(select(func.count()).select_from(SupportTicket).where(SupportTicket.status.in_(["open", "in_progress"])))).scalar() or 0
        return {"total_conversations": total_conv, "active_conversations": active_conv, "escalated": escalated, "open_tickets": open_tickets}

    async def get_agent_stats(self, agent_id: uuid.UUID) -> dict:
        open_conv = (await self.session.execute(select(func.count()).select_from(Conversation).where(Conversation.status == "open"))).scalar() or 0
        pending_conv = (await self.session.execute(select(func.count()).select_from(Conversation).where(Conversation.mode == "human_pending"))).scalar() or 0
        my_active = (await self.session.execute(select(func.count()).select_from(Conversation).where(Conversation.assigned_agent_id == agent_id, Conversation.status.in_(["open", "escalated"])))).scalar() or 0
        return {"open_conversations": open_conv, "pending_conversations": pending_conv, "my_active": my_active}
