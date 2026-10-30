"""Ticket service."""
from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.models.ticket import SupportTicket
from app.repositories.ticket_repo import TicketRepository


class TicketService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.ticket_repo = TicketRepository(session)

    async def create_ticket(self, customer_id: uuid.UUID, subject: str, category: str, description: str | None = None, order_id: uuid.UUID | None = None):
        ticket_number = await self.ticket_repo.generate_ticket_number()
        ticket = SupportTicket(ticket_number=ticket_number, customer_id=customer_id, order_id=order_id, subject=subject, category=category, description=description)
        await self.ticket_repo.create(ticket)
        await self.session.commit()
        return ticket

    async def get_customer_tickets(self, customer_id: uuid.UUID, *, status: str | None = None, page: int = 1, page_size: int = 20):
        offset = (page - 1) * page_size
        return await self.ticket_repo.list_by_customer(customer_id, status=status, offset=offset, limit=page_size)

    async def get_ticket_by_number(self, ticket_number: str, *, customer_id: uuid.UUID | None = None):
        ticket = await self.ticket_repo.get_by_ticket_number(ticket_number, customer_id=customer_id)
        if not ticket:
            raise NotFoundError("Ticket", ticket_number)
        return ticket

    async def list_all_tickets(self, *, status: str | None = None, priority: str | None = None, assigned_agent_id: uuid.UUID | None = None, q: str | None = None, page: int = 1, page_size: int = 20):
        offset = (page - 1) * page_size
        return await self.ticket_repo.list_all(status=status, priority=priority, assigned_agent_id=assigned_agent_id, q=q, offset=offset, limit=page_size)

    async def update_ticket(self, ticket_number: str, **kwargs):
        ticket = await self.ticket_repo.get_by_ticket_number(ticket_number)
        if not ticket:
            raise NotFoundError("Ticket", ticket_number)
        for key, value in kwargs.items():
            if hasattr(ticket, key) and value is not None:
                setattr(ticket, key, value)
        await self.session.commit()
        return ticket
