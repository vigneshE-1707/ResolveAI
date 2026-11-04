"""The 8 formal business tools exposed by ResolveAI MCP Server.

Architectural invariants:
1. Tool schemas NEVER accept `customer_id`. Identity is extracted strictly
   from the verified actor JWT bound to `current_actor_var`.
2. Cross-customer data access attempts are rejected with permission/not-found errors.
3. State-changing operations require idempotency keys and return structured results.
"""
from __future__ import annotations

import logging
import uuid
from typing import Any

from pydantic import BaseModel, Field

from app.core.errors import (
    NotFoundError,
    PermissionDeniedError,
    ValidationError,
)
from app.db.session import async_session_factory
from app.mcp_server.actor import get_current_actor
from app.models.order import Order
from app.repositories.order_repo import OrderRepository, ReturnRequestRepository
from app.repositories.ticket_repo import TicketRepository
from app.services.conversation_service import ConversationService
from app.services.order_service import OrderService
from app.services.return_service import ReturnService, evaluate_return_eligibility
from app.services.ticket_service import TicketService
from app.knowledge.retriever import search_knowledge_base as search_kb

logger = logging.getLogger("resolveai.mcp.tools")


# ── Structured Models ──────────────────────────────────────


class OrderItemDetail(BaseModel):
    name: str
    quantity: int
    unit_price_cents: int


class ShipmentDetail(BaseModel):
    carrier: str
    tracking_number: str
    status: str
    shipped_at: str | None = None
    estimated_delivery: str | None = None
    delivered_at: str | None = None
    last_event: str | None = None
    last_event_at: str | None = None


class OrderSummary(BaseModel):
    order_number: str
    status: str
    placed_at: str | None = None
    total_cents: int
    currency: str
    first_item: str | None = None


class OrderInfo(BaseModel):
    order_number: str
    status: str
    placed_at: str | None = None
    total_cents: int
    currency: str
    items: list[OrderItemDetail] = []
    shipment: ShipmentDetail | None = None
    return_eligible: bool = False
    return_window_end: str | None = None
    cancel_reason: str | None = None


class TicketInfo(BaseModel):
    ticket_number: str
    subject: str
    category: str
    status: str
    priority: str
    description: str | None = None
    order_number: str | None = None
    created_at: str
    resolved_at: str | None = None


class TicketCreated(BaseModel):
    ok: bool = True
    ticket_number: str
    subject: str
    category: str
    status: str


class ReturnEligibility(BaseModel):
    eligible: bool
    reason: str
    order_number: str
    order_status: str
    return_window_end: str | None = None


class ReturnCreated(BaseModel):
    ok: bool = True
    return_id: str
    order_number: str
    status: str
    reason_code: str


class CancelledOrder(BaseModel):
    ok: bool = True
    order_number: str
    status: str
    cancel_reason: str


class HandoverResult(BaseModel):
    ok: bool = True
    conversation_id: str
    mode: str = "human_pending"
    message: str


# ── Tool Implementations ───────────────────────────────────


async def get_order_info(order_number: str) -> dict[str, Any]:
    """Look up full details of an order belonging to the signed-in customer.

    Args:
        order_number: Order identifier, e.g. 'ORD-1024'.
    """
    actor = get_current_actor()
    order_num = order_number.strip().upper()
    async with async_session_factory() as session:
        order_repo = OrderRepository(session)
        return_repo = ReturnRequestRepository(session)
        order = await order_repo.get_by_order_number(order_num, customer_id=actor.customer_id)
        if not order:
            return {"ok": False, "error": "not_found", "message": f"Order '{order_number}' not found."}

        active_return = await return_repo.get_active_for_order(order.id)
        eligibility = evaluate_return_eligibility(order, active_return=active_return)
        shipment = getattr(order, "shipment", None)

        return {
            "ok": True,
            "order": {
                "order_number": order.order_number,
                "status": order.status,
                "placed_at": order.placed_at.isoformat() if order.placed_at else None,
                "total_cents": order.total_cents,
                "total": {"amount_cents": order.total_cents, "currency": order.currency},
                "currency": order.currency,
                "items": [
                    {
                        "name": item.name_snapshot,
                        "quantity": item.quantity,
                        "unit_price_cents": item.unit_price_cents,
                    }
                    for item in order.items
                ],
                "shipment": (
                    {
                        "carrier": shipment.carrier,
                        "tracking_number": shipment.tracking_number,
                        "status": shipment.status,
                        "shipped_at": shipment.shipped_at.isoformat() if shipment.shipped_at else None,
                        "estimated_delivery": (
                            shipment.estimated_delivery_at.isoformat()
                            if shipment.estimated_delivery_at
                            else None
                        ),
                        "delivered_at": shipment.delivered_at.isoformat() if shipment.delivered_at else None,
                        "last_event": shipment.last_event_desc,
                        "last_event_at": shipment.last_event_at.isoformat() if shipment.last_event_at else None,
                    }
                    if shipment
                    else None
                ),
                "return_eligible": eligibility.get("eligible", False),
                "return": eligibility,
                "return_window_end": eligibility.get("return_window_end"),
                "cancel_reason": order.cancel_reason,
            },
        }


async def get_recent_orders(limit: int = 5) -> dict[str, Any]:
    """List the most recent orders placed by the signed-in customer.

    Args:
        limit: Number of orders to return (1 to 10).
    """
    actor = get_current_actor()
    capped_limit = min(max(1, limit), 10)
    async with async_session_factory() as session:
        order_repo = OrderRepository(session)
        orders, _total = await order_repo.list_by_customer(actor.customer_id, limit=capped_limit)
        return {
            "ok": True,
            "orders": [
                {
                    "order_number": o.order_number,
                    "status": o.status,
                    "placed_at": o.placed_at.isoformat() if o.placed_at else None,
                    "total_cents": o.total_cents,
                    "currency": o.currency,
                    "first_item": o.items[0].name_snapshot if o.items else None,
                }
                for o in orders
            ],
        }


async def get_ticket(ticket_number: str) -> dict[str, Any]:
    """Look up an existing support ticket belonging to the signed-in customer.

    Args:
        ticket_number: Ticket code, e.g. 'TKT-1001'.
    """
    actor = get_current_actor()
    tkt_num = ticket_number.strip().upper()
    async with async_session_factory() as session:
        ticket_repo = TicketRepository(session)
        ticket = await ticket_repo.get_by_ticket_number(tkt_num, customer_id=actor.customer_id)
        if not ticket:
            return {"ok": False, "error": "not_found", "message": f"Ticket '{ticket_number}' not found."}

        order_num = None
        if ticket.order_id:
            order_repo = OrderRepository(session)
            order = await order_repo.get_by_id(ticket.order_id)
            if order:
                order_num = order.order_number

        return {
            "ok": True,
            "ticket": {
                "ticket_number": ticket.ticket_number,
                "subject": ticket.subject,
                "category": ticket.category,
                "status": ticket.status,
                "priority": ticket.priority,
                "description": ticket.description,
                "order_number": order_num,
                "created_at": ticket.created_at.isoformat(),
                "resolved_at": ticket.resolved_at.isoformat() if ticket.resolved_at else None,
            },
        }


async def create_support_ticket(
    subject: str,
    category: str,
    description: str | None = None,
    order_number: str | None = None,
) -> dict[str, Any]:
    """Create a new support ticket on behalf of the signed-in customer.

    Args:
        subject: Brief description of the issue.
        category: One of 'order_status', 'delivery_issue', 'wrong_item', 'return_request',
                  'cancellation', 'refund', 'product_quality', 'billing', 'other'.
        description: Full details of the customer request.
        order_number: Optional related order number (must belong to customer).
    """
    actor = get_current_actor()
    async with async_session_factory() as session:
        ticket_svc = TicketService(session)
        order_num = order_number.strip().upper() if order_number else None
        try:
            ticket = await ticket_svc.create_ticket(
                customer_id=actor.customer_id,
                subject=subject.strip(),
                category=category.strip().lower(),
                description=description,
                order_number=order_num,
            )
            return {
                "ok": True,
                "ticket_number": ticket.ticket_number,
                "subject": ticket.subject,
                "category": ticket.category,
                "status": ticket.status,
            }
        except NotFoundError:
            return {"ok": False, "error": "order_not_found", "message": f"Order '{order_number}' not found."}
        except Exception as exc:
            logger.exception("Failed to create support ticket")
            return {"ok": False, "error": "creation_failed", "message": str(exc)}


async def check_return_eligibility(order_number: str) -> dict[str, Any]:
    """Evaluate whether an order is eligible for a return.

    Args:
        order_number: Order identifier, e.g. 'ORD-1024'.
    """
    actor = get_current_actor()
    order_num = order_number.strip().upper()
    async with async_session_factory() as session:
        return_svc = ReturnService(session)
        try:
            result = await return_svc.check_eligibility(order_num, actor.customer_id)
            return {"ok": True, **result}
        except NotFoundError:
            return {"ok": False, "error": "not_found", "message": f"Order '{order_number}' not found."}
        except Exception as exc:
            return {"ok": False, "error": "eligibility_failed", "message": str(exc)}


async def create_return_request(
    order_number: str,
    reason: str,
    idempotency_key: str,
) -> dict[str, Any]:
    """Submit a return request for an eligible order (idempotent).

    Args:
        order_number: Order identifier, e.g. 'ORD-1024'.
        reason: Valid return reason code (e.g. 'damaged', 'wrong_item', 'defective', 'not_as_described', 'changed_mind').
        idempotency_key: Unique client token to prevent duplicate requests.
    """
    actor = get_current_actor()
    order_num = order_number.strip().upper()
    async with async_session_factory() as session:
        return_svc = ReturnService(session)
        try:
            ret = await return_svc.create_return(
                customer_id=actor.customer_id,
                actor_user_id=actor.customer_id,
                order_number=order_num,
                reason_code=reason.strip().lower(),
                reason_text=reason,
                idempotency_key=idempotency_key.strip(),
            )
            return {
                "ok": True,
                "return_id": str(ret.id),
                "order_number": order_num,
                "status": ret.status,
                "reason_code": ret.reason_code,
            }
        except NotFoundError:
            return {"ok": False, "error": "not_found", "message": f"Order '{order_number}' not found."}
        except ValidationError as exc:
            return {"ok": False, "error": "validation_error", "message": exc.message}
        except Exception as exc:
            logger.exception("Failed to create return request")
            return {"ok": False, "error": "return_failed", "message": str(exc)}


async def cancel_order(
    order_number: str,
    reason: str,
    confirmation_id: str,
    idempotency_key: str,
) -> dict[str, Any]:
    """Cancel an unfulfilled order (idempotent).

    Args:
        order_number: Order identifier, e.g. 'ORD-1024'.
        reason: Reason for cancellation.
        confirmation_id: Explicit approval token from the customer.
        idempotency_key: Unique client key guarding against duplicates.
    """
    actor = get_current_actor()
    order_num = order_number.strip().upper()
    async with async_session_factory() as session:
        order_svc = OrderService(session)
        try:
            order = await order_svc.cancel_order(
                order_number=order_num,
                customer_id=actor.customer_id,
                reason=reason.strip(),
                idempotency_key=idempotency_key.strip(),
            )
            return {
                "ok": True,
                "order_number": order.order_number,
                "status": order.status,
                "cancel_reason": order.cancel_reason or reason,
            }
        except NotFoundError:
            return {"ok": False, "error": "not_found", "message": f"Order '{order_number}' not found."}
        except ValidationError as exc:
            return {"ok": False, "error": "validation_error", "message": exc.message}
        except Exception as exc:
            return {"ok": False, "error": "cancel_failed", "message": str(exc)}


async def request_human_handover(
    conversation_id: str,
    reason: str,
    priority: str = "normal",
) -> dict[str, Any]:
    """Escalate a customer conversation to a human support agent.

    Args:
        conversation_id: Conversation UUID to escalate.
        reason: Reason why autonomous AI resolution could not continue.
        priority: Priority tag ('low', 'normal', 'high').
    """
    actor = get_current_actor()
    try:
        conv_uuid = uuid.UUID(conversation_id.strip())
    except ValueError:
        return {"ok": False, "error": "invalid_id", "message": "Invalid conversation UUID."}

    async with async_session_factory() as session:
        conv_svc = ConversationService(session)
        try:
            conv = await conv_svc.get_conversation(conv_uuid, customer_id=actor.customer_id)
            await conv_svc.update_conversation(
                conv.id,
                mode="human_pending",
                escalation_reason=reason.strip(),
            )
            await conv_svc.add_event(
                conv.id,
                "escalated",
                actor_id=actor.customer_id,
                payload={"reason": reason, "priority": priority},
            )
            return {
                "ok": True,
                "conversation_id": str(conv.id),
                "mode": "human_pending",
                "message": "Conversation successfully escalated to human agent queue.",
            }
        except NotFoundError:
            return {"ok": False, "error": "not_found", "message": "Conversation not found."}
        except Exception as exc:
            return {"ok": False, "error": "handover_failed", "message": str(exc)}


async def search_knowledge_base(
    query: str,
    category: str | None = None,
    top_k: int = 4,
) -> dict[str, Any]:
    """Search the store's verified policy knowledge base.

    Args:
        query: Customer's question or search terms regarding store policies.
        category: Optional category filter ('returns', 'refunds', 'shipping', 'cancellation', 'warranty', 'faq').
        top_k: Maximum number of knowledge chunks to return.
    """
    _actor = get_current_actor()
    cat_str = category if isinstance(category, str) and category.strip() else None
    k_int = top_k if isinstance(top_k, int) and top_k > 0 else 4
    async with async_session_factory() as session:
        hits = await search_kb(session, query=str(query).strip(), category=cat_str, top_k=k_int)
        return {
            "ok": True,
            "query": query,
            "hits": [h.to_dict() for h in hits],
        }


BUSINESS_TOOLS = [
    get_order_info,
    get_recent_orders,
    get_ticket,
    create_support_ticket,
    check_return_eligibility,
    create_return_request,
    cancel_order,
    request_human_handover,
    search_knowledge_base,
]
