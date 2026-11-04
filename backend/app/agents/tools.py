"""Account-scoped tools for the LangGraph agent backed by MCP (Milestone 5).

All tool execution traverses the Model Context Protocol (MCP) boundary:
1. The backend mints a short-lived actor JWT carrying the verified customer ID,
   role, and conversation context.
2. The MCP Client transmits the call (over Streamable HTTP or verified actor context)
   to the MCP Server.
3. The MCP Server validates the actor token and delegates to the services layer.
4. Tool schemas never expose `customer_id`, preventing prompt-injection spoofing.
"""
from __future__ import annotations

import logging
import uuid
from typing import Any

from langchain_core.tools import BaseTool, StructuredTool
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.mcp_client.client import MCPClient

logger = logging.getLogger("resolveai.agent.tools")


class GetOrderStatusArgs(BaseModel):
    order_number: str = Field(
        description="Order number exactly as the customer wrote it, e.g. ORD-1024."
    )


class ListOrdersArgs(BaseModel):
    limit: int = Field(default=5, ge=1, le=10, description="How many recent orders to return.")


class GetTicketArgs(BaseModel):
    ticket_number: str = Field(
        description="Support ticket code, e.g. TKT-1001."
    )


class CreateTicketArgs(BaseModel):
    subject: str = Field(description="Brief issue summary.")
    category: str = Field(
        description="Category: order_status, delivery_issue, wrong_item, return_request, cancellation, refund, product_quality, billing, other."
    )
    description: str | None = Field(default=None, description="Detailed customer message.")
    order_number: str | None = Field(default=None, description="Related order number if any.")


class CheckReturnEligibilityArgs(BaseModel):
    order_number: str = Field(description="Order number to evaluate, e.g. ORD-1024.")


class CreateReturnArgs(BaseModel):
    order_number: str = Field(description="Order number to return, e.g. ORD-1024.")
    reason: str = Field(
        description="Reason code: damaged, wrong_item, defective, not_as_described, changed_mind."
    )
    idempotency_key: str = Field(description="Unique client idempotency token.")


class CancelOrderArgs(BaseModel):
    order_number: str = Field(description="Order number to cancel, e.g. ORD-1024.")
    reason: str = Field(description="Reason for cancellation.")
    confirmation_id: str = Field(description="Confirmation approval token.")
    idempotency_key: str = Field(description="Unique client idempotency token.")


class RequestHumanHandoverArgs(BaseModel):
    conversation_id: str = Field(description="Conversation ID to escalate.")
    reason: str = Field(description="Reason why autonomous AI could not resolve.")
    priority: str = Field(default="normal", description="Priority: low, normal, high.")


class SearchKnowledgeBaseArgs(BaseModel):
    query: str = Field(
        description="Search terms or customer question regarding policies, returns, shipping, warranty, or cancellations."
    )
    category: str | None = Field(
        default=None,
        description="Optional category filter: returns, refunds, shipping, cancellation, warranty, faq.",
    )
    top_k: int = Field(default=4, ge=1, le=10, description="Maximum number of hits to return.")


def build_customer_tools(
    session: AsyncSession,
    customer_id: uuid.UUID,
    *,
    conversation_id: uuid.UUID | None = None,
    turn_id: str | None = None,
    mcp_app: Any | None = None,
) -> list[BaseTool]:
    """Build LangGraph tools that invoke the MCP Server."""

    async def get_order_status(order_number: str) -> dict[str, Any]:
        """Look up customer's order through MCP."""
        try:
            async with MCPClient(
                customer_id=customer_id,
                conversation_id=conversation_id,
                turn_id=turn_id,
                app=mcp_app,
            ) as client:
                return await client.call_tool("get_order_info", {"order_number": order_number})
        except Exception as exc:
            logger.warning(
                "MCP order lookup failed",
                extra={"event": "mcp_tool_failed", "error_type": type(exc).__name__},
            )
            return {"ok": False, "error": "lookup_failed"}

    async def list_my_orders(limit: int = 5) -> dict[str, Any]:
        """List customer's recent orders through MCP."""
        try:
            async with MCPClient(
                customer_id=customer_id,
                conversation_id=conversation_id,
                turn_id=turn_id,
                app=mcp_app,
            ) as client:
                return await client.call_tool("get_recent_orders", {"limit": limit})
        except Exception as exc:
            logger.warning(
                "MCP order list failed",
                extra={"event": "mcp_tool_failed", "error_type": type(exc).__name__},
            )
            return {"ok": False, "error": "lookup_failed"}

    async def get_ticket(ticket_number: str) -> dict[str, Any]:
        """Look up support ticket through MCP."""
        try:
            async with MCPClient(
                customer_id=customer_id,
                conversation_id=conversation_id,
                turn_id=turn_id,
                app=mcp_app,
            ) as client:
                return await client.call_tool("get_ticket", {"ticket_number": ticket_number})
        except Exception as exc:
            logger.warning("MCP ticket lookup failed: %s", exc)
            return {"ok": False, "error": "lookup_failed"}

    async def create_support_ticket(
        subject: str,
        category: str,
        description: str | None = None,
        order_number: str | None = None,
    ) -> dict[str, Any]:
        """Create ticket through MCP."""
        try:
            async with MCPClient(
                customer_id=customer_id,
                conversation_id=conversation_id,
                turn_id=turn_id,
                app=mcp_app,
            ) as client:
                return await client.call_tool(
                    "create_support_ticket",
                    {
                        "subject": subject,
                        "category": category,
                        "description": description,
                        "order_number": order_number,
                    },
                )
        except Exception as exc:
            logger.warning("MCP ticket creation failed: %s", exc)
            return {"ok": False, "error": "creation_failed"}

    async def check_return_eligibility(order_number: str) -> dict[str, Any]:
        """Check return eligibility through MCP."""
        try:
            async with MCPClient(
                customer_id=customer_id,
                conversation_id=conversation_id,
                turn_id=turn_id,
                app=mcp_app,
            ) as client:
                return await client.call_tool(
                    "check_return_eligibility",
                    {"order_number": order_number},
                )
        except Exception as exc:
            logger.warning("MCP return eligibility failed: %s", exc)
            return {"ok": False, "error": "eligibility_failed"}

    async def create_return_request(
        order_number: str,
        reason: str,
        idempotency_key: str,
    ) -> dict[str, Any]:
        """Create return request through MCP."""
        try:
            async with MCPClient(
                customer_id=customer_id,
                conversation_id=conversation_id,
                turn_id=turn_id,
                app=mcp_app,
            ) as client:
                return await client.call_tool(
                    "create_return_request",
                    {
                        "order_number": order_number,
                        "reason": reason,
                        "idempotency_key": idempotency_key,
                    },
                )
        except Exception as exc:
            logger.warning("MCP return creation failed: %s", exc)
            return {"ok": False, "error": "return_failed"}

    async def cancel_order(
        order_number: str,
        reason: str,
        confirmation_id: str,
        idempotency_key: str,
    ) -> dict[str, Any]:
        """Cancel order through MCP."""
        try:
            async with MCPClient(
                customer_id=customer_id,
                conversation_id=conversation_id,
                turn_id=turn_id,
                app=mcp_app,
            ) as client:
                return await client.call_tool(
                    "cancel_order",
                    {
                        "order_number": order_number,
                        "reason": reason,
                        "confirmation_id": confirmation_id,
                        "idempotency_key": idempotency_key,
                    },
                )
        except Exception as exc:
            logger.warning("MCP cancel order failed: %s", exc)
            return {"ok": False, "error": "cancel_failed"}

    async def request_human_handover(
        conversation_id: str,
        reason: str,
        priority: str = "normal",
    ) -> dict[str, Any]:
        """Request handover to a human support agent."""
        try:
            async with MCPClient(
                customer_id=customer_id,
                conversation_id=conversation_id,
                turn_id=turn_id,
                app=mcp_app,
            ) as client:
                return await client.call_tool(
                    "request_human_handover",
                    {
                        "conversation_id": conversation_id,
                        "reason": reason,
                        "priority": priority,
                    },
                )
        except Exception as exc:
            logger.warning("MCP human handover failed: %s", exc)
            return {"ok": False, "error": "handover_failed"}

    async def search_knowledge_base(
        query: str, category: str | None = None, top_k: int = 4
    ) -> dict[str, Any]:
        """Search the store's verified policy knowledge base through MCP."""
        try:
            async with MCPClient(
                customer_id=customer_id,
                conversation_id=conversation_id,
                turn_id=turn_id,
                app=mcp_app,
            ) as client:
                return await client.call_tool(
                    "search_knowledge_base",
                    {"query": query, "category": category, "top_k": top_k},
                )
        except Exception as exc:
            logger.warning("MCP knowledge search failed: %s", exc)
            return {"ok": False, "error": "search_failed", "hits": []}

    return [
        StructuredTool.from_function(
            coroutine=get_order_status,
            name="get_order_status",
            description=(
                "Look up one of the signed-in customer's orders by order number. "
                "Returns status, items, shipment/tracking, totals, and return eligibility."
            ),
            args_schema=GetOrderStatusArgs,
        ),
        StructuredTool.from_function(
            coroutine=list_my_orders,
            name="list_my_orders",
            description=(
                "List the signed-in customer's most recent orders. Use when the customer asks "
                "about an order without providing an order number."
            ),
            args_schema=ListOrdersArgs,
        ),
        StructuredTool.from_function(
            coroutine=get_ticket,
            name="get_ticket",
            description="Look up one of the customer's support tickets by ticket number.",
            args_schema=GetTicketArgs,
        ),
        StructuredTool.from_function(
            coroutine=create_support_ticket,
            name="create_support_ticket",
            description="Create a new support ticket for the customer.",
            args_schema=CreateTicketArgs,
        ),
        StructuredTool.from_function(
            coroutine=check_return_eligibility,
            name="check_return_eligibility",
            description="Check whether an order is eligible for a return.",
            args_schema=CheckReturnEligibilityArgs,
        ),
        StructuredTool.from_function(
            coroutine=create_return_request,
            name="create_return_request",
            description="Create a return request for an eligible order.",
            args_schema=CreateReturnArgs,
        ),
        StructuredTool.from_function(
            coroutine=cancel_order,
            name="cancel_order",
            description="Cancel an unfulfilled order.",
            args_schema=CancelOrderArgs,
        ),
        StructuredTool.from_function(
            coroutine=request_human_handover,
            name="request_human_handover",
            description="Escalate the conversation to a human support agent.",
            args_schema=RequestHumanHandoverArgs,
        ),
        StructuredTool.from_function(
            coroutine=search_knowledge_base,
            name="search_knowledge_base",
            description=(
                "Search verified store policies on returns, refunds, shipping, cancellations, "
                "and warranties. Use to answer questions about store rules."
            ),
            args_schema=SearchKnowledgeBaseArgs,
        ),
    ]


__all__ = [
    "build_customer_tools",
    "GetOrderStatusArgs",
    "ListOrdersArgs",
    "GetTicketArgs",
    "CreateTicketArgs",
    "CheckReturnEligibilityArgs",
    "CreateReturnArgs",
    "CancelOrderArgs",
    "RequestHumanHandoverArgs",
    "SearchKnowledgeBaseArgs",
]
