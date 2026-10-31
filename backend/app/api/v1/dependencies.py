"""FastAPI dependencies — auth, RBAC, DB session, pagination."""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import current_user_id_var
from app.core.errors import AuthenticationError, PermissionDeniedError
from app.core.security import decode_token
from app.db.session import get_session
from app.models.user import Customer, SupportAgent, User

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
    db: AsyncSession = Depends(get_db),
) -> CurrentUser:
    """Resolve the caller from the access token *and* the current DB row.

    The token alone is never enough: a deactivated user or a bumped
    ``session_version`` (logout, password reset) must invalidate it.
    """
    if not credentials:
        raise AuthenticationError("Missing authorization header")

    import jwt as pyjwt
    try:
        payload = decode_token(credentials.credentials)
        user_id = uuid.UUID(payload["sub"])
    except (pyjwt.PyJWTError, KeyError, ValueError):
        raise AuthenticationError("Invalid or expired token")

    if payload.get("type") != "access":
        raise AuthenticationError("Invalid token type")

    user = await db.get(User, user_id)
    if not user or not user.is_active:
        raise AuthenticationError("Invalid or expired token")
    if payload.get("session_version", 1) != user.session_version:
        raise AuthenticationError("Session has been revoked")

    customer_id: uuid.UUID | None = None
    agent_id: uuid.UUID | None = None
    if user.role == "CUSTOMER":
        customer_id = (
            await db.execute(select(Customer.id).where(Customer.user_id == user.id))
        ).scalar_one_or_none()
    elif user.role == "SUPPORT_AGENT":
        agent_id = (
            await db.execute(select(SupportAgent.id).where(SupportAgent.user_id == user.id))
        ).scalar_one_or_none()

    current_user_id_var.set(user.id)
    return CurrentUser(
        user_id=user.id,
        role=user.role,
        customer_id=customer_id,
        agent_id=agent_id,
        session_version=user.session_version,
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
