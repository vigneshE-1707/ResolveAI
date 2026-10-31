"""Health, readiness, and error-envelope contract tests."""
from __future__ import annotations


async def test_liveness_returns_ok(client):
    response = await client.get("/api/v1/healthz")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["database"] is None


async def test_readiness_reports_database_connection(client):
    response = await client.get("/api/v1/readyz")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["database"] == "connected"


async def test_unknown_route_uses_error_envelope(client):
    response = await client.get("/api/v1/does-not-exist")

    assert response.status_code == 404
    body = response.json()
    assert body["code"] == "not_found"
    assert body["request_id"]
    assert response.headers["x-request-id"] == body["request_id"]


async def test_validation_error_envelope_does_not_echo_input(client):
    sentinel_password = "P@ss9sentinel"
    response = await client.post(
        "/api/v1/auth/register",
        json={"email": "not-an-email", "password": sentinel_password, "full_name": ""},
    )

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "validation_error"
    assert body["details"]["errors"]
    # The submitted password must never be echoed back.
    assert sentinel_password not in response.text
