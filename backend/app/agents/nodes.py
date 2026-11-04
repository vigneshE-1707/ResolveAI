"""Graph nodes: classify → (tools | retrieve_knowledge | workflows) → compose.

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
from langgraph.types import interrupt

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
KnowledgeRetriever = Callable[[str], Awaitable[list[dict[str, Any]]]]


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
                "reason": None,
                "errors": [{"node": "classify_intent", "code": "classifier_failed", "retryable": True}],
            }

        order_number = (decision.order_number or "").strip().upper() or None
        if order_number and not _ORDER_NUMBER_RE.match(order_number):
            order_number = None

        return {
            "intent": decision.intent.value,
            "order_number": order_number,
            "reason": decision.reason,
        }

    return classify_intent


def route_intent(state: SupportState) -> str:
    """Route classified intent to specialized sub-workflow or direct compose."""
    intent = state.get("intent")
    if intent == SupportIntent.ORDER_STATUS.value:
        return "run_tools"
    if intent == SupportIntent.POLICY_QA.value:
        return "retrieve_knowledge"
    if intent == SupportIntent.DELIVERY_COMPLAINT.value:
        return "delivery_complaint"
    if intent == SupportIntent.RETURN_REQUEST.value:
        return "return_flow"
    if intent == SupportIntent.TICKET_CREATION.value:
        return "run_tools"
    if intent == SupportIntent.ESCALATE.value:
        return "escalate"
    return "compose_response"


def route_return_flow(state: SupportState) -> str:
    """Route from return_flow: if pending approval, interrupt; otherwise compose directly."""
    if state.get("pending_action"):
        return "approval"
    return "compose_response"


def make_retrieve_knowledge_node(retriever: KnowledgeRetriever):
    async def retrieve_knowledge(state: SupportState) -> dict[str, Any]:
        query = ""
        for msg in reversed(state.get("messages", [])):
            role = getattr(msg, "role", None) or getattr(msg, "type", None)
            if role in ("human", "user"):
                query = message_text(msg.content)
                break
        if not query and state.get("messages"):
            query = message_text(state["messages"][-1].content)

        if not query:
            return {"retrieved_knowledge": [], "sources": []}

        try:
            hits = await retriever(query)
            sources = [
                {
                    "title": hit.get("title", "Store Policy"),
                    "category": hit.get("category", "general"),
                    "chunk_index": hit.get("chunk_index", 0),
                }
                for hit in hits
            ]
            return {"retrieved_knowledge": hits, "sources": sources}
        except Exception as exc:
            logger.warning(
                "Knowledge retrieval failed",
                extra={"event": "retrieve_failed", "error_type": type(exc).__name__},
            )
            return {
                "retrieved_knowledge": [],
                "sources": [],
                "errors": [
                    {"node": "retrieve_knowledge", "code": "retrieval_failed", "retryable": True}
                ],
            }

    return retrieve_knowledge


def make_tools_node(llm: BaseChatModel, tools: list[BaseTool]):
    tools_by_name = {tool.name: tool for tool in tools}
    bound = llm.bind_tools(tools) if tools else llm

    async def run_tools(state: SupportState) -> dict[str, Any]:
        history = list(state.get("messages", []))[-settings.agent_history_messages :]
        working: list[AnyMessage] = [SystemMessage(TOOLS_SYSTEM), *history]
        results: list[dict[str, Any]] = list(state.get("tool_results") or [])
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


def make_delivery_node(tools: list[BaseTool]):
    """Delivery complaint workflow node: checks order/shipment and creates ticket if needed."""
    tools_by_name = {tool.name: tool for tool in tools}

    async def delivery_complaint(state: SupportState) -> dict[str, Any]:
        order_number = state.get("order_number")
        results = list(state.get("tool_results") or [])
        ticket_number = None

        # 1. Lookup order info if order number available
        get_status_tool = tools_by_name.get("get_order_status")
        list_orders_tool = tools_by_name.get("list_my_orders")
        create_ticket_tool = tools_by_name.get("create_support_ticket")

        if order_number and get_status_tool:
            try:
                res = await get_status_tool.ainvoke({"order_number": order_number})
                results.append({"name": "get_order_status", "result": res})
            except Exception as exc:
                logger.warning("Delivery node order status lookup failed: %s", exc)
        elif list_orders_tool:
            try:
                res = await list_orders_tool.ainvoke({"limit": 3})
                results.append({"name": "list_my_orders", "result": res})
                if res.get("ok") and res.get("orders"):
                    order_number = res["orders"][0]["order_number"]
            except Exception as exc:
                logger.warning("Delivery node order listing failed: %s", exc)

        # 2. File delivery issue ticket
        if create_ticket_tool:
            subject = f"Delivery inquiry for {order_number}" if order_number else "Delivery issue reported"
            desc = f"Customer reported delivery delay or issue for order {order_number}."
            try:
                tkt_res = await create_ticket_tool.ainvoke({
                    "subject": subject,
                    "category": "delivery_issue",
                    "description": desc,
                    "order_number": order_number,
                })
                results.append({"name": "create_support_ticket", "result": tkt_res})
                if tkt_res.get("ok"):
                    ticket_number = tkt_res.get("ticket_number")
            except Exception as exc:
                logger.warning("Delivery node ticket creation failed: %s", exc)

        return {
            "order_number": order_number,
            "tool_results": results,
            "ticket_number": ticket_number,
        }

    return delivery_complaint


def make_return_flow_node(tools: list[BaseTool]):
    """Return request workflow: evaluates return eligibility and prepares approval action."""
    tools_by_name = {tool.name: tool for tool in tools}

    async def return_flow(state: SupportState) -> dict[str, Any]:
        order_number = state.get("order_number")
        results = list(state.get("tool_results") or [])

        # If no order number specified, attempt to inspect recent orders
        if not order_number and tools_by_name.get("list_my_orders"):
            try:
                orders_res = await tools_by_name["list_my_orders"].ainvoke({"limit": 3})
                results.append({"name": "list_my_orders", "result": orders_res})
                if orders_res.get("ok") and orders_res.get("orders") and len(orders_res["orders"]) == 1:
                    order_number = orders_res["orders"][0]["order_number"]
            except Exception as exc:
                logger.warning("Error fetching orders in return_flow: %s", exc)

        if not order_number:
            return {"tool_results": results, "pending_action": None}

        # Check return eligibility
        check_tool = tools_by_name.get("check_return_eligibility")
        eligibility = None
        if check_tool:
            try:
                eligibility = await check_tool.ainvoke({"order_number": order_number})
                results.append({"name": "check_return_eligibility", "result": eligibility})
            except Exception as exc:
                logger.warning("Return eligibility check failed: %s", exc)

        # If eligible, prepare approval action envelope
        if eligibility and eligibility.get("ok") and eligibility.get("eligible"):
            reason = state.get("reason") or "changed_mind"
            pending_action = {
                "action": "create_return",
                "order_number": order_number,
                "reason": reason,
                "summary": f"Create return for order {order_number} (reason: {reason})",
                "approval_id": f"appr-{state.get('turn_id', '')}",
            }
            return {
                "order_number": order_number,
                "tool_results": results,
                "pending_action": pending_action,
            }

        return {
            "order_number": order_number,
            "tool_results": results,
            "pending_action": None,
        }

    return return_flow


def make_approval_node(tools: list[BaseTool]):
    """Human-in-the-loop approval node: interrupts for user confirmation, then executes."""
    tools_by_name = {tool.name: tool for tool in tools}

    async def approval(state: SupportState) -> dict[str, Any]:
        pending = state.get("pending_action")
        if not pending:
            return {}

        # Pause execution using LangGraph interrupt
        resume_val = interrupt(pending)

        # Resumed via Command(resume=...)
        decision = "denied"
        if isinstance(resume_val, str):
            decision = resume_val.lower()
        elif isinstance(resume_val, dict):
            decision = str(resume_val.get("decision", "denied")).lower()

        results = list(state.get("tool_results") or [])
        if decision in ("granted", "approved", "confirm", "confirmed"):
            order_number = pending.get("order_number")
            reason = pending.get("reason", "changed_mind")
            idempotency_key = f"ret-{state.get('conversation_id')}-{state.get('turn_id')}"
            tool = tools_by_name.get("create_return_request")
            if tool:
                try:
                    payload = await tool.ainvoke({
                        "order_number": order_number,
                        "reason": reason,
                        "idempotency_key": idempotency_key,
                    })
                    results.append({"name": "create_return_request", "result": payload})
                except Exception as exc:
                    results.append({"name": "create_return_request", "result": {"ok": False, "error": str(exc)}})
            return {
                "approval_decision": "granted",
                "tool_results": results,
                "pending_action": None,
            }
        else:
            return {
                "approval_decision": "denied",
                "pending_action": None,
            }

    return approval


def make_escalate_node(tools: list[BaseTool]):
    """Escalates conversation to human agent queue."""
    tools_by_name = {tool.name: tool for tool in tools}

    async def escalate(state: SupportState) -> dict[str, Any]:
        conv_id = state.get("conversation_id", "")
        results = list(state.get("tool_results") or [])
        handover_tool = tools_by_name.get("request_human_handover")
        if handover_tool and conv_id:
            try:
                res = await handover_tool.ainvoke({
                    "conversation_id": conv_id,
                    "reason": "Customer requested a human support agent",
                    "priority": "normal",
                })
                results.append({"name": "request_human_handover", "result": res})
            except Exception as exc:
                logger.warning("Escalation handover tool call failed: %s", exc)

        return {
            "escalated": True,
            "tool_results": results,
        }

    return escalate


def make_compose_node(llm: BaseChatModel):
    async def compose_response(state: SupportState) -> dict[str, Any]:
        results = state.get("tool_results") or []
        retrieved = state.get("retrieved_knowledge") or []
        system = SystemMessage(
            compose_system_prompt(
                intent=state.get("intent"),
                order_number=state.get("order_number"),
                tool_results_json=json.dumps(results, default=str),
                retrieved_knowledge=retrieved,
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

        card = build_response_card(results, state)

        return {
            "reply": reply,
            "card": card,
            "sources": state.get("sources"),
            "usage": usage,
        }

    return compose_response


def build_response_card(
    results: list[dict[str, Any]],
    state: SupportState | None = None,
) -> dict[str, Any] | None:
    """Build the grounded response card (approval, ticket, escalation, or order status)."""
    if state:
        if state.get("pending_action"):
            pending = state["pending_action"]
            return {
                "kind": "approval_request",
                "action": pending.get("action", "create_return"),
                "summary": pending.get("summary", ""),
                "approvalId": pending.get("approval_id", ""),
            }
        if state.get("escalated"):
            return {
                "kind": "escalation",
                "reason": "Customer transferred to human specialist queue.",
                "queuePosition": 1,
                "estimatedWait": "3-5 min",
            }

    # Check for created ticket
    for item in reversed(results):
        if item.get("name") == "create_support_ticket":
            res = item.get("result") or {}
            if res.get("ok") and res.get("ticket_number"):
                return {
                    "kind": "ticket_created",
                    "ticketNumber": res.get("ticket_number"),
                    "subject": res.get("subject", "Support Ticket"),
                    "status": res.get("status", "open"),
                }

    # Check for order status card
    return build_order_card(results)


def build_order_card(results: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Emit an order card only when exactly one order lookup succeeded."""
    orders = [
        item["result"]["order"]
        for item in results
        if item.get("name") in ("get_order_status", "get_order_info")
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
    "HistoryLoader",
    "KnowledgeRetriever",
    "make_load_context_node",
    "make_classify_node",
    "make_tools_node",
    "make_delivery_node",
    "make_return_flow_node",
    "make_approval_node",
    "make_escalate_node",
    "make_retrieve_knowledge_node",
    "make_compose_node",
    "route_intent",
    "route_return_flow",
    "build_order_card",
    "build_response_card",
    "message_text",
    "usage_from_message",
]
