"""Unit tests for Milestone 7 Advanced Workflows (approval, returns, delivery complaints, escalation)."""
from __future__ import annotations

import uuid
from typing import Any
import pytest
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.tools import StructuredTool
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.types import Command
from pydantic import BaseModel

from app.agents.graph import build_graph
from app.agents.nodes import build_response_card
from app.agents.state import IntentDecision, SupportIntent
from tests.fakes import FakeToolCallingModel


class DummyArgs(BaseModel):
    order_number: str


class CreateReturnArgs(BaseModel):
    order_number: str
    reason: str
    idempotency_key: str


class CreateTicketArgs(BaseModel):
    subject: str
    category: str
    description: str | None = None
    order_number: str | None = None


class HandoverArgs(BaseModel):
    conversation_id: str
    reason: str
    priority: str = "normal"


def make_test_tools(
    *,
    eligible: bool = True,
    eligibility_reason: str = "Eligible for return",
    return_result: dict[str, Any] | None = None,
    ticket_result: dict[str, Any] | None = None,
    order_result: dict[str, Any] | None = None,
):
    created_returns = []
    created_tickets = []
    escalation_calls = []

    async def check_return_eligibility(order_number: str):
        return {
            "ok": True,
            "order_number": order_number,
            "eligible": eligible,
            "reason": eligibility_reason,
            "return_window_end": "2026-11-20T00:00:00Z",
        }

    async def create_return_request(order_number: str, reason: str, idempotency_key: str):
        res = return_result or {
            "ok": True,
            "return_id": str(uuid.uuid4()),
            "order_number": order_number,
            "status": "requested",
            "reason_code": reason,
        }
        created_returns.append({"order_number": order_number, "reason": reason, "idempotency_key": idempotency_key})
        return res

    async def get_order_status(order_number: str):
        return order_result or {
            "ok": True,
            "order": {
                "order_number": order_number,
                "status": "delivered",
                "total_cents": 5900,
                "currency": "USD",
                "items": [{"name": "Test Item", "quantity": 1, "unit_price_cents": 5900}],
                "shipment": {
                    "carrier": "FedEx",
                    "tracking_number": "TRK-98765",
                    "status": "delivered",
                },
            },
        }

    async def create_support_ticket(subject: str, category: str, description: str = None, order_number: str = None):
        res = ticket_result or {
            "ok": True,
            "ticket_number": "TKT-5555",
            "subject": subject,
            "category": category,
            "status": "open",
        }
        created_tickets.append({"subject": subject, "category": category, "order_number": order_number})
        return res

    async def request_human_handover(conversation_id: str, reason: str, priority: str = "normal"):
        res = {"ok": True, "conversation_id": conversation_id, "mode": "human_pending"}
        escalation_calls.append({"conversation_id": conversation_id, "reason": reason})
        return res

    tools = [
        StructuredTool.from_function(
            coroutine=check_return_eligibility,
            name="check_return_eligibility",
            description="Check return eligibility",
            args_schema=DummyArgs,
        ),
        StructuredTool.from_function(
            coroutine=create_return_request,
            name="create_return_request",
            description="Create return request",
            args_schema=CreateReturnArgs,
        ),
        StructuredTool.from_function(
            coroutine=get_order_status,
            name="get_order_status",
            description="Get order status",
            args_schema=DummyArgs,
        ),
        StructuredTool.from_function(
            coroutine=create_support_ticket,
            name="create_support_ticket",
            description="Create support ticket",
            args_schema=CreateTicketArgs,
        ),
        StructuredTool.from_function(
            coroutine=request_human_handover,
            name="request_human_handover",
            description="Escalate to human",
            args_schema=HandoverArgs,
        ),
    ]

    return tools, created_returns, created_tickets, escalation_calls


class MockClassifier:
    def __init__(self, intent: SupportIntent, order_number: str | None = None, reason: str | None = None):
        self.intent = intent
        self.order_number = order_number
        self.reason = reason

    async def __call__(self, messages):
        return IntentDecision(intent=self.intent, order_number=self.order_number, reason=self.reason)


@pytest.mark.asyncio
async def test_return_workflow_interrupt_and_resume_approved():
    """Eligible return request pauses at interrupt, then upon approval executes return."""
    tools, created_returns, _, _ = make_test_tools(eligible=True)
    checkpointer = InMemorySaver()
    llm = FakeToolCallingModel(responses=[AIMessage(content="Return request submitted.")])
    graph = build_graph(
        llm=llm,
        tools=tools,
        classifier=MockClassifier(SupportIntent.RETURN_REQUEST, order_number="ORD-1024", reason="damaged"),
        checkpointer=checkpointer,
    )

    thread_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}
    initial_state = {
        "conversation_id": thread_id,
        "customer_id": str(uuid.uuid4()),
        "turn_id": "turn-1",
        "messages": [HumanMessage(content="I want to return order ORD-1024 because it is damaged", id="m1")],
        "tool_results": [],
        "errors": [],
        "retrieved_knowledge": [],
        "reply": "",
        "card": None,
        "usage": {},
    }

    # Step 1: Run until interrupt
    async for _ in graph.astream(initial_state, config=config, stream_mode="messages"):
        pass

    state_paused = await graph.aget_state(config)
    assert len(state_paused.tasks) > 0
    assert any(t.interrupts for t in state_paused.tasks)
    pending_action = state_paused.tasks[0].interrupts[0].value
    assert pending_action["action"] == "create_return"
    assert pending_action["order_number"] == "ORD-1024"
    assert pending_action["reason"] == "damaged"

    # Step 2: Resume with granted approval
    async for _ in graph.astream(Command(resume={"decision": "granted"}), config=config, stream_mode="messages"):
        pass

    final_state = await graph.aget_state(config)
    assert final_state.values.get("approval_decision") == "granted"
    assert len(created_returns) == 1
    assert created_returns[0]["order_number"] == "ORD-1024"
    assert created_returns[0]["reason"] == "damaged"


@pytest.mark.asyncio
async def test_return_workflow_interrupt_and_resume_denied():
    """If user cancels/denies the return approval, no return is created."""
    tools, created_returns, _, _ = make_test_tools(eligible=True)
    checkpointer = InMemorySaver()
    llm = FakeToolCallingModel(responses=[AIMessage(content="Return cancelled as requested.")])
    graph = build_graph(
        llm=llm,
        tools=tools,
        classifier=MockClassifier(SupportIntent.RETURN_REQUEST, order_number="ORD-1024", reason="changed_mind"),
        checkpointer=checkpointer,
    )

    thread_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}
    initial_state = {
        "conversation_id": thread_id,
        "customer_id": str(uuid.uuid4()),
        "turn_id": "turn-2",
        "messages": [HumanMessage(content="I want to return order ORD-1024", id="m1")],
        "tool_results": [],
        "errors": [],
        "retrieved_knowledge": [],
        "reply": "",
        "card": None,
        "usage": {},
    }

    async for _ in graph.astream(initial_state, config=config, stream_mode="messages"):
        pass

    # Deny approval
    async for _ in graph.astream(Command(resume={"decision": "denied"}), config=config, stream_mode="messages"):
        pass

    final_state = await graph.aget_state(config)
    assert final_state.values.get("approval_decision") == "denied"
    assert len(created_returns) == 0


@pytest.mark.asyncio
async def test_ineligible_return_does_not_interrupt():
    """Ineligible return request explains why without interrupting for approval."""
    tools, created_returns, _, _ = make_test_tools(eligible=False, eligibility_reason="Past 30-day return window")
    checkpointer = InMemorySaver()
    llm = FakeToolCallingModel(responses=[AIMessage(content="Unfortunately, this order is past the 30-day return window.")])
    graph = build_graph(
        llm=llm,
        tools=tools,
        classifier=MockClassifier(SupportIntent.RETURN_REQUEST, order_number="ORD-1024"),
        checkpointer=checkpointer,
    )

    thread_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}
    initial_state = {
        "conversation_id": thread_id,
        "customer_id": str(uuid.uuid4()),
        "turn_id": "turn-3",
        "messages": [HumanMessage(content="Return order ORD-1024", id="m1")],
        "tool_results": [],
        "errors": [],
        "retrieved_knowledge": [],
        "reply": "",
        "card": None,
        "usage": {},
    }

    tokens = []
    async for chunk, meta in graph.astream(initial_state, config=config, stream_mode="messages"):
        if meta.get("langgraph_node") == "compose_response":
            tokens.append(str(chunk.content))

    state = await graph.aget_state(config)
    assert state.next == ()
    assert len(created_returns) == 0
    assert "past the 30-day return window" in "".join(tokens).lower()


@pytest.mark.asyncio
async def test_delivery_complaint_workflow_creates_ticket():
    """Delivery complaint workflow inspects shipment and automatically creates a support ticket."""
    tools, _, created_tickets, _ = make_test_tools()
    checkpointer = InMemorySaver()
    llm = FakeToolCallingModel(responses=[AIMessage(content="I see your shipment is delayed. I have created a ticket for our dispatch team.")])
    graph = build_graph(
        llm=llm,
        tools=tools,
        classifier=MockClassifier(SupportIntent.DELIVERY_COMPLAINT, order_number="ORD-1024"),
        checkpointer=checkpointer,
    )

    thread_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}
    initial_state = {
        "conversation_id": thread_id,
        "customer_id": str(uuid.uuid4()),
        "turn_id": "turn-4",
        "messages": [HumanMessage(content="Where is my delivery for ORD-1024? It is very late!", id="m1")],
        "tool_results": [],
        "errors": [],
        "retrieved_knowledge": [],
        "reply": "",
        "card": None,
        "usage": {},
    }

    async for _ in graph.astream(initial_state, config=config, stream_mode="messages"):
        pass

    final_state = await graph.aget_state(config)
    assert len(created_tickets) == 1
    assert created_tickets[0]["category"] == "delivery_issue"
    assert created_tickets[0]["order_number"] == "ORD-1024"
    assert final_state.values.get("card") is not None
    assert final_state.values["card"]["kind"] == "ticket_created"


@pytest.mark.asyncio
async def test_escalation_workflow_invokes_handover():
    """Escalation intent triggers handover tool and emits escalation card."""
    tools, _, _, escalation_calls = make_test_tools()
    checkpointer = InMemorySaver()
    llm = FakeToolCallingModel(responses=[AIMessage(content="I've transferred you to a human agent.")])
    graph = build_graph(
        llm=llm,
        tools=tools,
        classifier=MockClassifier(SupportIntent.ESCALATE),
        checkpointer=checkpointer,
    )

    thread_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}
    initial_state = {
        "conversation_id": thread_id,
        "customer_id": str(uuid.uuid4()),
        "turn_id": "turn-5",
        "messages": [HumanMessage(content="I want to speak with a human agent please", id="m1")],
        "tool_results": [],
        "errors": [],
        "retrieved_knowledge": [],
        "reply": "",
        "card": None,
        "usage": {},
    }

    async for _ in graph.astream(initial_state, config=config, stream_mode="messages"):
        pass

    final_state = await graph.aget_state(config)
    assert len(escalation_calls) == 1
    assert final_state.values.get("escalated") is True
    assert final_state.values.get("card") is not None
    assert final_state.values["card"]["kind"] == "escalation"
