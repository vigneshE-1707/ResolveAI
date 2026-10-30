"""FastAPI dependencies — auth, RBAC, DB session, pagination."""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from fastapi import Depends, Header, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import AuthenticationError, PermissionDeniedError
from app.core.security import decode_token
from app.db.session import get_session

_bearer = HTTPBearer(auto_error=False)


@dataclass
class CurrentUser:
    user_id: uuid.UUID
    role: str
    customer_id: uuid.UUID | None = None
    agent_id: uuid.UUID | None = None
    session_version: int = 1


async def get_db() -> AsyncSession:  # type: ignore[misc]
    async for session in get_session():
        yield session


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> CurrentUser:
    if not credentials:
        raise AuthenticationError("Missing authorization header")
    import jwt as pyjwt
    try:
        payload = decode_token(credentials.credentials)
    except pyjwt.PyJWTError:
        raise AuthenticationError("Invalid or expired token")

    if payload.get("type") != "access":
        raise AuthenticationError("Invalid token type")

    customer_id = uuid.UUID(payload["customer_id"]) if payload.get("customer_id") else None
    agent_id = uuid.UUID(payload["agent_id"]) if payload.get("agent_id") else None

    return CurrentUser(
        user_id=uuid.UUID(payload["sub"]),
        role=payload["role"],
        customer_id=customer_id,
        agent_id=agent_id,
        session_version=payload.get("session_version", 1),
    )


def require_role(*roles: str):
    """FastAPI dependency factory — enforces RBAC on every route."""
    async def _check(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in roles:
            raise PermissionDeniedError("You do not have permission to access this resource")
        return user
    return _check


class PaginationParams:
    def __init__(self, page: int = 1, page_size: int = 20):
        self.page = max(1, page)
        self.page_size = min(max(1, page_size), 100)
