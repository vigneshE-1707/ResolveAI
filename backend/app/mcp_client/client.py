"""Client for interacting with the ResolveAI MCP boundary.

Provides a typed client that enforces short-lived actor JWTs.
Supports:
1. Streamable HTTP client over network / live MCP Server (mcp==2.3.x).
2. Direct actor-verified in-process execution for local turns and testing.
"""
from __future__ import annotations

import json
import logging
import uuid
from contextlib import AsyncExitStack
from typing import Any

from app.core.config import settings
from app.core.errors import (
    AuthenticationError,
    MCPUnavailableError,
    PermissionDeniedError,
)
from app.mcp_server.actor import current_actor_var, mint_actor_token, verify_actor_token
from app.mcp_server.tools import BUSINESS_TOOLS

logger = logging.getLogger("resolveai.mcp.client")

_TOOLS_BY_NAME = {fn.__name__: fn for fn in BUSINESS_TOOLS}


class MCPClient:
    """MCP Client managing actor JWTs and tool execution."""

    def __init__(
        self,
        *,
        actor_token: str | None = None,
        customer_id: uuid.UUID | None = None,
        role: str = "CUSTOMER",
        conversation_id: uuid.UUID | None = None,
        turn_id: str | None = None,
        server_url: str | None = None,
        app: Any | None = None,
        direct: bool = False,
    ):
        if actor_token is not None:
            self.actor_token = actor_token
        elif customer_id is not None:
            self.actor_token = mint_actor_token(
                customer_id=customer_id,
                role=role,
                conversation_id=conversation_id,
                turn_id=turn_id,
            )
        else:
            raise ValueError("Either actor_token or customer_id must be provided")

        self.server_url = server_url or settings.mcp_server_url
        self.app = app
        self.direct = direct
        self._exit_stack = AsyncExitStack()
        self._client: Any = None

    async def __aenter__(self) -> MCPClient:
        if self.direct:
            return self

        # If an ASGI app is explicitly provided, connect via Streamable HTTP
        if self.app is not None:
            import httpx2
            from mcp import Client
            from mcp.client.streamable_http import streamable_http_client

            headers = {"Authorization": f"Bearer {self.actor_token}"}
            route_endpoint = getattr(self.app.routes[0], "endpoint", None)
            sm = getattr(route_endpoint, "session_manager", None)
            if sm is None or (not getattr(sm, "_has_started", False) and getattr(sm, "_task_group", None) is None):
                await self._exit_stack.enter_async_context(
                    self.app.router.lifespan_context(self.app)
                )

            http_client = await self._exit_stack.enter_async_context(
                httpx2.AsyncClient(
                    transport=httpx2.ASGITransport(app=self.app),
                    base_url="http://127.0.0.1:8100",
                    headers=headers,
                    timeout=settings.mcp_call_timeout_seconds,
                )
            )
            transport = streamable_http_client(self.server_url, http_client=http_client)
            self._client = await self._exit_stack.enter_async_context(Client(transport))
            return self

        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        await self._exit_stack.aclose()

    async def list_tools(self) -> list[str]:
        """Return names of available business tools."""
        if self._client is not None:
            res = await self._client.list_tools()
            return [tool.name for tool in res.tools]
        return list(_TOOLS_BY_NAME.keys())

    async def call_tool(self, name: str, arguments: dict[str, Any] | None = None) -> dict[str, Any]:
        """Invoke a tool and return the parsed structured result."""
        args = arguments or {}

        # 1. MCP Streamable HTTP path
        if self._client is not None:
            try:
                res = await self._client.call_tool(name, args)
            except Exception as exc:
                logger.exception("Error executing MCP tool '%s'", name)
                raise MCPUnavailableError(f"MCP tool call failed: {exc}") from exc

            if not res.content:
                return {"ok": False, "error": "empty_response"}

            first_block = res.content[0]
            text_payload = getattr(first_block, "text", "")
            try:
                return json.loads(text_payload)
            except Exception:
                return {"ok": not res.is_error, "text": text_payload}

        # 2. In-process actor-verified execution path
        actor = verify_actor_token(self.actor_token)
        token_reset = current_actor_var.set(actor)
        try:
            tool_fn = _TOOLS_BY_NAME.get(name)
            if not tool_fn:
                return {"ok": False, "error": "unknown_tool", "message": f"Tool '{name}' not found."}
            return await tool_fn(**args)
        finally:
            current_actor_var.reset(token_reset)


__all__ = ["MCPClient"]
