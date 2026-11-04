"""Typed state for the ResolveAI support agent."""
from __future__ import annotations

from enum import Enum
from typing import Annotated, Any, TypedDict
from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages
from pydantic import BaseModel, Field


class SupportIntent(str, Enum):
    ORDER_STATUS = "order_status"
    POLICY_QA = "policy_qa"
    RETURN_REQUEST = "return_request"
    DELIVERY_COMPLAINT = "delivery_complaint"
    TICKET_CREATION = "ticket_creation"
    CLARIFY = "clarify"
    ESCALATE = "escalate"
    OFF_TOPIC = "off_topic"
    GENERAL = "general"


class IntentDecision(BaseModel):
    """Structured output of the classify node."""

    intent: SupportIntent = Field(
        description=(
            "order_status: asks about order status, tracking, or shipment details;\n"
            "delivery_complaint: complains about a late, missing, damaged, or problematic shipment/delivery;\n"
            "return_request: asks to return an item, send back a product, or request a refund on an order;\n"
            "ticket_creation: explicitly asks to open a support ticket or file a formal complaint;\n"
            "policy_qa: asks about store policies (returns, refunds, shipping times, warranty, order cancellation rules);\n"
            "escalate: explicitly asks to speak to a human agent, supervisor, or representative;\n"
            "clarify: customer query is missing critical details needed to act;\n"
            "off_topic: unrelated requests; general: other product/account questions."
        )
    )
    order_number: str | None = Field(
        default=None,
        description="Order number mentioned by the customer, e.g. ORD-1024. Never invent one.",
    )
    reason: str | None = Field(
        default=None,
        description="Reason for return or complaint (e.g. damaged, wrong_item, defective, changed_mind, late).",
    )
    needs_clarification: bool = Field(
        default=False,
        description="True if customer request lacks essential information to proceed.",
    )
    clarification_prompt: str | None = Field(
        default=None,
        description="Specific question to ask the user to clarify their request.",
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
    reason: str | None
    pending_action: dict[str, Any] | None
    approval_decision: str | None
    interrupted: bool | None
    escalated: bool | None
    ticket_number: str | None
    tool_results: list[dict[str, Any]]
    retrieved_knowledge: list[dict[str, Any]]
    sources: list[dict[str, Any]] | None
    errors: list[GraphError]
    reply: str
    card: dict[str, Any] | None
    usage: dict[str, int]
