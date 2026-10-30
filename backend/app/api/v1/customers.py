"""Customer-facing endpoints — /me/*, orders, tickets, conversations, returns."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import CurrentUser, PaginationParams, get_db, require_role
from app.schemas.common import PaginatedResponse, PaginationMeta
from app.schemas.order import OrderDetailOut, OrderSummaryOut
from app.schemas.ticket import TicketCreate, TicketOut
from app.schemas.conversation import ConversationCreate, ConversationOut, MessageOut
from app.schemas.user import AddressCreate, AddressOut, UserUpdate
from app.services.order_service import OrderService
from app.services.ticket_service import TicketService
from app.services.conversation_service import ConversationService

router = APIRouter(tags=["customer"])


# ── Profile ────────────────────────────────────────────────

@router.patch("/me", response_model=dict)
async def update_me(
    body: UserUpdate,
    user: CurrentUser = Depends(require_role("CUSTOMER", "SUPPORT_AGENT", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    from app.repositories.user_repo import UserRepository
    repo = UserRepository(db)
    updates = body.model_dump(exclude_unset=True)
    await repo.update_user(user.user_id, **updates)
    await db.commit()
    return {"message": "Profile updated"}


@router.get("/me/addresses", response_model=list[AddressOut])
async def list_addresses(
    user: CurrentUser = Depends(require_role("CUSTOMER")),
    db: AsyncSession = Depends(get_db),
):
    from app.repositories.user_repo import AddressRepository
    repo = AddressRepository(db)
    addresses = await repo.list_by_customer(user.customer_id)
    return [AddressOut(id=str(a.id), label=a.label, line1=a.line1, line2=a.line2, city=a.city, region=a.region, postal_code=a.postal_code, country=a.country, is_default=a.is_default) for a in addresses]


@router.post("/me/addresses", response_model=AddressOut, status_code=201)
async def create_address(
    body: AddressCreate,
    user: CurrentUser = Depends(require_role("CUSTOMER")),
    db: AsyncSession = Depends(get_db),
):
    from app.repositories.user_repo import AddressRepository
    from app.models.user import CustomerAddress
    repo = AddressRepository(db)
    addr = CustomerAddress(customer_id=user.customer_id, **body.model_dump())
    await repo.create(addr)
    await db.commit()
    return AddressOut(id=str(addr.id), label=addr.label, line1=addr.line1, line2=addr.line2, city=addr.city, region=addr.region, postal_code=addr.postal_code, country=addr.country, is_default=addr.is_default)


# ── Orders ─────────────────────────────────────────────────

@router.get("/me/orders")
async def list_my_orders(
    status: str | None = None, q: str | None = None,
    page: int = 1, page_size: int = 20,
    user: CurrentUser = Depends(require_role("CUSTOMER")),
    db: AsyncSession = Depends(get_db),
):
    svc = OrderService(db)
    orders, total = await svc.get_customer_orders(user.customer_id, status=status, q=q, page=page, page_size=page_size)
    return {"data": [_order_summary(o) for o in orders], "meta": {"page": page, "page_size": page_size, "total": total}}


@router.get("/me/orders/{order_number}", response_model=OrderDetailOut)
async def get_my_order(
    order_number: str,
    user: CurrentUser = Depends(require_role("CUSTOMER")),
    db: AsyncSession = Depends(get_db),
):
    svc = OrderService(db)
    order = await svc.get_order_by_number(order_number, customer_id=user.customer_id)
    return _order_detail(order)


# ── Tickets ────────────────────────────────────────────────

@router.get("/me/tickets")
async def list_my_tickets(
    status: str | None = None, page: int = 1, page_size: int = 20,
    user: CurrentUser = Depends(require_role("CUSTOMER")),
    db: AsyncSession = Depends(get_db),
):
    svc = TicketService(db)
    tickets, total = await svc.get_customer_tickets(user.customer_id, status=status, page=page, page_size=page_size)
    return {"data": [_ticket_out(t) for t in tickets], "meta": {"page": page, "page_size": page_size, "total": total}}


@router.post("/me/tickets", response_model=TicketOut, status_code=201)
async def create_ticket(
    body: TicketCreate,
    user: CurrentUser = Depends(require_role("CUSTOMER")),
    db: AsyncSession = Depends(get_db),
):
    svc = TicketService(db)
    ticket = await svc.create_ticket(user.customer_id, body.subject, body.category, body.description)
    return _ticket_out(ticket)


# ── Conversations ──────────────────────────────────────────

@router.get("/me/conversations")
async def list_my_conversations(
    page: int = 1, page_size: int = 20,
    user: CurrentUser = Depends(require_role("CUSTOMER")),
    db: AsyncSession = Depends(get_db),
):
    svc = ConversationService(db)
    convs, total = await svc.list_customer_conversations(user.customer_id, page=page, page_size=page_size)
    return {"data": [_conv_out(c) for c in convs], "meta": {"page": page, "page_size": page_size, "total": total}}


@router.post("/me/conversations", response_model=ConversationOut, status_code=201)
async def create_conversation(
    body: ConversationCreate,
    user: CurrentUser = Depends(require_role("CUSTOMER")),
    db: AsyncSession = Depends(get_db),
):
    svc = ConversationService(db)
    conv = await svc.create_conversation(user.customer_id, body.subject)
    return _conv_out(conv)


@router.get("/conversations/{conversation_id}/messages")
async def get_messages(
    conversation_id: uuid.UUID,
    page: int = 1, page_size: int = 50,
    user: CurrentUser = Depends(require_role("CUSTOMER")),
    db: AsyncSession = Depends(get_db),
):
    svc = ConversationService(db)
    await svc.get_conversation(conversation_id, customer_id=user.customer_id)
    messages, total = await svc.get_messages(conversation_id, page=page, page_size=page_size)
    return {"data": [_msg_out(m) for m in messages], "meta": {"page": page, "page_size": page_size, "total": total}}


# ── Returns ────────────────────────────────────────────────

@router.get("/returns/eligibility/{order_number}")
async def check_return_eligibility(
    order_number: str,
    user: CurrentUser = Depends(require_role("CUSTOMER")),
    db: AsyncSession = Depends(get_db),
):
    svc = OrderService(db)
    return await svc.check_return_eligibility(order_number, user.customer_id)


# ── Helpers ────────────────────────────────────────────────

def _order_summary(o) -> dict:
    return {"id": str(o.id), "order_number": o.order_number, "status": o.status, "placed_at": o.placed_at.isoformat(), "total_cents": o.total_cents, "currency": o.currency, "item_count": len(o.items) if o.items else 0}

def _order_detail(o) -> OrderDetailOut:
    from app.schemas.order import OrderItemOut, ShipmentOut
    items = [OrderItemOut(id=str(i.id), sku=i.product.sku if i.product else None, name_snapshot=i.name_snapshot, quantity=i.quantity, unit_price_cents=i.unit_price_cents) for i in (o.items or [])]
    shipment = None
    if o.shipment:
        s = o.shipment
        shipment = ShipmentOut(carrier=s.carrier, tracking_number=s.tracking_number, status=s.status, shipped_at=s.shipped_at, estimated_delivery_at=s.estimated_delivery_at, delivered_at=s.delivered_at, last_event_desc=s.last_event_desc, last_event_at=s.last_event_at)
    return OrderDetailOut(id=str(o.id), order_number=o.order_number, customer_id=str(o.customer_id), status=o.status, placed_at=o.placed_at, subtotal_cents=o.subtotal_cents, shipping_cents=o.shipping_cents, tax_cents=o.tax_cents, total_cents=o.total_cents, currency=o.currency, items=items, shipment=shipment, cancelled_at=o.cancelled_at, cancel_reason=o.cancel_reason)

def _ticket_out(t) -> TicketOut:
    return TicketOut(id=str(t.id), ticket_number=t.ticket_number, customer_id=str(t.customer_id), order_id=str(t.order_id) if t.order_id else None, subject=t.subject, category=t.category, description=t.description, status=t.status, priority=t.priority, assigned_agent_id=str(t.assigned_agent_id) if t.assigned_agent_id else None, escalation_reason=t.escalation_reason, created_at=t.created_at, updated_at=t.updated_at, first_response_at=t.first_response_at, resolved_at=t.resolved_at, resolution_note=t.resolution_note)

def _conv_out(c) -> ConversationOut:
    return ConversationOut(id=str(c.id), customer_id=str(c.customer_id), subject=c.subject, channel=c.channel, mode=c.mode, status=c.status, assigned_agent_id=str(c.assigned_agent_id) if c.assigned_agent_id else None, escalation_reason=c.escalation_reason, created_at=c.created_at, updated_at=c.updated_at, escalated_at=c.escalated_at, resolved_at=c.resolved_at, closed_at=c.closed_at)

def _msg_out(m) -> MessageOut:
    return MessageOut(id=str(m.id), conversation_id=str(m.conversation_id), role=m.role, content=m.content, content_type=m.content_type, card=m.card, sources=m.sources, seq=m.seq, created_at=m.created_at)
