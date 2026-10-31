"""Fixtures for DB-backed API tests.

These tests need the Docker Postgres instance from ``docker-compose.yml``.
They create a separate ``resolveai_test`` database, run the real Alembic
migrations against it, and truncate every table between tests.
"""
from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import asyncpg
import pytest
from alembic import command
from alembic.config import Config
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.engine import make_url

from app.core.config import settings
from app.core.security import hash_password
from app.db.session import async_session_factory, engine
from app.main import application
from app.models.order import Order, OrderItem, Shipment
from app.models.product import Product
from app.models.user import Customer, SupportAgent, User

BACKEND_DIR = Path(__file__).resolve().parents[2]
TEST_PASSWORD = "TestPass#2026"

_TRUNCATE = """
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


async def _create_database() -> None:
    url = make_url(settings.database_url)
    connection = await asyncpg.connect(
        user=url.username,
        password=url.password,
        host=url.host,
        port=url.port or 5432,
        database="resolveai",
    )
    try:
        exists = await connection.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = $1", url.database
        )
        if not exists:
            await connection.execute(f'CREATE DATABASE "{url.database}"')
    finally:
        await connection.close()


@pytest.fixture(scope="session", autouse=True)
def _database() -> None:
    asyncio.run(_create_database())

    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    command.upgrade(config, "head")


@pytest.fixture(autouse=True)
async def _clean_database():
    async with async_session_factory() as session:
        await session.execute(text(_TRUNCATE))
        await session.execute(
            text("ALTER SEQUENCE IF EXISTS support_ticket_number_seq RESTART WITH 1000")
        )
        await session.commit()
    yield
    # Each test gets a fresh event loop; do not let asyncpg connections leak
    # from one loop into the next.
    await engine.dispose()


@pytest.fixture
async def client():
    transport = ASGITransport(app=application)
    async with AsyncClient(transport=transport, base_url="http://testserver") as http:
        yield http


@pytest.fixture
def register(client):
    async def _register(
        email: str = "customer@example.com",
        *,
        password: str = TEST_PASSWORD,
        full_name: str = "Test Customer",
    ) -> dict:
        response = await client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": password, "full_name": full_name},
        )
        assert response.status_code == 201, response.text
        return response.json()

    return _register


@pytest.fixture
def make_user():
    """Create a user of any role directly, bypassing the customer-only signup."""

    async def _make(role: str, email: str, full_name: str = "Test User") -> uuid.UUID:
        async with async_session_factory() as session:
            user = User(
                email=email,
                password_hash=hash_password(TEST_PASSWORD),
                full_name=full_name,
                role=role,
            )
            session.add(user)
            await session.flush()
            if role == "CUSTOMER":
                session.add(Customer(user_id=user.id))
            elif role == "SUPPORT_AGENT":
                session.add(SupportAgent(user_id=user.id, display_name=full_name))
            await session.commit()
            return user.id

    return _make


@pytest.fixture
def login(client):
    async def _login(email: str, password: str = TEST_PASSWORD) -> str:
        response = await client.post(
            "/api/v1/auth/login", json={"email": email, "password": password}
        )
        assert response.status_code == 200, response.text
        return response.json()["access_token"]

    return _login


@pytest.fixture
def make_order():
    async def _make(
        customer_id: uuid.UUID,
        *,
        order_number: str = "ORD-9001",
        status: str = "delivered",
        delivered_at: datetime | None = None,
    ) -> uuid.UUID:
        delivered_at = delivered_at or datetime.now(timezone.utc) - timedelta(days=5)
        async with async_session_factory() as session:
            order = Order(
                order_number=order_number,
                customer_id=customer_id,
                status=status,
                placed_at=delivered_at - timedelta(days=3),
                subtotal_cents=1000,
                shipping_cents=0,
                tax_cents=0,
                total_cents=1000,
                currency="USD",
            )
            session.add(order)
            await session.flush()
            product = Product(
                sku=f"SKU-{order_number}",
                name="Test Product",
                category="Test",
                price_cents=1000,
                currency="USD",
            )
            session.add(product)
            await session.flush()
            session.add(
                OrderItem(
                    order_id=order.id,
                    product_id=product.id,
                    quantity=1,
                    unit_price_cents=1000,
                    name_snapshot="Test Product",
                )
            )
            if status in {"shipped", "delivered"}:
                session.add(
                    Shipment(
                        order_id=order.id,
                        carrier="UPS",
                        tracking_number=f"TRACK-{order_number}",
                        status="delivered" if status == "delivered" else "in_transit",
                        shipped_at=delivered_at - timedelta(days=2),
                        delivered_at=delivered_at if status == "delivered" else None,
                    )
                )
            await session.commit()
            return order.id

    return _make
