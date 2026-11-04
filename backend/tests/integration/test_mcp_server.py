"""Integration tests for MCP Server, MCP Client, and Cross-Customer Security Boundary."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

import httpx2
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.tools import build_customer_tools
from app.db.session import async_session_factory
from app.mcp_client.client import MCPClient
from app.mcp_server.actor import mint_actor_token
from app.mcp_server.main import create_mcp_app
from app.models.conversation import Conversation
from app.models.order import Order, OrderItem, Shipment
from app.models.user import Customer, User
from app.services.auth_service import AuthService


async def _seed_customer(session: AsyncSession, email: str = "customer@example.com") -> Customer:
    """Helper to seed a test customer."""
    auth = AuthService(session)
    res = await auth.register(email, "Password#2026", "Test Customer")
    return await session.get(Customer, res["customer_id"])


async def _seed_order(
    session: AsyncSession,
    customer_id: uuid.UUID,
    order_number: str = "ORD-TEST-1",
    status: str = "delivered",
) -> Order:
    now = datetime.now(timezone.utc)
    order = Order(
        order_number=order_number,
        customer_id=customer_id,
        status=status,
        placed_at=now,
        subtotal_cents=10000,
        shipping_cents=500,
        tax_cents=800,
        total_cents=11300,
        currency="USD",
    )
    session.add(order)
    await session.flush()

    item = OrderItem(
        order_id=order.id,
        quantity=1,
        unit_price_cents=10000,
        name_snapshot="Test Gadget",
    )
    session.add(item)

    shipment = Shipment(
        order_id=order.id,
        carrier="UPS",
        tracking_number="1Z9999999999",
        status="delivered",
        shipped_at=now,
        delivered_at=now,
        last_event_desc="Delivered at front porch",
        last_event_at=now,
    )
    session.add(shipment)
    await session.commit()
    return order


@pytest.mark.asyncio
async def test_mcp_server_lists_all_eight_tools():
    app = create_mcp_app()
    dummy_id = uuid.uuid4()
    async with MCPClient(customer_id=dummy_id, app=app) as client:
        tools = await client.list_tools()
        expected = [
            "get_order_info",
            "get_recent_orders",
            "get_ticket",
            "create_support_ticket",
            "check_return_eligibility",
            "create_return_request",
            "cancel_order",
            "request_human_handover",
        ]
        for name in expected:
            assert name in tools, f"Missing tool: {name}"


@pytest.mark.asyncio
async def test_mcp_unauthenticated_request_is_rejected():
    app = create_mcp_app()
    async with app.router.lifespan_context(app):
        async with httpx2.AsyncClient(
            transport=httpx2.ASGITransport(app=app), base_url="http://127.0.0.1:8100"
        ) as client:
            resp = await client.post("/mcp", json={})
            assert resp.status_code == 401
            data = resp.json()
            assert data["error"] == "authentication_required"


@pytest.mark.asyncio
async def test_mcp_get_order_info_positive():
    app = create_mcp_app()
    async with async_session_factory() as session:
        cust = await _seed_customer(session, "cust1@test.com")
        order = await _seed_order(session, cust.id, "ORD-MCP-1")

    async with MCPClient(customer_id=cust.id, app=app) as client:
        res = await client.call_tool("get_order_info", {"order_number": "ORD-MCP-1"})
        assert res.get("ok") is True
        order_data = res["order"]
        assert order_data["order_number"] == "ORD-MCP-1"
        assert order_data["status"] == "delivered"
        assert len(order_data["items"]) == 1
        assert order_data["items"][0]["name"] == "Test Gadget"
        assert order_data["shipment"]["carrier"] == "UPS"


@pytest.mark.asyncio
async def test_mcp_cross_customer_data_access_is_rejected():
    """Security invariant: Customer B cannot look up or touch Customer A's order."""
    app = create_mcp_app()
    async with async_session_factory() as session:
        cust_a = await _seed_customer(session, "victim@test.com")
        cust_b = await _seed_customer(session, "attacker@test.com")
        await _seed_order(session, cust_a.id, "ORD-VICTIM-1")

    # Attacker tries to read victim's order
    async with MCPClient(customer_id=cust_b.id, app=app) as client:
        res = await client.call_tool("get_order_info", {"order_number": "ORD-VICTIM-1"})
        assert res.get("ok") is False
        assert res.get("error") == "not_found"


@pytest.mark.asyncio
async def test_mcp_ticket_lifecycle():
    app = create_mcp_app()
    async with async_session_factory() as session:
        cust = await _seed_customer(session, "ticket_user@test.com")
        order = await _seed_order(session, cust.id, "ORD-TKT-1")

    async with MCPClient(customer_id=cust.id, app=app) as client:
        # Create ticket
        create_res = await client.call_tool(
            "create_support_ticket",
            {
                "subject": "Missing package",
                "category": "delivery_issue",
                "description": "I did not receive my order",
                "order_number": "ORD-TKT-1",
            },
        )
        assert create_res.get("ok") is True
        tkt_num = create_res["ticket_number"]
        assert tkt_num.startswith("TKT-")

        # Read ticket back
        get_res = await client.call_tool("get_ticket", {"ticket_number": tkt_num})
        assert get_res.get("ok") is True
        assert get_res["ticket"]["ticket_number"] == tkt_num
        assert get_res["ticket"]["order_number"] == "ORD-TKT-1"


@pytest.mark.asyncio
async def test_mcp_return_request_and_idempotency():
    app = create_mcp_app()
    async with async_session_factory() as session:
        cust = await _seed_customer(session, "return_user@test.com")
        await _seed_order(session, cust.id, "ORD-RET-1", status="delivered")

    async with MCPClient(customer_id=cust.id, app=app) as client:
        # Check eligibility
        elig_res = await client.call_tool("check_return_eligibility", {"order_number": "ORD-RET-1"})
        assert elig_res.get("ok") is True
        assert elig_res.get("eligible") is True

        # Create return
        idem_key = str(uuid.uuid4())
        ret_res = await client.call_tool(
            "create_return_request",
            {
                "order_number": "ORD-RET-1",
                "reason": "wrong_item",
                "idempotency_key": idem_key,
            },
        )
        assert ret_res.get("ok") is True
        return_id = ret_res["return_id"]

        # Replay same idempotency key
        replay_res = await client.call_tool(
            "create_return_request",
            {
                "order_number": "ORD-RET-1",
                "reason": "wrong_item",
                "idempotency_key": idem_key,
            },
        )
        assert replay_res.get("ok") is True
        assert replay_res["return_id"] == return_id


@pytest.mark.asyncio
async def test_mcp_order_cancellation():
    app = create_mcp_app()
    async with async_session_factory() as session:
        cust = await _seed_customer(session, "cancel_user@test.com")
        await _seed_order(session, cust.id, "ORD-CNC-1", status="processing")

    async with MCPClient(customer_id=cust.id, app=app) as client:
        cancel_res = await client.call_tool(
            "cancel_order",
            {
                "order_number": "ORD-CNC-1",
                "reason": "Customer changed mind",
                "confirmation_id": "conf-123",
                "idempotency_key": str(uuid.uuid4()),
            },
        )
        assert cancel_res.get("ok") is True
        assert cancel_res["status"] == "cancelled"


@pytest.mark.asyncio
async def test_mcp_human_handover():
    app = create_mcp_app()
    async with async_session_factory() as session:
        cust = await _seed_customer(session, "handover_user@test.com")
        conv = Conversation(customer_id=cust.id, subject="Help request")
        session.add(conv)
        await session.commit()
        conv_id = str(conv.id)

    async with MCPClient(customer_id=cust.id, app=app) as client:
        res = await client.call_tool(
            "request_human_handover",
            {
                "conversation_id": conv_id,
                "reason": "User is very upset",
                "priority": "high",
            },
        )
        assert res.get("ok") is True
        assert res["mode"] == "human_pending"

    # Verify DB mode is updated
    async with async_session_factory() as session:
        updated = await session.get(Conversation, uuid.UUID(conv_id))
        assert updated.mode == "human_pending"
        assert updated.escalation_reason == "User is very upset"


@pytest.mark.asyncio
async def test_agent_tools_traverse_mcp():
    """Verify that the LangGraph tool wrappers route transparently through MCP."""
    app = create_mcp_app()
    async with async_session_factory() as session:
        cust = await _seed_customer(session, "agent_tool_user@test.com")
        await _seed_order(session, cust.id, "ORD-AGENT-1", status="delivered")

    async with app.router.lifespan_context(app):
        tools = build_customer_tools(session, cust.id, mcp_app=app)
        tools_by_name = {t.name: t for t in tools}

        # Execute get_order_status through LangGraph tool interface
        res = await tools_by_name["get_order_status"].ainvoke({"order_number": "ORD-AGENT-1"})
        assert res.get("ok") is True
        assert res["order"]["order_number"] == "ORD-AGENT-1"
        assert res["order"]["status"] == "delivered"

        # Execute list_my_orders through LangGraph tool interface
        list_res = await tools_by_name["list_my_orders"].ainvoke({"limit": 5})
        assert list_res.get("ok") is True
        assert len(list_res["orders"]) == 1
        assert list_res["orders"][0]["order_number"] == "ORD-AGENT-1"
