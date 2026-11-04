"""Unit tests for actor token minting, verification, and context binding."""
from __future__ import annotations

import time
import uuid

import jwt
import pytest

from app.core.config import settings
from app.core.errors import AuthenticationError, PermissionDeniedError
from app.mcp_server.actor import (
    Actor,
    current_actor_var,
    get_current_actor,
    mint_actor_token,
    verify_actor_token,
)


def test_mint_and_verify_actor_token():
    customer_id = uuid.uuid4()
    conv_id = uuid.uuid4()
    token = mint_actor_token(
        customer_id=customer_id,
        role="CUSTOMER",
        conversation_id=conv_id,
        turn_id="turn-123",
    )

    actor = verify_actor_token(token)
    assert actor.customer_id == customer_id
    assert actor.role == "CUSTOMER"
    assert actor.conversation_id == conv_id
    assert actor.turn_id == "turn-123"
    assert "orders:read" in actor.scopes


def test_verify_actor_token_rejects_expired():
    customer_id = uuid.uuid4()
    # Mint token with -1s TTL
    token = mint_actor_token(customer_id=customer_id, ttl_seconds=-1)

    with pytest.raises(AuthenticationError, match="expired"):
        verify_actor_token(token)


def test_verify_actor_token_rejects_wrong_audience():
    customer_id = uuid.uuid4()
    # Forge token with wrong audience
    claims = {
        "sub": str(customer_id),
        "aud": "wrong-audience",
        "exp": time.time() + 60,
    }
    forged = jwt.encode(claims, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)

    with pytest.raises(AuthenticationError):
        verify_actor_token(forged)


def test_verify_actor_token_rejects_invalid_secret():
    customer_id = uuid.uuid4()
    claims = {
        "sub": str(customer_id),
        "aud": settings.mcp_audience,
        "exp": time.time() + 60,
    }
    forged = jwt.encode(claims, "wrong-secret-key-32-chars-long-abc!", algorithm="HS256")

    with pytest.raises(AuthenticationError):
        verify_actor_token(forged)


def test_get_current_actor_from_context():
    actor = Actor(customer_id=uuid.uuid4(), role="CUSTOMER")
    token_reset = current_actor_var.set(actor)
    try:
        assert get_current_actor() == actor
    finally:
        current_actor_var.reset(token_reset)


def test_get_current_actor_raises_when_unset():
    token_reset = current_actor_var.set(None)
    try:
        with pytest.raises(PermissionDeniedError, match="No actor credentials"):
            get_current_actor()
    finally:
        current_actor_var.reset(token_reset)
