"""Graph nodes: classify → (tools) → compose.

Nodes are factories so tests can inject a fake classifier/model without patching
module globals. No node reads identity from the model; ``customer_id`` only
reaches the tools through the closures created by the runner.
"""
from __future__ import annotations

import json
import logging
import re
from collections.abc import Awaitable, Callable, Sequence
from datetime import datetime
from typing import Any, Protocol

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import (
    AnyMessage,
    BaseMessage,
    SystemMessage,
    ToolMessage,
)
from langchain_core.tools import BaseTool

from app.agents.prompts import (
    CLASSIFY_SYSTEM,
    TOOLS_SYSTEM,
    compose_system_prompt,
)
from app.agents.state import IntentDecision, SupportIntent, SupportState
from app.core.config import settings

logger = logging.getLogger("resolveai.agent")

_ORDER_NUMBER_RE = re.compile(r"^ORD-\d{3,10}$", re.IGNORECASE)

HistoryLoader = Callable[[str], Awaitable[list[AnyMessage]]]


class Classifier(Protocol):
    async def __call__(self, messages: Sequence[AnyMessage]) -> IntentDecision: ...


class LLMClassifier:
    """Structured-output classifier over a chat model."""

    def __init__(self, llm: BaseChatModel):
        self._chain = llm.with_structured_output(IntentDecision)

    async def __call__(self, messages: Sequence[AnyMessage]) -> IntentDecision:
        recent = list(messages)[-10:]
        return await self._chain.ainvoke([SystemMessage(CLASSIFY_SYSTEM), *recent])


def message_text(content: Any) -> str:
    """Normalise LangChain message content (str or content blocks) to text."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict) and isinstance(block.get("text"), str):
                parts.append(block["text"])
        return "".join(parts)
    return ""


def usage_from_message(message: BaseMessage) -> dict[str, int]:
    usage = getattr(message, "usage_metadata", None)
    if not usage:
        return {}
    return {
        "prompt_tokens": int(usage.get("input_tokens") or 0),
        "completion_tokens": int(usage.get("output_tokens") or 0),
    }


def _add_usage(total: dict[str, int], extra: dict[str, int]) -> dict[str, int]:
    if not extra:
        return total
    return {
        "prompt_tokens": total.get("prompt_tokens", 0) + extra.get("prompt_tokens", 0),
        "completion_tokens": total.get("completion_tokens", 0) + extra.get("completion_tokens", 0),
    }


def make_load_context_node(history_loader: HistoryLoader):
    async def load_context(state: SupportState) -> dict[str, Any]:
        history = await history_loader(state["conversation_id"])
        return {"messages": history}

    return load_context


def make_classify_node(classifier: Classifier):
    async def classify_intent(state: SupportState) -> dict[str, Any]:
        try:
            decision = await classifier(state.get("messages", []))
        except Exception as exc:  # no message content in logs
            logger.warning(
                "Intent classification failed",
                extra={"event": "classify_failed", "error_type": type(exc).__name__},
            )
            return {
                "intent": SupportIntent.GENERAL.value,
                "order_number": None,
                "errors": [{"node": "classify_intent", "code": "classifier_failed", "retryable": True}],
            }

        order_number = (decision.order_number or "").strip().upper() or None
        if order_number and not _ORDER_NUMBER_RE.match(order_number):
            order_number = None

        return {"intent": decision.intent.value, "order_number": order_number}

    return classify_intent


def route_intent(state: SupportState) -> str:
    """order_status needs account data; everything else can be answered directly."""
    if state.get("intent") == SupportIntent.ORDER_STATUS.value:
        return "run_tools"
    return "compose_response"


def make_tools_node(llm: BaseChatModel, tools: list[BaseTool]):
    tools_by_name = {tool.name: tool for tool in tools}
    bound = llm.bind_tools(tools) if tools else llm

    async def run_tools(state: SupportState) -> dict[str, Any]:
        history = list(state.get("messages", []))[-settings.agent_history_messages :]
        working: list[AnyMessage] = [SystemMessage(TOOLS_SYSTEM), *history]
        results: list[dict[str, Any]] = []
        errors: list[dict[str, Any]] = []
        usage: dict[str, int] = {}

        for _ in range(max(1, settings.agent_max_steps)):
            response = await bound.ainvoke(working)
            usage = _add_usage(usage, usage_from_message(response))
            calls = getattr(response, "tool_calls", None) or []
            if not calls:
                break
            working.append(response)

            for call in calls:
                name = str(call.get("name") or "")
                args = call.get("args") or {}
                tool = tools_by_name.get(name)
                if tool is None:
                    payload: dict[str, Any] = {"ok": False, "error": "unknown_tool"}
                    errors.append({"node": "run_tools", "code": "unknown_tool", "retryable": False})
                else:
                    try:
                        payload = await tool.ainvoke(args)
                    except Exception as exc:
                        logger.warning(
                            "Tool call failed",
                            extra={"event": "tool_failed", "error_type": type(exc).__name__},
                        )
                        payload = {"ok": False, "error": "tool_failed"}
                        errors.append(
                            {"node": "run_tools", "code": "tool_failed", "retryable": True}
                        )
                results.append({"name": name, "result": payload})
                working.append(
                    ToolMessage(
                        content=json.dumps(payload, default=str),
                        tool_call_id=str(call.get("id") or name),
                    )
                )

        return {"tool_results": results, "errors": errors, "usage": usage}

    return run_tools


def make_compose_node(llm: BaseChatModel):
    async def compose_response(state: SupportState) -> dict[str, Any]:
        results = state.get("tool_results") or []
        system = SystemMessage(
            compose_system_prompt(
                intent=state.get("intent"),
                order_number=state.get("order_number"),
                tool_results_json=json.dumps(results, default=str),
            )
        )
        history = list(state.get("messages", []))[-settings.agent_history_messages :]

        parts: list[str] = []
        last: BaseMessage | None = None
        usage: dict[str, int] = {}
        async for chunk in llm.astream([system, *history]):
            last = chunk
            text = message_text(chunk.content)
            if text:
                parts.append(text)
            chunk_usage = usage_from_message(chunk)
            if chunk_usage:
                usage = chunk_usage

        reply = "".join(parts).strip()
        if not reply and last is not None:
            reply = message_text(last.content).strip()
        if not reply:
            reply = (
                "I could not put together an answer just now. Please try again, or ask to "
                "speak with a human agent."
            )

        return {"reply": reply, "card": build_order_card(results), "usage": usage}

    return compose_response


def build_order_card(results: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Emit an order card only when exactly one order lookup succeeded."""
    orders = [
        item["result"]["order"]
        for item in results
        if item.get("name") == "get_order_status"
        and isinstance(item.get("result"), dict)
        and item["result"].get("ok")
        and isinstance(item["result"].get("order"), dict)
    ]
    if len(orders) != 1:
        return None

    order = orders[0]
    shipment = order.get("shipment") or {}
    return {
        "kind": "order_status",
        "orderNumber": order.get("order_number", ""),
        "status": order.get("status", "pending"),
        "carrier": shipment.get("carrier") or "—",
        "trackingNumber": shipment.get("tracking_number") or "—",
        "estimatedDelivery": shipment.get("estimated_delivery") or "",
        "steps": _order_steps(order, shipment),
    }


def _order_steps(
    order: dict[str, Any], shipment: dict[str, Any]
) -> list[dict[str, str]]:
    status = order.get("status")
    shipment_status = shipment.get("status")
    delivered = status == "delivered" or shipment_status == "delivered"

    if delivered:
        transit_state = "done"
    elif shipment_status in {"in_transit", "out_for_delivery"}:
        transit_state = "current"
    else:
        transit_state = "upcoming"

    shipped_state = "done" if shipment.get("shipped_at") or delivered else "upcoming"
    if not delivered and transit_state == "current":
        shipped_state = "done"

    return [
        {"label": "Placed", "at": _short_date(order.get("placed_at")), "state": "done"},
        {"label": "Shipped", "at": _short_date(shipment.get("shipped_at")), "state": shipped_state},
        {"label": "In transit", "at": _short_date(shipment.get("shipped_at")), "state": transit_state},
        {
            "label": "Delivered",
            "at": _short_date(shipment.get("delivered_at") or shipment.get("estimated_delivery")),
            "state": "done" if delivered else "upcoming",
        },
    ]


def _short_date(value: str | None) -> str:
    if not value:
        return ""
    try:
        return datetime.fromisoformat(value).strftime("%b %d").replace(" 0", " ")
    except ValueError:
        return ""


__all__ = [
    "Classifier",
    "LLMClassifier",
    "make_load_context_node",
    "make_classify_node",
    "make_tools_node",
    "make_compose_node",
    "route_intent",
    "build_order_card",
    "message_text",
    "usage_from_message",
]
