"""Actor identity and token verification for the MCP boundary.

The LLM never supplies `customer_id`. The backend caller mints a short-lived
(60s), audience-scoped JWT asserting the verified user's identity, role,
conversation ID, and allowed scopes. The MCP server validates this token and
binds the Actor to a ContextVar for the duration of the tool execution.
"""
from __future__ import annotations

import uuid
from contextvars import ContextVar
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt

from app.core.config import settings
from app.core.errors import AuthenticationError, PermissionDeniedError

current_actor_var: ContextVar[Actor | None] = ContextVar("current_actor_var", default=None)


@dataclass(frozen=True)
class Actor:
    customer_id: uuid.UUID
    role: str
    conversation_id: uuid.UUID | None = None
    scopes: tuple[str, ...] = ("orders:read", "tickets:read", "tickets:write")
    turn_id: str | None = None


def mint_actor_token(
    *,
    customer_id: uuid.UUID,
    role: str = "CUSTOMER",
    conversation_id: uuid.UUID | None = None,
    scopes: tuple[str, ...] | list[str] = ("orders:read", "tickets:read", "tickets:write"),
    turn_id: str | None = None,
    ttl_seconds: int | None = None,
) -> str:
    """Issue a short-lived, audience-scoped actor JWT."""
    now = datetime.now(timezone.utc)
    ttl = ttl_seconds if ttl_seconds is not None else settings.actor_token_ttl_seconds
    claims: dict[str, Any] = {
        "sub": str(customer_id),
        "role": role,
        "act": "ai-agent",
        "aud": settings.mcp_audience,
        "iat": now,
        "exp": now + timedelta(seconds=ttl),
        "scopes": list(scopes),
    }
    if conversation_id:
        claims["cid"] = str(conversation_id)
    if turn_id:
        claims["jti"] = str(turn_id)

    return jwt.encode(claims, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def verify_actor_token(token: str) -> Actor:
    """Verify actor JWT signature, audience, and expiration."""
    try:
        claims = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
            audience=settings.mcp_audience,
        )
    except jwt.PyJWTError as exc:
        raise AuthenticationError(f"Invalid actor token: {exc}") from exc

    try:
        customer_id = uuid.UUID(claims["sub"])
    except (KeyError, ValueError) as exc:
        raise AuthenticationError("Actor token missing or invalid 'sub'") from exc

    cid = claims.get("cid")
    conversation_id = uuid.UUID(cid) if cid else None

    return Actor(
        customer_id=customer_id,
        role=claims.get("role", "CUSTOMER"),
        conversation_id=conversation_id,
        scopes=tuple(claims.get("scopes", [])),
        turn_id=claims.get("jti"),
    )


def get_current_actor() -> Actor:
    """Retrieve the actor bound to the current tool execution context."""
    actor = current_actor_var.get()
    if actor is None:
        raise PermissionDeniedError("No actor credentials found in execution context")
    return actor
