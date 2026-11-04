"""Standalone MCP Server process for ResolveAI.

Exposes 8 business tools over Streamable HTTP transport (default port 8100).
Every incoming request is verified against the actor JWT; tool execution is
performed within the customer's authenticated scope.
"""
from __future__ import annotations

import logging
import sys
from typing import Any

from mcp.server.mcpserver import MCPServer
from starlette.applications import Starlette
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.config import settings
from app.core.errors import AuthenticationError, PermissionDeniedError
from app.mcp_server.actor import current_actor_var, verify_actor_token
from app.mcp_server.tools import BUSINESS_TOOLS

logger = logging.getLogger("resolveai.mcp.server")


class ActorAuthMiddleware(BaseHTTPMiddleware):
    """Enforce and bind actor JWT on MCP requests."""

    async def dispatch(self, request: Request, call_next: Any):
        # Allow health checks without token if requested
        if request.url.path in ("/healthz", "/readyz"):
            return await call_next(request)

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            # If no token provided, return 401
            return JSONResponse(
                status_code=401,
                content={"error": "authentication_required", "message": "Missing Bearer token"},
            )

        token = auth_header[7:].strip()
        try:
            actor = verify_actor_token(token)
            current_actor_var.set(actor)
        except AuthenticationError as exc:
            return JSONResponse(
                status_code=401,
                content={"error": "invalid_token", "message": str(exc)},
            )
        except PermissionDeniedError as exc:
            return JSONResponse(
                status_code=403,
                content={"error": "forbidden", "message": str(exc)},
            )

        return await call_next(request)


def create_mcp_server() -> MCPServer:
    """Create and configure the ResolveAI MCPServer instance."""
    server = MCPServer("ResolveAI-Business")
    for tool_fn in BUSINESS_TOOLS:
        server.tool()(tool_fn)
    return server


def create_mcp_app() -> Starlette:
    """Build the ASGI Starlette app wrapping the MCP server with auth middleware."""
    server = create_mcp_server()
    app = server.streamable_http_app()
    app.add_middleware(ActorAuthMiddleware)

    async def healthz(request: Request):
        return JSONResponse({"status": "ok", "service": "mcp-server"})

    app.add_route("/healthz", healthz)
    return app


app = create_mcp_app()


def run_server() -> None:
    """Run the MCP server via uvicorn."""
    import uvicorn

    logging.basicConfig(level=logging.INFO)
    logger.info("Starting ResolveAI MCP Server on port %s", settings.mcp_port)
    uvicorn.run(app, host="127.0.0.1", port=settings.mcp_port)


if __name__ == "__main__":
    run_server()
