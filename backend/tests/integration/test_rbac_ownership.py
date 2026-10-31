"""RBAC and per-customer ownership tests."""
from __future__ import annotations

from tests.integration.conftest import TEST_PASSWORD


async def test_customer_cannot_reach_admin_or_agent_endpoints(client, register):
    body = await register("customer@example.com")
    headers = {"Authorization": f"Bearer {body['access_token']}"}

    admin = await client.get("/api/v1/admin/stats", headers=headers)
    agent = await client.get("/api/v1/agent/stats", headers=headers)

    assert admin.status_code == 403
    assert admin.json()["code"] == "forbidden"
    assert agent.status_code == 403
    assert agent.json()["code"] == "forbidden"


async def test_admin_can_reach_admin_endpoints(client, make_user, login):
    await make_user("ADMIN", "admin@example.com", "Admin User")
    token = await login("admin@example.com")

    response = await client.get(
        "/api/v1/admin/stats", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200


async def test_support_agent_can_reach_agent_endpoints(client, make_user, login):
    await make_user("SUPPORT_AGENT", "agent@example.com", "Agent User")
    token = await login("agent@example.com")

    response = await client.get(
        "/api/v1/agent/stats", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    assert response.json()["my_active"] == 0


async def test_customer_cannot_read_another_customers_order(client, register, make_order):
    first = await register("owner@example.com")
    await make_order(first["user"]["customer_id"], order_number="ORD-9001")

    second = await register("intruder@example.com")
    response = await client.get(
        "/api/v1/me/orders/ORD-9001",
        headers={"Authorization": f"Bearer {second['access_token']}"},
    )

    assert response.status_code == 404
    assert response.json()["code"] == "not_found"


async def test_customer_can_read_own_order_detail(client, register, make_order):
    body = await register("owner@example.com")
    await make_order(body["user"]["customer_id"], order_number="ORD-9002")

    response = await client.get(
        "/api/v1/me/orders/ORD-9002",
        headers={"Authorization": f"Bearer {body['access_token']}"},
    )

    assert response.status_code == 200
    detail = response.json()
    assert detail["order_number"] == "ORD-9002"
    assert detail["return_eligible"] is True
    assert detail["items"][0]["sku"] == "SKU-ORD-9002"


async def test_admin_can_create_a_support_agent_user(client, make_user, login):
    await make_user("ADMIN", "admin@example.com", "Admin User")
    token = await login("admin@example.com")

    response = await client.post(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "email": "new.agent@example.com",
            "password": TEST_PASSWORD,
            "full_name": "New Agent",
            "role": "SUPPORT_AGENT",
        },
    )

    assert response.status_code == 201, response.text
    assert response.json()["role"] == "SUPPORT_AGENT"

    # The new agent can log in and resolve an agent_id (profile row created).
    new_token = await login("new.agent@example.com")
    me = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {new_token}"}
    )
    assert me.status_code == 200
    assert me.json()["agent_id"]
