"""Enriched list summaries and per-customer ticket detail."""
from __future__ import annotations


async def test_order_summary_carries_item_and_shipment_details(
    client, register, make_order
):
    body = await register("summary@example.com")
    await make_order(body["user"]["customer_id"], order_number="ORD-9101")
    auth = {"Authorization": f"Bearer {body['access_token']}"}

    response = await client.get("/api/v1/me/orders", headers=auth)

    assert response.status_code == 200, response.text
    summary = response.json()["data"][0]
    assert summary["order_number"] == "ORD-9101"
    # One line of quantity 1 in the fixture.
    assert summary["item_count"] == 1
    assert summary["line_count"] == 1
    assert summary["first_item_name"] == "Test Product"
    assert summary["customer_name"] == "Test Customer"
    assert summary["shipment"]["carrier"] == "UPS"
    assert summary["shipment"]["tracking_number"] == "TRACK-ORD-9101"
    assert summary["shipment"]["status"] == "delivered"


async def test_ticket_list_and_detail_expose_the_linked_order(
    client, register, make_order
):
    body = await register("ticketorder@example.com")
    await make_order(body["user"]["customer_id"], order_number="ORD-9102")
    auth = {"Authorization": f"Bearer {body['access_token']}"}

    created = await client.post(
        "/api/v1/me/tickets",
        headers={**auth, "Idempotency-Key": "ticket-with-order"},
        json={
            "subject": "Where is my order?",
            "category": "order_status",
            "order_number": "ORD-9102",
        },
    )
    assert created.status_code == 201, created.text
    ticket_number = created.json()["ticket_number"]
    assert created.json()["order_number"] == "ORD-9102"

    detail = await client.get(f"/api/v1/me/tickets/{ticket_number}", headers=auth)
    assert detail.status_code == 200, detail.text
    assert detail.json()["ticket_number"] == ticket_number
    assert detail.json()["order_number"] == "ORD-9102"

    listing = await client.get("/api/v1/me/tickets", headers=auth)
    assert listing.status_code == 200
    assert listing.json()["data"][0]["order_number"] == "ORD-9102"


async def test_ticket_detail_is_scoped_to_the_owner(client, register, make_order):
    owner = await register("owner@example.com")
    await make_order(owner["user"]["customer_id"], order_number="ORD-9103")
    created = await client.post(
        "/api/v1/me/tickets",
        headers={"Authorization": f"Bearer {owner['access_token']}"},
        json={"subject": "Private", "category": "other"},
    )
    ticket_number = created.json()["ticket_number"]

    intruder = await register("intruder@example.com")
    response = await client.get(
        f"/api/v1/me/tickets/{ticket_number}",
        headers={"Authorization": f"Bearer {intruder['access_token']}"},
    )

    assert response.status_code == 404
    assert response.json()["code"] == "not_found"
