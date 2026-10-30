"""Context variables for request-scoped trace and request IDs."""
from __future__ import annotations

from contextvars import ContextVar
from uuid import UUID

request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)
current_user_id_var: ContextVar[UUID | None] = ContextVar("current_user_id", default=None)
