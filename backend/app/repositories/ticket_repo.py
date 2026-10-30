"""SupportTicket repository."""
from __future__ import annotations

import uuid

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ticket import SupportTicket


class TicketRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, ticket_id: uuid.UUID) -> SupportTicket | None:
        return await self.session.get(SupportTicket, ticket_id)

    async def get_by_ticket_number(self, ticket_number: str, *, customer_id: uuid.UUID | None = None) -> SupportTicket | None:
        stmt = select(SupportTicket).where(SupportTicket.ticket_number == ticket_number)
        if customer_id:
            stmt = stmt.where(SupportTicket.customer_id == customer_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_customer(self, customer_id: uuid.UUID, *, status: str | None = None, offset: int = 0, limit: int = 20) -> tuple[list[SupportTicket], int]:
        stmt = select(SupportTicket).where(SupportTicket.customer_id == customer_id)
        count_stmt = select(func.count()).select_from(SupportTicket).where(SupportTicket.customer_id == customer_id)
        if status:
            stmt = stmt.where(SupportTicket.status == status)
            count_stmt = count_stmt.where(SupportTicket.status == status)
        total = (await self.session.execute(count_stmt)).scalar() or 0
        stmt = stmt.order_by(SupportTicket.created_at.desc()).offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all()), total

    async def list_all(
        self, *, status: str | None = None, priority: str | None = None,
        assigned_agent_id: uuid.UUID | None = None, q: str | None = None,
        offset: int = 0, limit: int = 20,
    ) -> tuple[list[SupportTicket], int]:
        stmt = select(SupportTicket)
        count_stmt = select(func.count()).select_from(SupportTicket)
        if status:
            stmt = stmt.where(SupportTicket.status == status)
            count_stmt = count_stmt.where(SupportTicket.status == status)
        if priority:
            stmt = stmt.where(SupportTicket.priority == priority)
            count_stmt = count_stmt.where(SupportTicket.priority == priority)
        if assigned_agent_id:
            stmt = stmt.where(SupportTicket.assigned_agent_id == assigned_agent_id)
            count_stmt = count_stmt.where(SupportTicket.assigned_agent_id == assigned_agent_id)
        if q:
            pattern = f"%{q}%"
            stmt = stmt.where(SupportTicket.subject.ilike(pattern) | SupportTicket.ticket_number.ilike(pattern))
            count_stmt = count_stmt.where(SupportTicket.subject.ilike(pattern) | SupportTicket.ticket_number.ilike(pattern))
        total = (await self.session.execute(count_stmt)).scalar() or 0
        stmt = stmt.order_by(SupportTicket.created_at.desc()).offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all()), total

    async def create(self, ticket: SupportTicket) -> SupportTicket:
        self.session.add(ticket)
        await self.session.flush()
        return ticket

    async def update(self, ticket_id: uuid.UUID, **kwargs) -> SupportTicket | None:
        ticket = await self.get_by_id(ticket_id)
        if not ticket:
            return None
        for key, value in kwargs.items():
            if hasattr(ticket, key) and value is not None:
                setattr(ticket, key, value)
        await self.session.flush()
        return ticket

    async def generate_ticket_number(self) -> str:
        stmt = select(func.count()).select_from(SupportTicket)
        count = (await self.session.execute(stmt)).scalar() or 0
        return f"TKT-{count + 1:04d}"
