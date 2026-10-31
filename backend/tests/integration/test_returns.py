"""Return requests, idempotency, and ticket numbering."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone


async def test_return_request_is_idempotent(client, register, make_order):
    body = await register("returner@example.com")
    await make_order(body["user"]["customer_id"], order_number="ORD-9001")
    headers = {
        "Authorization": f"Bearer {body['access_token']}",
        "Idempotency-Key": "return-key-1",
    }
    payload = {"order_number": "ORD-9001", "reason_code": "damaged"}

    first = await client.post("/api/v1/me/returns", headers=headers, json=payload)
    second = await client.post("/api/v1/me/returns", headers=headers, json=payload)

    assert first.status_code == 201, first.text
    assert second.status_code == 201, second.text
    assert first.json()["id"] == second.json()["id"]
    assert first.json()["status"] == "requested"

    listing = await client.get(
        "/api/v1/me/returns",
        headers={"Authorization": f"Bearer {body['access_token']}"},
    )
    assert listing.status_code == 200
    assert listing.json()["meta"]["total"] == 1


async def test_second_active_return_is_rejected(client, register, make_order):
    body = await register("returner@example.com")
    await make_order(body["user"]["customer_id"], order_number="ORD-9001")
    auth = {"Authorization": f"Bearer {body['access_token']}"}
    payload = {"order_number": "ORD-9001", "reason_code": "wrong_item"}

    first = await client.post("/api/v1/me/returns", headers=auth, json=payload)
    assert first.status_code == 201, first.text

    second = await client.post(
        "/api/v1/me/returns",
        headers={**auth, "Idempotency-Key": "a-different-key"},
        json=payload,
    )

    assert second.status_code == 422
    assert "already in progress" in second.json()["message"]


async def test_return_outside_window_is_rejected(client, register, make_order):
    body = await register("late@example.com")
    await make_order(
        body["user"]["customer_id"],
        order_number="ORD-9002",
        delivered_at=datetime.now(timezone.utc) - timedelta(days=40),
    )

    response = await client.post(
        "/api/v1/me/returns",
        headers={"Authorization": f"Bearer {body['access_token']}"},
        json={"order_number": "ORD-9002", "reason_code": "changed_mind"},
    )

    assert response.status_code == 422
    assert "30-day return window" in response.json()["message"]


async def test_eligibility_endpoint_reports_window(client, register, make_order):
    body = await register("eligible@example.com")
    await make_order(body["user"]["customer_id"], order_number="ORD-9003")

    response = await client.get(
        "/api/v1/returns/eligibility/ORD-9003",
        headers={"Authorization": f"Bearer {body['access_token']}"},
    )

    assert response.status_code == 200
    eligibility = response.json()
    assert eligibility["eligible"] is True
    assert eligibility["order_status"] == "delivered"
    assert eligibility["return_window_end"]


async def test_invalid_return_reason_is_rejected(client, register, make_order):
    body = await register("badreason@example.com")
    await make_order(body["user"]["customer_id"], order_number="ORD-9004")

    response = await client.post(
        "/api/v1/me/returns",
        headers={"Authorization": f"Bearer {body['access_token']}"},
        json={"order_number": "ORD-9004", "reason_code": "because"},
    )

    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"


async def test_ticket_creation_is_idempotent_and_uses_the_sequence(client, register):
    body = await register("ticketer@example.com")
    headers = {
        "Authorization": f"Bearer {body['access_token']}",
        "Idempotency-Key": "ticket-key-1",
    }
    payload = {
        "subject": "My parcel has not arrived",
        "category": "delivery_issue",
        "description": "Ordered ten days ago.",
    }

    first = await client.post("/api/v1/me/tickets", headers=headers, json=payload)
    second = await client.post("/api/v1/me/tickets", headers=headers, json=payload)

    assert first.status_code == 201, first.text
    assert second.status_code == 201, second.text
    assert first.json()["ticket_number"] == second.json()["ticket_number"]
    assert first.json()["ticket_number"].startswith("TKT-")

    listing = await client.get(
        "/api/v1/me/tickets",
        headers={"Authorization": f"Bearer {body['access_token']}"},
    )
    assert listing.json()["meta"]["total"] == 1
