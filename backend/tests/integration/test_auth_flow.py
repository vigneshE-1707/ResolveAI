"""End-to-end auth flow: register, me, login, refresh, logout, revocation."""
from __future__ import annotations

from tests.integration.conftest import TEST_PASSWORD


async def test_register_returns_token_and_customer_profile(client, register):
    body = await register("alice@example.com", full_name="Alice Example")

    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["user"]["email"] == "alice@example.com"
    assert body["user"]["role"] == "CUSTOMER"
    assert body["user"]["customer_id"]

    me = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {body['access_token']}"},
    )
    assert me.status_code == 200
    assert me.json()["full_name"] == "Alice Example"


async def test_duplicate_registration_is_rejected(client, register):
    await register("duplicate@example.com")

    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "duplicate@example.com",
            "password": TEST_PASSWORD,
            "full_name": "Duplicate",
        },
    )

    assert response.status_code == 409
    assert response.json()["code"] == "duplicate"


async def test_login_rejects_wrong_password(client, register):
    await register("bob@example.com")

    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "bob@example.com", "password": "WrongPassword#1"},
    )

    assert response.status_code == 401
    assert response.json()["code"] == "authentication_failed"


async def test_refresh_uses_http_only_cookie(client, register):
    await register("carol@example.com")

    response = await client.post("/api/v1/auth/refresh")

    assert response.status_code == 200
    refreshed = response.json()
    assert refreshed["access_token"]
    assert refreshed["user"]["email"] == "carol@example.com"

    me = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {refreshed['access_token']}"},
    )
    assert me.status_code == 200
    assert me.json()["email"] == "carol@example.com"


async def test_access_token_cannot_be_used_as_refresh_token(client, register):
    body = await register("dave@example.com")

    response = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": body["access_token"]}
    )

    assert response.status_code == 401
    assert response.json()["code"] == "authentication_failed"


async def test_logout_revokes_existing_access_token(client, register):
    body = await register("erin@example.com")
    headers = {"Authorization": f"Bearer {body['access_token']}"}

    logout = await client.post("/api/v1/auth/logout", headers=headers)
    assert logout.status_code == 204
    assert logout.content == b""

    me = await client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 401
    assert me.json()["message"] == "Session has been revoked"


async def test_missing_token_is_rejected(client):
    response = await client.get("/api/v1/auth/me")

    assert response.status_code == 401
    assert response.json()["code"] == "authentication_failed"
