"""Unit tests for password hashing and JWT handling."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import jwt
import pytest

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)


def test_password_hash_is_not_plaintext_and_verifies():
    raw = "CorrectHorse#2026"
    hashed = hash_password(raw)

    assert hashed != raw
    assert hashed.startswith("$argon2id$")
    assert verify_password(raw, hashed) is True
    assert verify_password("WrongHorse#2026", hashed) is False


def test_password_hashes_are_salted():
    assert hash_password("SamePassword#1") != hash_password("SamePassword#1")


def test_access_token_carries_identity_claims():
    user_id = uuid.uuid4()
    customer_id = uuid.uuid4()

    token = create_access_token(
        user_id, "CUSTOMER", customer_id=customer_id, session_version=3
    )
    payload = decode_token(token)

    assert payload["sub"] == str(user_id)
    assert payload["role"] == "CUSTOMER"
    assert payload["customer_id"] == str(customer_id)
    assert payload["session_version"] == 3
    assert payload["type"] == "access"


def test_refresh_token_is_distinct_from_access_token():
    user_id = uuid.uuid4()

    payload = decode_token(create_refresh_token(user_id, session_version=2))

    assert payload["sub"] == str(user_id)
    assert payload["session_version"] == 2
    assert payload["type"] == "refresh"
    assert "role" not in payload


def test_expired_token_is_rejected():
    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "type": "access",
            "iat": now - timedelta(minutes=10),
            "exp": now - timedelta(minutes=5),
        },
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )

    with pytest.raises(jwt.ExpiredSignatureError):
        decode_token(token)


def test_token_signed_with_another_secret_is_rejected():
    token = jwt.encode(
        {"sub": str(uuid.uuid4()), "type": "access"},
        "a-different-secret-key-that-is-long-enough",
        algorithm=settings.jwt_algorithm,
    )

    with pytest.raises(jwt.InvalidSignatureError):
        decode_token(token)
