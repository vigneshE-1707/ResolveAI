"""Unit tests for the M4 agent graph (no DB, no network)."""
from __future__ import annotations

import uuid

import pytest
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.tools import StructuredTool
from langgraph.checkpoint.memory import InMemorySaver
from pydantic import BaseModel

from app.agents.graph import build_graph
from app.agents.nodes import build_order_card, route_intent
from app.agents.state import IntentDecision, SupportIntent
from app.agents.tools import GetOrderStatusArgs, ListOrdersArgs
from tests.fakes import FakeToolCallingModel, KeywordClassifier, tool_call_message

ORDER_NUMBER = "ORD-1024"


class _Args(BaseModel):
    order_number: str


def _order_payload(order_number: str = ORDER_NUMBER) -> dict:
    return {
        "ok": True,
        "order": {
            "order_number": order_number,
            "status": "shipped",
            "placed_at": "2026-10-12T10:04:00+00:00",
            "items": [{"name": "Aurora Desk Lamp", "quantity": 1, "unit_price_cents": 8400}],
            "shipment": {
                "carrier": "UPS",
                "tracking_number": "1Z999AA10123456784",
                "status": "in_transit",
                "shipped_at": "2026-10-14T08:11:00+00:00",
                "estimated_delivery": "2026-11-02T00:00:00+00:00",
                "delivered_at": None,
            },
            "return": {"eligible": True, "reason": "Order is eligible for return"},
        },
    }


def _order_tool(record: list[dict] | None = None) -> StructuredTool:
    async def get_order_status(order_number: str) -> dict:
        if record is not None:
            record.append({"order_number": order_number})
        return _order_payload(order_number)

    return StructuredTool.from_function(
        coroutine=get_order_status,
        name="get_order_status",
        description="Look up one of the signed-in customer's orders by order number.",
        args_schema=_Args,
    )


def _state(**overrides) -> dict:
    state = {
        "conversation_id": str(uuid.uuid4()),
        "customer_id": str(uuid.uuid4()),
        "turn_id": str(uuid.uuid4()),
        "messages": [HumanMessage(content="Where is my order ORD-1024?", id="m1")],
        "tool_results": [],
        "errors": [],
        "reply": "",
        "card": None,
        "usage": {},
    }
    state.update(overrides)
    return state


async def _run(graph, state: dict, thread_id: str = "thread-1"):
    config = {"configurable": {"thread_id": thread_id}}
    tokens: list[str] = []
    async for chunk, metadata in graph.astream(state, config=config, stream_mode="messages"):
        if metadata.get("langgraph_node") == "compose_response":
            tokens.append(str(chunk.content))
    snapshot = await graph.aget_state(config)
    return "".join(tokens), snapshot.values


def _graph(llm, tools, *, classifier=None, history=None):
    async def default_history(_conversation_id: str):
        return []

    return build_graph(
        llm=llm,
        tools=tools,
        classifier=classifier or KeywordClassifier(),
        history_loader=history or default_history,
        checkpointer=InMemorySaver(),
    )


async def test_order_question_runs_the_tool_and_streams_a_card():
    lookups: list[dict] = []
    llm = FakeToolCallingModel(
        responses=[
            tool_call_message(ORDER_NUMBER),
            AIMessage(content=""),
            AIMessage(content="Order ORD-1024 is in transit with UPS."),
        ]
    )
    graph = _graph(llm, [_order_tool(lookups)])

    text, values = await _run(graph, _state())

    assert lookups == [{"order_number": ORDER_NUMBER}]
    assert values["intent"] == SupportIntent.ORDER_STATUS.value
    assert values["order_number"] == ORDER_NUMBER
    assert text == "Order ORD-1024 is in transit with UPS."
    assert values["reply"] == text

    card = values["card"]
    assert card["kind"] == "order_status"
    assert card["orderNumber"] == ORDER_NUMBER
    assert card["carrier"] == "UPS"
    assert [step["state"] for step in card["steps"]] == [
        "done",
        "done",
        "current",
        "upcoming",
    ]


async def test_general_question_skips_tools_and_answers_directly():
    llm = FakeToolCallingModel(
        responses=[AIMessage(content="Returns are accepted within 30 days of delivery.")]
    )
    graph = _graph(llm, [_order_tool()])

    text, values = await _run(graph, _state(messages=[HumanMessage(content="What is your return policy?", id="m1")]))

    assert values["intent"] == SupportIntent.GENERAL.value
    assert values["tool_results"] == []
    assert values["card"] is None
    assert text == "Returns are accepted within 30 days of delivery."
    # Only compose ran, so exactly one model call was made.
    assert len(llm.calls) == 1


async def test_classifier_failure_falls_back_to_general_without_crashing():
    async def broken(_messages):
        raise RuntimeError("structured output unavailable")

    llm = FakeToolCallingModel(responses=[AIMessage(content="Happy to help with that.")])
    graph = _graph(llm, [_order_tool()], classifier=broken)

    text, values = await _run(graph, _state())

    assert values["intent"] == SupportIntent.GENERAL.value
    assert values["errors"] == [
        {"node": "classify_intent", "code": "classifier_failed", "retryable": True}
    ]
    assert text == "Happy to help with that."


async def test_classifier_cannot_inject_a_malformed_order_number():
    async def classifier(_messages):
        return IntentDecision(
            intent=SupportIntent.ORDER_STATUS, order_number="'; DROP TABLE orders; --"
        )

    lookups: list[dict] = []
    llm = FakeToolCallingModel(
        responses=[
            AIMessage(content="", tool_calls=[
                {"name": "get_order_status", "args": {"order_number": "ORD-1"}, "id": "call_1"}
            ]),
            AIMessage(content=""),
            AIMessage(content="I could not find that order on your account."),
        ]
    )
    graph = _graph(llm, [_order_tool(lookups)], classifier=classifier)

    _text, values = await _run(graph, _state())

    assert values["order_number"] is None
    assert lookups == [{"order_number": "ORD-1"}]


async def test_unknown_tool_is_reported_not_executed():
    llm = FakeToolCallingModel(
        responses=[
            AIMessage(content="", tool_calls=[
                {"name": "delete_all_orders", "args": {}, "id": "call_1"}
            ]),
            AIMessage(content=""),
            AIMessage(content="I can only look up orders."),
        ]
    )
    graph = _graph(llm, [_order_tool()])

    _text, values = await _run(graph, _state())

    assert values["tool_results"][0]["result"] == {"ok": False, "error": "unknown_tool"}
    assert values["errors"] == [
        {"node": "run_tools", "code": "unknown_tool", "retryable": False}
    ]


async def test_prior_turns_are_visible_to_compose():
    seen: list[list] = []

    async def history(_conversation_id: str):
        return [
            HumanMessage(content="My order is ORD-1024", id="h1"),
            AIMessage(content="It is in transit.", id="h2"),
        ]

    class RecordingModel(FakeToolCallingModel):
        def _next(self, messages):
            seen.append(list(messages))
            return super()._next(messages)

    llm = RecordingModel(responses=[AIMessage(content="It should arrive on Nov 2.")])
    graph = _graph(llm, [_order_tool()], history=history)

    text, _values = await _run(graph, _state(messages=[HumanMessage(content="And when?", id="m1")]))

    assert text == "It should arrive on Nov 2."
    compose_prompt = seen[-1]
    contents = [message.content for message in compose_prompt]
    assert "My order is ORD-1024" in contents
    assert "It is in transit." in contents
    assert isinstance(compose_prompt[0], SystemMessage)


async def test_tool_schemas_never_expose_customer_identity():
    """Identity comes from the JWT; the model must not be able to pass it."""
    for schema in (GetOrderStatusArgs, ListOrdersArgs):
        assert "customer_id" not in schema.model_json_schema()["properties"]


def test_route_intent_sends_only_order_status_to_tools():
    assert route_intent({"intent": SupportIntent.ORDER_STATUS.value}) == "run_tools"
    for intent in (SupportIntent.GENERAL, SupportIntent.ESCALATE, SupportIntent.OFF_TOPIC):
        assert route_intent({"intent": intent.value}) == "compose_response"
    assert route_intent({}) == "compose_response"


def test_build_order_card_requires_exactly_one_successful_lookup():
    single = [{"name": "get_order_status", "result": _order_payload()}]
    assert build_order_card(single)["orderNumber"] == ORDER_NUMBER

    assert build_order_card([]) is None
    assert build_order_card([{"name": "list_my_orders", "result": {"ok": True, "orders": []}}]) is None
    assert build_order_card(
        [{"name": "get_order_status", "result": {"ok": False, "error": "not_found"}}]
    ) is None
    two = single + [{"name": "get_order_status", "result": _order_payload("ORD-2")}]
    assert build_order_card(two) is None


@pytest.mark.parametrize(
    ("status", "shipment_status", "expected"),
    [
        ("delivered", "delivered", ["done", "done", "done", "done"]),
        ("shipped", "in_transit", ["done", "done", "current", "upcoming"]),
        ("processing", "prepared", ["done", "upcoming", "upcoming", "upcoming"]),
    ],
)
def test_card_steps_follow_the_shipment_state(status, shipment_status, expected):
    payload = _order_payload()
    payload["order"]["status"] = status
    payload["order"]["shipment"]["status"] = shipment_status
    if status == "processing":
        payload["order"]["shipment"]["shipped_at"] = None

    card = build_order_card([{"name": "get_order_status", "result": payload}])

    assert [step["state"] for step in card["steps"]] == expected
