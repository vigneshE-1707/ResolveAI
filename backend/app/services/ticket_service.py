"""Ticket service."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.models.audit import IdempotencyKey
from app.models.ticket import SupportTicket
from app.repositories.analytics_repo import IdempotencyKeyRepository
from app.repositories.order_repo import OrderRepository
from app.repositories.ticket_repo import TicketRepository
from app.services.audit_service import AuditService


class TicketService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.ticket_repo = TicketRepository(session)
        self.order_repo = OrderRepository(session)
        self.idempotency_repo = IdempotencyKeyRepository(session)
        self.audit = AuditService(session)

    async def create_ticket(
        self,
        customer_id: uuid.UUID,
        subject: str,
        category: str,
        description: str | None = None,
        *,
        order_number: str | None = None,
        idempotency_key: str | None = None,
    ):
        if idempotency_key:
            existing = await self.ticket_repo.get_by_idempotency_key(idempotency_key)
            if existing:
                return existing

        order_id = None
        order = None
        if order_number:
            order = await self.order_repo.get_by_order_number(order_number, customer_id=customer_id)
            if not order:
                raise NotFoundError("Order", order_number)
            order_id = order.id

        ticket_number = await self.ticket_repo.generate_ticket_number()
        ticket = SupportTicket(
            ticket_number=ticket_number,
            customer_id=customer_id,
            order_id=order_id,
            subject=subject,
            category=category,
            description=description,
            idempotency_key=idempotency_key,
        )
        # Keep the relationship populated in-session so the create response can
        # include the order number without a second query.
        ticket.order = order
        await self.ticket_repo.create(ticket)

        if idempotency_key:
            await self.idempotency_repo.create(
                IdempotencyKey(
                    key=idempotency_key,
                    scope="tickets",
                    resource_type="support_ticket",
                    resource_id=ticket.id,
                )
            )

        await self.audit.record(
            actor_user_id=None,
            actor_role="CUSTOMER",
            action="ticket.created",
            entity_type="support_ticket",
            entity_id=ticket.id,
            meta={"ticket_number": ticket.ticket_number, "category": category},
        )
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

        allowed = {"status", "priority", "assigned_agent_id", "resolution_note"}
        unknown = set(kwargs) - allowed
        if unknown:
            from app.core.errors import ValidationError

            raise ValidationError(
                "Unsupported ticket field(s)",
                details={"fields": sorted(unknown)},
            )

        for key, value in kwargs.items():
            if key == "assigned_agent_id":
                # Explicit null unassigns; other values are UUIDs (validated by the router).
                ticket.assigned_agent_id = value
            elif value is not None:
                setattr(ticket, key, value)

        if kwargs.get("status") == "in_progress" and ticket.first_response_at is None:
            ticket.first_response_at = datetime.now(timezone.utc)
        if kwargs.get("status") == "resolved" and ticket.resolved_at is None:
            ticket.resolved_at = datetime.now(timezone.utc)

        await self.session.commit()
        return ticket
