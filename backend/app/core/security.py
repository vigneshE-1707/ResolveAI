"""JWT token management and password hashing (argon2id)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from app.core.config import settings

_ph = PasswordHasher()


# ── Password hashing ───────────────────────────────────────

def hash_password(raw: str) -> str:
    return _ph.hash(raw)


def verify_password(raw: str, hashed: str) -> bool:
    try:
        return _ph.verify(hashed, raw)
    except VerifyMismatchError:
        return False


# ── JWT tokens ─────────────────────────────────────────────

def create_access_token(
    user_id: UUID,
    role: str,
    *,
    customer_id: UUID | None = None,
    agent_id: UUID | None = None,
    session_version: int = 1,
) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "role": role,
        "session_version": session_version,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_ttl_minutes),
        "type": "access",
    }
    if customer_id:
        payload["customer_id"] = str(customer_id)
    if agent_id:
        payload["agent_id"] = str(agent_id)
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(user_id: UUID, session_version: int = 1) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "session_version": session_version,
        "iat": now,
        "exp": now + timedelta(days=settings.refresh_token_ttl_days),
        "type": "refresh",
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT. Raises jwt.PyJWTError on failure."""
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
