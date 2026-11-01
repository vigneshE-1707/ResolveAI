"""Account-scoped tools for the M4 agent.

Identity is injected by the runner from the verified JWT. Tool schemas never
accept a customer id, so the model cannot ask for (or be tricked into
requesting) another customer's data. Milestone 5 rewires these calls through
the MCP server; the signatures and return shapes stay the same.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from langchain_core.tools import BaseTool, StructuredTool
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.order import Order
from app.repositories.order_repo import OrderRepository, ReturnRequestRepository
from app.services.return_service import evaluate_return_eligibility


class GetOrderStatusArgs(BaseModel):
    order_number: str = Field(
        description="Order number exactly as the customer wrote it, e.g. ORD-1024."
    )


class ListOrdersArgs(BaseModel):
    limit: int = Field(default=5, ge=1, le=10, description="How many recent orders to return.")


def _serialize_order(order: Order, *, return_info: dict[str, Any] | None = None) -> dict[str, Any]:
    shipment = getattr(order, "shipment", None)
    return {
        "order_number": order.order_number,
        "status": order.status,
        "placed_at": order.placed_at.isoformat() if order.placed_at else None,
        "total": {"amount_cents": order.total_cents, "currency": order.currency},
        "items": [
            {
                "name": item.name_snapshot,
                "quantity": item.quantity,
                "unit_price_cents": item.unit_price_cents,
            }
            for item in order.items
        ],
        "shipment": (
            {
                "carrier": shipment.carrier,
                "tracking_number": shipment.tracking_number,
                "status": shipment.status,
                "shipped_at": _iso(shipment.shipped_at),
                "estimated_delivery": _iso(shipment.estimated_delivery),
                "delivered_at": _iso(shipment.delivered_at),
            }
            if shipment
            else None
        ),
        "return": return_info,
    }


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def build_customer_tools(session: AsyncSession, customer_id: uuid.UUID) -> list[BaseTool]:
    """Tools are closures over the caller's identity and DB session."""
    order_repo = OrderRepository(session)
    return_repo = ReturnRequestRepository(session)

    async def get_order_status(order_number: str) -> dict[str, Any]:
        try:
            order = await order_repo.get_by_order_number(
                order_number.strip().upper(), customer_id=customer_id
            )
        except Exception:  # never leak DB details to the model
            return {"ok": False, "error": "lookup_failed"}
        if not order:
            return {"ok": False, "error": "not_found", "order_number": order_number}
        active_return = await return_repo.get_active_for_order(order.id)
        return {
            "ok": True,
            "order": _serialize_order(
                order, return_info=evaluate_return_eligibility(order, active_return=active_return)
            ),
        }

    async def list_my_orders(limit: int = 5) -> dict[str, Any]:
        try:
            orders, _total = await order_repo.list_by_customer(customer_id, limit=limit)
        except Exception:
            return {"ok": False, "error": "lookup_failed"}
        return {
            "ok": True,
            "orders": [
                {
                    "order_number": order.order_number,
                    "status": order.status,
                    "placed_at": _iso(order.placed_at),
                    "first_item": order.items[0].name_snapshot if order.items else None,
                }
                for order in orders
            ],
        }

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
    ]


__all__ = ["build_customer_tools", "GetOrderStatusArgs", "ListOrdersArgs"]
