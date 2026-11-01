"""Typed state for the ResolveAI support agent."""
from __future__ import annotations

from enum import Enum
from typing import Annotated, Any, TypedDict
from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages
from pydantic import BaseModel, Field


class SupportIntent(str, Enum):
    ORDER_STATUS = "order_status"
    GENERAL = "general"
    ESCALATE = "escalate"
    OFF_TOPIC = "off_topic"


class IntentDecision(BaseModel):
    """Structured output of the classify node."""

    intent: SupportIntent = Field(
        description=(
            "order_status when the customer asks about a specific order, delivery, "
            "tracking, or shipment; escalate when they explicitly ask for a human; "
            "off_topic for unrelated requests; general otherwise."
        )
    )
    order_number: str | None = Field(
        default=None,
        description="Order number mentioned by the customer, e.g. ORD-1024. Never invent one.",
    )


class GraphError(TypedDict, total=False):
    node: str
    code: str
    retryable: bool


class SupportState(TypedDict, total=False):
    """Minimal state carried between nodes.

    Identity comes from the verified JWT (via the runner), never from the model.
    Business payloads live in ``tool_results``; ``messages`` is the durable
    transcript used by the checkpointer.
    """

    conversation_id: str
    customer_id: str
    turn_id: str
    messages: Annotated[list[AnyMessage], add_messages]
    intent: str | None
    order_number: str | None
    tool_results: list[dict[str, Any]]
    errors: list[GraphError]
    reply: str
    card: dict[str, Any] | None
    usage: dict[str, int]
