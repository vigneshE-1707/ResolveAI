"""Deterministic demo seed data.

Every row is derived from a fixed key, so re-running the script is safe: it
only inserts what is missing. Use ``--reset`` to wipe the demo tables first.

Usage (from ``backend/``)::

    .venv/Scripts/python.exe scripts/seed_demo.py
    .venv/Scripts/python.exe scripts/seed_demo.py --reset

The demo password for every account is ``ResolveAI#2026``.
"""
from __future__ import annotations

import argparse
import asyncio
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

# Allow ``python scripts/seed_demo.py`` from the backend directory.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select, text  # noqa: E402

from app.core.security import hash_password  # noqa: E402
from app.db.session import async_session_factory, engine  # noqa: E402
from app.models.conversation import Conversation, Message  # noqa: E402
from app.models.knowledge import KnowledgeChunk, KnowledgeDocument  # noqa: E402
from app.models.order import Order, OrderItem, ReturnRequest, Shipment  # noqa: E402
from app.models.product import Product  # noqa: E402
from app.models.ticket import SupportTicket  # noqa: E402
from app.models.user import Customer, CustomerAddress, SupportAgent, User  # noqa: E402

DEMO_PASSWORD = "ResolveAI#2026"
_NAMESPACE = uuid.UUID("6f6f1e3a-4f4f-4f4f-8f4f-4f4f4f4f4f4f")


def uid(key: str) -> uuid.UUID:
    """Stable UUID for a seed key — the same key always yields the same id."""
    return uuid.uuid5(_NAMESPACE, key)


def ts(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)


# ── People ─────────────────────────────────────────────────────────────────

CUSTOMERS = [
    # key, full name, email, phone, loyalty tier, address
    (
        "john",
        "John Doe",
        "john.doe@email.com",
        "+1 (503) 555-0144",
        "premium",
        ("Home", "1420 NW Everett St", "Portland", "OR", "97209", "USA"),
    ),
    (
        "priya",
        "Priya Raman",
        "priya.raman@email.com",
        "+1 (415) 555-0182",
        "vip",
        ("Home", "88 Dolores St", "San Francisco", "CA", "94103", "USA"),
    ),
    (
        "marcus",
        "Marcus Bell",
        "marcus.bell@email.com",
        "+44 7700 900312",
        "standard",
        ("Home", "12 Oxford Road", "Manchester", None, "M1 5QA", "GBR"),
    ),
    (
        "sofia",
        "Sofia Almeida",
        "sofia.almeida@email.com",
        "+351 912 555 019",
        "premium",
        ("Home", "Rua Augusta 210", "Lisbon", None, "1100-053", "PRT"),
    ),
    (
        "daniel",
        "Daniel Okafor",
        "daniel.okafor@email.com",
        "+1 (312) 555-0177",
        "standard",
        ("Home", "401 N Wabash Ave", "Chicago", "IL", "60611", "USA"),
    ),
]

AGENTS = [
    ("maya", "Maya Fernandez", "maya.fernandez@resolveai.app", "Returns & Refunds"),
    ("kenji", "Kenji Watanabe", "kenji.watanabe@resolveai.app", "Delivery Operations"),
    ("lena", "Lena Fischer", "lena.fischer@resolveai.app", "General Support"),
    ("omar", "Omar Haddad", "omar.haddad@resolveai.app", "General Support"),
]

ADMIN = ("alex", "Alex Morgan", "alex.morgan@resolveai.app")


# ── Catalogue ──────────────────────────────────────────────────────────────

PRODUCTS = [
    # sku, name, category, price_cents
    ("PHN-NBX2-128", "Nimbus Phone X2 — 128GB", "Electronics", 64900),
    ("PHN-NBX2-256", "Nimbus Phone X2 — 256GB", "Electronics", 74900),
    ("AUD-APOD-PRO", "AeroPods Pro", "Audio", 19900),
    ("SHO-TRN-42", "Terra Trail Runner", "Footwear", 12900),
    ("SHO-SCK-3P", "Performance Socks (3-pack)", "Accessories", 1800),
    ("BAG-ATL-24", "Atlas Commuter Backpack", "Bags", 8900),
    ("LMP-LUM-01", "Lumen Desk Lamp", "Home", 7900),
    ("LMP-LUM-MINI", "Lumen Desk Lamp Mini", "Home", 4900),
]


# ── Orders ─────────────────────────────────────────────────────────────────

ORDERS = [
    {
        "key": "ord-1024",
        "number": "ORD-1024",
        "customer": "john",
        "status": "shipped",
        "placed_at": "2026-10-24T09:12:00Z",
        "items": [("PHN-NBX2-128", 1, 64900)],
        "subtotal_cents": 64900,
        "shipping_cents": 0,
        "tax_cents": 5192,
        "total_cents": 70092,
        "shipment": {
            "carrier": "UPS",
            "tracking_number": "1Z999AA10123456784",
            "status": "in_transit",
            "shipped_at": "2026-10-26T14:05:00Z",
            "estimated_delivery_at": "2026-11-01T20:00:00Z",
            "delivered_at": None,
            "last_event_desc": "In transit — departed regional facility",
            "last_event_at": "2026-10-28T08:11:00Z",
        },
    },
    {
        "key": "ord-1023",
        "number": "ORD-1023",
        "customer": "john",
        "status": "delivered",
        "placed_at": "2026-10-09T16:40:00Z",
        "items": [("AUD-APOD-PRO", 1, 19900)],
        "subtotal_cents": 19900,
        "shipping_cents": 499,
        "tax_cents": 1592,
        "total_cents": 21991,
        "shipment": {
            "carrier": "FedEx",
            "tracking_number": "7749 1023 8841",
            "status": "delivered",
            "shipped_at": "2026-10-10T10:00:00Z",
            "estimated_delivery_at": "2026-10-12T20:00:00Z",
            "delivered_at": "2026-10-12T15:22:00Z",
            "last_event_desc": "Delivered — front door",
            "last_event_at": "2026-10-12T15:22:00Z",
        },
    },
    {
        "key": "ord-1021",
        "number": "ORD-1021",
        "customer": "john",
        "status": "delivered",
        "placed_at": "2026-09-24T08:05:00Z",
        "items": [("SHO-TRN-42", 1, 12900), ("SHO-SCK-3P", 2, 1800)],
        "subtotal_cents": 16500,
        "shipping_cents": 0,
        "tax_cents": 1320,
        "total_cents": 17820,
        "shipment": {
            "carrier": "USPS",
            "tracking_number": "9400 1000 0000 0000 0001",
            "status": "delivered",
            "shipped_at": "2026-09-26T11:30:00Z",
            "estimated_delivery_at": "2026-09-28T20:00:00Z",
            "delivered_at": "2026-09-28T12:03:00Z",
            "last_event_desc": "Delivered — mailbox",
            "last_event_at": "2026-09-28T12:03:00Z",
        },
    },
    {
        "key": "ord-1015",
        "number": "ORD-1015",
        "customer": "john",
        "status": "cancelled",
        "placed_at": "2026-09-02T19:44:00Z",
        "items": [("BAG-ATL-24", 1, 8900)],
        "subtotal_cents": 8900,
        "shipping_cents": 0,
        "tax_cents": 712,
        "total_cents": 9612,
        "shipment": None,
        "cancelled_at": "2026-09-03T08:12:00Z",
        "cancel_reason": "Customer requested cancellation before dispatch",
    },
    {
        "key": "ord-1031",
        "number": "ORD-1031",
        "customer": "priya",
        "status": "delivered",
        "placed_at": "2026-10-08T13:20:00Z",
        "items": [("LMP-LUM-01", 2, 7900)],
        "subtotal_cents": 15800,
        "shipping_cents": 0,
        "tax_cents": 1264,
        "total_cents": 17064,
        "shipment": {
            "carrier": "FedEx",
            "tracking_number": "7749 1031 5520",
            "status": "delivered",
            "shipped_at": "2026-10-09T09:30:00Z",
            "estimated_delivery_at": "2026-10-12T20:00:00Z",
            "delivered_at": "2026-10-12T11:10:00Z",
            "last_event_desc": "Delivered — reception",
            "last_event_at": "2026-10-12T11:10:00Z",
        },
    },
    {
        "key": "ord-1019",
        "number": "ORD-1019",
        "customer": "sofia",
        "status": "shipped",
        "placed_at": "2026-10-16T07:55:00Z",
        "items": [("PHN-NBX2-256", 1, 74900)],
        "subtotal_cents": 74900,
        "shipping_cents": 0,
        "tax_cents": 5992,
        "total_cents": 80892,
        "shipment": {
            "carrier": "DHL",
            "tracking_number": "JD0146000062812345",
            "status": "exception",
            "shipped_at": "2026-10-17T09:00:00Z",
            "estimated_delivery_at": "2026-10-24T20:00:00Z",
            "delivered_at": None,
            "last_event_desc": "Customs clearance hold — documentation required",
            "last_event_at": "2026-10-23T17:40:00Z",
        },
    },
    {
        "key": "ord-0998",
        "number": "ORD-0998",
        "customer": "priya",
        "status": "delivered",
        "placed_at": "2026-10-02T10:15:00Z",
        "items": [("LMP-LUM-MINI", 1, 4900)],
        "subtotal_cents": 4900,
        "shipping_cents": 0,
        "tax_cents": 392,
        "total_cents": 5292,
        "shipment": {
            "carrier": "UPS",
            "tracking_number": "1Z999AA10198765432",
            "status": "delivered",
            "shipped_at": "2026-10-03T08:00:00Z",
            "estimated_delivery_at": "2026-10-06T20:00:00Z",
            "delivered_at": "2026-10-06T14:35:00Z",
            "last_event_desc": "Delivered — front door",
            "last_event_at": "2026-10-06T14:35:00Z",
        },
    },
]


# ── Tickets ────────────────────────────────────────────────────────────────

TICKETS = [
    {
        "number": "TKT-5687",
        "customer": "john",
        "order": "ORD-1024",
        "subject": "Delivery taking longer than expected",
        "category": "delivery_issue",
        "description": "Customer reported the phone has not arrived after one week. Shipment is in transit with an ETA of Nov 1.",
        "status": "open",
        "priority": "normal",
        "assigned": None,
        "created_at": "2026-10-30T10:19:00Z",
    },
    {
        "number": "TKT-5672",
        "customer": "sofia",
        "order": "ORD-1019",
        "subject": "Customs hold — refund or reshipment",
        "category": "delivery_issue",
        "description": "DHL shipment stuck in customs since Oct 23. Customer requested escalation after two failed AI attempts to resolve.",
        "status": "in_progress",
        "priority": "high",
        "assigned": "maya",
        "escalation_reason": "Repeated tool failures — carrier API timeout",
        "created_at": "2026-10-29T08:41:00Z",
        "first_response_at": "2026-10-30T09:12:00Z",
    },
    {
        "number": "TKT-5640",
        "customer": "priya",
        "order": "ORD-0998",
        "subject": "Wrong item received — replacement approved",
        "category": "wrong_item",
        "description": "Received Lumen Lamp instead of Lumen Lamp Mini. Replacement shipped after approval.",
        "status": "resolved",
        "priority": "normal",
        "assigned": "kenji",
        "created_at": "2026-10-26T14:02:00Z",
        "first_response_at": "2026-10-26T15:10:00Z",
        "resolved_at": "2026-10-28T11:35:00Z",
        "resolution_note": "Replacement Lumen Lamp Mini shipped; customer notified.",
    },
    {
        "number": "TKT-5690",
        "customer": "marcus",
        "order": None,
        "subject": "Question about warranty coverage",
        "category": "product_quality",
        "description": "Customer asked whether accidental damage is covered by the two-year warranty.",
        "status": "pending_customer",
        "priority": "low",
        "assigned": "maya",
        "created_at": "2026-10-30T07:20:00Z",
        "first_response_at": "2026-10-30T08:05:00Z",
    },
]


# ── Conversations ──────────────────────────────────────────────────────────

CONVERSATIONS = [
    {
        "key": "conv-01",
        "customer": "john",
        "subject": "Order delivery status — ORD-1024",
        "mode": "ai",
        "status": "open",
        "assigned": None,
        "created_at": "2026-10-30T10:23:00Z",
        "messages": [
            (
                "user",
                "I ordered a mobile phone last week, but I haven't received it. Can you check the delivery status?",
                "2026-10-30T10:23:00Z",
                None,
            ),
            (
                "assistant",
                "I've found order #ORD-1024. It's currently in transit and expected to arrive by Nov 1, 2026. "
                "Would you like me to create a support ticket if it doesn't arrive?",
                "2026-10-30T10:24:00Z",
                {
                    "kind": "order_status",
                    "order_number": "ORD-1024",
                    "status": "shipped",
                    "carrier": "UPS",
                    "tracking_number": "1Z999AA10123456784",
                    "estimated_delivery": "2026-11-01T20:00:00Z",
                },
            ),
        ],
    },
    {
        "key": "conv-02",
        "customer": "sofia",
        "subject": "Customs hold on ORD-1019",
        "mode": "human_pending",
        "status": "escalated",
        "assigned": "maya",
        "escalation_reason": "Carrier tracking unavailable after 2 retries; refund decision needed",
        "created_at": "2026-10-29T08:40:00Z",
        "escalated_at": "2026-10-29T08:41:00Z",
        "messages": [
            (
                "user",
                "My order ORD-1019 has been stuck in customs for a week. This is unacceptable.",
                "2026-10-29T08:40:00Z",
                None,
            ),
            (
                "assistant",
                "I can see the shipment is held at customs in Madrid and needs documentation. I've tried to "
                "retrieve the carrier case details twice without success, so I'm escalating this to a specialist.",
                "2026-10-29T08:41:00Z",
                {
                    "kind": "escalation",
                    "reason": "Carrier tracking unavailable after 2 retries",
                    "queue_position": 1,
                    "estimated_wait": "under 10 minutes",
                },
            ),
            (
                "agent",
                "Hi Sofia — Maya here. I've opened a case with DHL and requested the customs paperwork. "
                "I'll update you by end of day.",
                "2026-10-30T09:12:00Z",
                None,
            ),
        ],
    },
    {
        "key": "conv-03",
        "customer": "priya",
        "subject": "Return window for Lumen Lamp",
        "mode": "ai",
        "status": "resolved",
        "assigned": None,
        "created_at": "2026-10-29T16:46:00Z",
        "resolved_at": "2026-10-29T16:48:00Z",
        "messages": [
            (
                "user",
                "Can I return the Lumen Lamp I bought?",
                "2026-10-29T16:46:00Z",
                None,
            ),
            (
                "assistant",
                "Yes — ORD-1031 is within the 30-day return window (ends Nov 11, 2026). The lamp must be "
                "unused and in original packaging. I can start a return request once you confirm.",
                "2026-10-29T16:48:00Z",
                None,
            ),
        ],
    },
    {
        "key": "conv-04",
        "customer": "marcus",
        "subject": "Warranty — accidental damage",
        "mode": "human",
        "status": "escalated",
        "assigned": "maya",
        "escalation_reason": "Policy exception requires human judgement",
        "created_at": "2026-10-30T08:02:00Z",
        "escalated_at": "2026-10-30T08:02:00Z",
        "messages": [
            (
                "user",
                "I dropped my speaker and it cracked. Is that covered by warranty?",
                "2026-10-30T08:02:00Z",
                None,
            ),
            (
                "agent",
                "Hi Marcus, Maya from support. Accidental damage isn't covered by the standard warranty, "
                "but I'm checking whether a goodwill replacement applies to your account.",
                "2026-10-30T08:05:00Z",
                None,
            ),
        ],
    },
]


# ── Knowledge ──────────────────────────────────────────────────────────────

KNOWLEDGE = [
    (
        "returns",
        "Returns & Exchanges Policy",
        """Items may be returned within 30 days of delivery, not from the order date.

To be eligible, the item must be unused, in its original packaging, and include all accessories. 
Proof of purchase is required.

Returns are not available for cancelled orders, gift cards, or items marked final sale. 
Once a return request is approved, the customer receives a prepaid shipping label.

Refunds are issued to the original payment method within 5 business days of the returned item 
arriving at our warehouse.""",
    ),
    (
        "refunds",
        "Refund Processing Policy",
        """Refunds are processed only after the returned item has been received and inspected.

Standard refunds are issued to the original payment method within 5 business days. 
Shipping charges are refunded only when the return is due to our error.

Partial refunds may be issued when an item is returned without accessories or in used condition.

If a refund has not appeared after 10 business days, the customer should contact their bank before 
opening a support ticket.""",
    ),
    (
        "shipping",
        "Shipping & Delivery Times",
        """Standard shipping arrives in 3–5 business days. Express shipping arrives in 1–2 business days.

Orders placed before 2pm local time on a business day are dispatched the same day. 
Weekend orders are dispatched on the next business day.

International orders may be held at customs. Customers are responsible for any customs duties.

If tracking has not updated for 5 business days, support should open a carrier investigation.""",
    ),
    (
        "cancellation",
        "Order Cancellation Policy",
        """Orders may be cancelled without charge before they are marked as shipped.

Once an order has shipped, it cannot be cancelled; the customer must wait for delivery and then 
request a return.

Cancelled orders are refunded in full within 3 business days.

To cancel an order, the customer should provide the order number and confirm the cancellation.""",
    ),
    (
        "warranty",
        "Two-Year Limited Warranty",
        """Every device includes a two-year limited warranty covering manufacturing defects.

The warranty does not cover accidental damage, liquid damage, normal wear, or unauthorised repairs.

Warranty claims require the order number and a description of the fault. 
Approved claims are repaired or replaced at our discretion.

Extended warranty can be purchased within 30 days of delivery.""",
    ),
    (
        "faq",
        "Customer FAQ (October update)",
        """Frequently asked questions about orders, returns, refunds, and account access.

This document is queued for ingestion and will be searchable once processing completes.""",
    ),
]


# ── Helpers ────────────────────────────────────────────────────────────────


async def _reset(session) -> None:
    """Remove demo data in dependency order and restart ticket numbering."""
    await session.execute(
        text(
            """
            TRUNCATE TABLE
                audit_logs,
                ai_runs,
                idempotency_keys,
                messages,
                conversation_events,
                conversations,
                support_tickets,
                return_requests,
                shipments,
                order_items,
                orders,
                customer_addresses,
                knowledge_chunks,
                knowledge_documents,
                products,
                support_agents,
                customers,
                users
            RESTART IDENTITY CASCADE
            """
        )
    )
    await session.execute(
        text("ALTER SEQUENCE IF EXISTS support_ticket_number_seq RESTART WITH 1000")
    )
    await session.commit()


async def _ensure_user(session, *, key: str, email: str, full_name: str, role: str, password_hash: str) -> User:
    existing = (await session.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if existing:
        return existing
    user = User(
        id=uid(f"user:{key}"),
        email=email,
        password_hash=password_hash,
        full_name=full_name,
        role=role,
        is_active=True,
    )
    session.add(user)
    await session.flush()
    return user


async def _ensure_customer(session, user: User, *, phone: str | None, tier: str) -> Customer:
    existing = (
        await session.execute(select(Customer).where(Customer.user_id == user.id))
    ).scalar_one_or_none()
    if existing:
        return existing
    customer = Customer(
        id=uid(f"customer:{user.id}"),
        user_id=user.id,
        phone=phone,
        loyalty_tier=tier,
    )
    session.add(customer)
    await session.flush()
    return customer


async def _ensure_agent(session, user: User, *, team: str, display_name: str) -> SupportAgent:
    existing = (
        await session.execute(select(SupportAgent).where(SupportAgent.user_id == user.id))
    ).scalar_one_or_none()
    if existing:
        return existing
    agent = SupportAgent(
        id=uid(f"agent:{user.id}"),
        user_id=user.id,
        display_name=display_name,
        team=team,
        is_active=True,
    )
    session.add(agent)
    await session.flush()
    return agent


async def _ensure_address(session, customer: Customer, address: tuple) -> CustomerAddress:
    label, line1, city, region, postal_code, country = address
    existing = (
        await session.execute(
            select(CustomerAddress).where(
                CustomerAddress.customer_id == customer.id,
                CustomerAddress.line1 == line1,
            )
        )
    ).scalar_one_or_none()
    if existing:
        return existing
    row = CustomerAddress(
        id=uid(f"address:{customer.id}"),
        customer_id=customer.id,
        label=label,
        line1=line1,
        city=city,
        region=region,
        postal_code=postal_code,
        country=country,
        is_default=True,
    )
    session.add(row)
    await session.flush()
    return row


async def _ensure_product(session, sku: str, name: str, category: str, price_cents: int) -> Product:
    existing = (await session.execute(select(Product).where(Product.sku == sku))).scalar_one_or_none()
    if existing:
        return existing
    product = Product(
        id=uid(f"product:{sku}"),
        sku=sku,
        name=name,
        description=f"{name} — demo catalogue item.",
        category=category,
        price_cents=price_cents,
        currency="USD",
        is_active=True,
    )
    session.add(product)
    await session.flush()
    return product


async def _ensure_order(session, spec: dict, customers: dict, addresses: dict, products: dict) -> Order:
    existing = (
        await session.execute(select(Order).where(Order.order_number == spec["number"]))
    ).scalar_one_or_none()
    if existing:
        return existing

    customer = customers[spec["customer"]]
    order = Order(
        id=uid(f"order:{spec['key']}"),
        order_number=spec["number"],
        customer_id=customer.id,
        status=spec["status"],
        placed_at=ts(spec["placed_at"]),
        subtotal_cents=spec["subtotal_cents"],
        shipping_cents=spec["shipping_cents"],
        tax_cents=spec["tax_cents"],
        total_cents=spec["total_cents"],
        currency="USD",
        shipping_address_id=addresses[spec["customer"]].id,
        cancelled_at=ts(spec["cancelled_at"]) if spec.get("cancelled_at") else None,
        cancel_reason=spec.get("cancel_reason"),
    )
    for sku, quantity, unit_price_cents in spec["items"]:
        product = products[sku]
        order.items.append(
            OrderItem(
                id=uid(f"order-item:{spec['key']}:{sku}"),
                product_id=product.id,
                quantity=quantity,
                unit_price_cents=unit_price_cents,
                name_snapshot=product.name,
            )
        )
    if spec.get("shipment"):
        shipment = spec["shipment"]
        order.shipment = Shipment(
            id=uid(f"shipment:{spec['key']}"),
            carrier=shipment["carrier"],
            tracking_number=shipment["tracking_number"],
            status=shipment["status"],
            shipped_at=ts(shipment["shipped_at"]) if shipment.get("shipped_at") else None,
            estimated_delivery_at=(
                ts(shipment["estimated_delivery_at"]) if shipment.get("estimated_delivery_at") else None
            ),
            delivered_at=ts(shipment["delivered_at"]) if shipment.get("delivered_at") else None,
            last_event_desc=shipment.get("last_event_desc"),
            last_event_at=ts(shipment["last_event_at"]) if shipment.get("last_event_at") else None,
        )
    session.add(order)
    await session.flush()
    return order


async def _ensure_ticket(session, spec: dict, customers: dict, orders: dict, agents: dict) -> SupportTicket:
    existing = (
        await session.execute(
            select(SupportTicket).where(SupportTicket.ticket_number == spec["number"])
        )
    ).scalar_one_or_none()
    if existing:
        return existing

    order = orders.get(spec["order"]) if spec.get("order") else None
    agent = agents.get(spec["assigned"]) if spec.get("assigned") else None
    ticket = SupportTicket(
        id=uid(f"ticket:{spec['number']}"),
        ticket_number=spec["number"],
        customer_id=customers[spec["customer"]].id,
        order_id=order.id if order else None,
        subject=spec["subject"],
        category=spec["category"],
        description=spec["description"],
        status=spec["status"],
        priority=spec["priority"],
        assigned_agent_id=agent.id if agent else None,
        escalation_reason=spec.get("escalation_reason"),
        first_response_at=ts(spec["first_response_at"]) if spec.get("first_response_at") else None,
        resolved_at=ts(spec["resolved_at"]) if spec.get("resolved_at") else None,
        resolution_note=spec.get("resolution_note"),
        created_at=ts(spec["created_at"]),
        updated_at=ts(spec.get("updated_at") or spec["created_at"]),
    )
    session.add(ticket)
    await session.flush()
    return ticket


async def _ensure_conversation(session, spec: dict, customers: dict, agents: dict) -> Conversation:
    existing = (
        await session.execute(
            select(Conversation).where(
                Conversation.id == uid(f"conversation:{spec['key']}")
            )
        )
    ).scalar_one_or_none()
    if existing:
        return existing

    agent = agents.get(spec["assigned"]) if spec.get("assigned") else None
    conv = Conversation(
        id=uid(f"conversation:{spec['key']}"),
        customer_id=customers[spec["customer"]].id,
        channel="web",
        subject=spec["subject"],
        mode=spec["mode"],
        status=spec["status"],
        assigned_agent_id=agent.id if agent else None,
        escalation_reason=spec.get("escalation_reason"),
        escalated_at=ts(spec["escalated_at"]) if spec.get("escalated_at") else None,
        resolved_at=ts(spec["resolved_at"]) if spec.get("resolved_at") else None,
        created_at=ts(spec["created_at"]),
        updated_at=ts(spec["created_at"]),
    )
    for seq, (role, content, created_at, card) in enumerate(spec["messages"], start=1):
        conv.messages.append(
            Message(
                id=uid(f"message:{spec['key']}:{seq}"),
                role=role,
                content=content,
                content_type="card" if card else "text",
                card=card,
                seq=seq,
                created_at=ts(created_at),
            )
        )
    session.add(conv)
    await session.flush()
    return conv


async def _ensure_knowledge(session, category: str, title: str, content: str) -> KnowledgeDocument:
    existing = (
        await session.execute(
            select(KnowledgeDocument).where(KnowledgeDocument.title == title)
        )
    ).scalar_one_or_none()
    if existing:
        return existing

    doc = KnowledgeDocument(
        id=uid(f"knowledge:{category}"),
        title=title,
        category=category,
        source_type="seed",
        content_text=content,
        status="processing" if category == "faq" else "ready",
        version=1,
        embedding_model="gemini-embedding-001" if category != "faq" else None,
        embedding_dim=768 if category != "faq" else None,
        chunk_count=0,
    )
    session.add(doc)

    # Build the chunks while the document is still pending: after a flush the
    # relationship would lazy-load and emit IO outside the async context.
    if category != "faq":
        paragraphs = [part.strip() for part in content.split("\n\n") if part.strip()]
        for index, paragraph in enumerate(paragraphs):
            doc.chunks.append(
                KnowledgeChunk(
                    id=uid(f"knowledge-chunk:{category}:{index}"),
                    chunk_index=index,
                    content=paragraph,
                    token_count=len(paragraph.split()),
                    metadata_={"source": "seed", "category": category},
                )
            )
        doc.chunk_count = len(paragraphs)

    await session.flush()
    return doc


# ── Entry point ────────────────────────────────────────────────────────────


async def seed(reset: bool) -> None:
    password_hash = hash_password(DEMO_PASSWORD)
    created = 0

    async with async_session_factory() as session:
        if reset:
            await _reset(session)
            print("Reset: demo tables truncated.")

        customers: dict[str, Customer] = {}
        addresses: dict[str, CustomerAddress] = {}
        agents: dict[str, SupportAgent] = {}

        for key, full_name, email, phone, tier, address in CUSTOMERS:
            user = await _ensure_user(
                session,
                key=key,
                email=email,
                full_name=full_name,
                role="CUSTOMER",
                password_hash=password_hash,
            )
            customer = await _ensure_customer(session, user, phone=phone, tier=tier)
            customers[key] = customer
            addresses[key] = await _ensure_address(session, customer, address)

        for key, full_name, email, team in AGENTS:
            user = await _ensure_user(
                session,
                key=key,
                email=email,
                full_name=full_name,
                role="SUPPORT_AGENT",
                password_hash=password_hash,
            )
            agents[key] = await _ensure_agent(
                session, user, team=team, display_name=full_name
            )

        admin_key, admin_name, admin_email = ADMIN
        await _ensure_user(
            session,
            key=admin_key,
            email=admin_email,
            full_name=admin_name,
            role="ADMIN",
            password_hash=password_hash,
        )

        products = {}
        for sku, name, category, price_cents in PRODUCTS:
            products[sku] = await _ensure_product(session, sku, name, category, price_cents)

        orders: dict[str, Order] = {}
        for spec in ORDERS:
            orders[spec["number"]] = await _ensure_order(
                session, spec, customers, addresses, products
            )

        for spec in TICKETS:
            await _ensure_ticket(session, spec, customers, orders, agents)

        for spec in CONVERSATIONS:
            await _ensure_conversation(session, spec, customers, agents)

        for category, title, content in KNOWLEDGE:
            await _ensure_knowledge(session, category, title, content)

        await session.commit()

    async with async_session_factory() as session:
        for model, label in (
            (User, "users"),
            (Customer, "customers"),
            (SupportAgent, "support agents"),
            (Product, "products"),
            (Order, "orders"),
            (SupportTicket, "tickets"),
            (Conversation, "conversations"),
            (KnowledgeDocument, "knowledge documents"),
        ):
            count = len((await session.execute(select(model.id))).scalars().all())
            print(f"  {label:<22} {count}")
            created += count

    print(f"\nSeed complete. {created} rows present.")
    print(f"Demo password for every account: {DEMO_PASSWORD}")
    print("  customer: john.doe@email.com")
    print("  agent:    maya.fernandez@resolveai.app")
    print("  admin:    alex.morgan@resolveai.app")


async def _main(reset: bool) -> None:
    try:
        await seed(reset=reset)
    finally:
        await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed deterministic demo data.")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="truncate demo tables before seeding",
    )
    args = parser.parse_args()
    asyncio.run(_main(reset=args.reset))


if __name__ == "__main__":
    main()
