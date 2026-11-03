"""End-to-end chat turns with the real runner, a scripted model, and the DB.

The model and the classifier are fakes, so these tests are deterministic and
need no API key. Everything else — persistence, the tool closures, history
loading, ai_run bookkeeping, and SSE framing — is production code.
"""
from __future__ import annotations

import json
import uuid

import pytest
from fastapi import Depends
from langchain_core.messages import AIMessage
from langgraph.checkpoint.memory import InMemorySaver
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.runner import AgentRunner
from app.api.v1.chat import get_agent_runner
from app.api.v1.dependencies import get_db
from app.core.config import settings
from app.db.session import async_session_factory
from app.main import application
from app.models.audit import AiRun
from app.models.conversation import Message
from tests.fakes import FakeToolCallingModel, KeywordClassifier, tool_call_message

ORDER_NUMBER = "ORD-1024"
REPLY = "Order ORD-1024 is in transit with UPS and should arrive on Nov 2."


class ScriptedModels:
    """One fresh fake model per turn, so each turn has its own script."""

    def __init__(self, scripts: list[list[AIMessage]]):
        self.scripts = scripts
        self.models: list[FakeToolCallingModel] = []

    def __call__(self) -> FakeToolCallingModel:
        script = self.scripts[min(len(self.models), len(self.scripts) - 1)]
        model = FakeToolCallingModel(responses=list(script))
        self.models.append(model)
        return model


def _order_script(order_number: str = ORDER_NUMBER, reply: str = REPLY) -> list[AIMessage]:
    return [tool_call_message(order_number), AIMessage(content=""), AIMessage(content=reply)]


@pytest.fixture
def chat_runner(monkeypatch):
    """Install an AgentRunner with fake AI but real DB access."""
    monkeypatch.setattr(settings, "google_api_key", "test-key")
    state = {"models": None, "checkpointer": InMemorySaver()}

    def configure(scripts: list[list[AIMessage]], *, checkpointer=None) -> ScriptedModels:
        models = ScriptedModels(scripts)
        state["models"] = models
        state["checkpointer"] = checkpointer or InMemorySaver()

        def _dep(db: AsyncSession = Depends(get_db)) -> AgentRunner:
            return AgentRunner(
                db,
                llm_factory=models,
                classifier_factory=lambda _llm: KeywordClassifier(),
                checkpointer=state["checkpointer"],
            )

        application.dependency_overrides[get_agent_runner] = _dep
        return models

    yield configure
    application.dependency_overrides.pop(get_agent_runner, None)


async def _open_conversation(client, register, email: str = "persist@example.com"):
    body = await register(email)
    headers = {"Authorization": f"Bearer {body['access_token']}"}
    response = await client.post(
        "/api/v1/me/conversations", headers=headers, json={"subject": "Where is my order?"}
    )
    assert response.status_code == 201, response.text
    return response.json()["id"], headers, body["user"]["customer_id"]


def _frames(response) -> list[dict]:
    frames = []
    for block in response.text.strip().split("\n\n"):
        data = [line for line in block.splitlines() if line.startswith("data: ")]
        if data:
            frames.append(json.loads(data[0][len("data: ") :]))
    return frames


async def _chat(client, conversation_id: str, headers: dict, message: str, turn_id: str):
    return await client.post(
        f"/api/v1/conversations/{conversation_id}/chat",
        headers=headers,
        json={"message": message, "turn_id": turn_id},
    )


async def _rows(conversation_id: str) -> list[Message]:
    async with async_session_factory() as session:
        result = await session.execute(
            select(Message)
            .where(Message.conversation_id == uuid.UUID(conversation_id))
            .order_by(Message.seq)
        )
        return list(result.scalars().all())


async def _ai_runs(conversation_id: str) -> list[AiRun]:
    async with async_session_factory() as session:
        result = await session.execute(
            select(AiRun).where(AiRun.conversation_id == uuid.UUID(conversation_id))
        )
        return list(result.scalars().all())


async def test_order_turn_persists_messages_card_and_ai_run(
    client, register, make_order, chat_runner
):
    conversation_id, headers, customer_id = await _open_conversation(client, register)
    await make_order(uuid.UUID(customer_id), order_number=ORDER_NUMBER, status="shipped")
    models = chat_runner([_order_script()])
    turn_id = str(uuid.uuid4())

    response = await _chat(
        client, conversation_id, headers, "Where is my order ORD-1024?", turn_id
    )

    assert response.status_code == 200, response.text
    frames = _frames(response)
    types = [frame["type"] for frame in frames]
    assert frames[0] == {"type": "turn_status", "value": "streaming"}
    assert types[-3:] == ["card", "turn_status", "done"]
    assert all(kind == "token" for kind in types[1:-3])
    assert "".join(f["value"] for f in frames if f["type"] == "token") == REPLY
    card = next(f for f in frames if f["type"] == "card")
    assert card["kind"] == "order_status"
    assert card["data"]["orderNumber"] == ORDER_NUMBER
    assert card["data"]["carrier"] == "UPS"

    rows = await _rows(conversation_id)
    assert [(row.role, row.content) for row in rows] == [
        ("user", "Where is my order ORD-1024?"),
        ("assistant", REPLY),
    ]
    assistant = rows[1]
    assert assistant.trace_id == turn_id
    assert assistant.card["orderNumber"] == ORDER_NUMBER
    assert assistant.latency_ms is not None and assistant.latency_ms >= 0

    runs = await _ai_runs(conversation_id)
    assert len(runs) == 1
    assert runs[0].status == "succeeded"
    assert runs[0].trace_id == turn_id
    assert runs[0].message_id == assistant.id
    assert runs[0].tool_calls == [{"name": "get_order_status", "ok": True}]
    assert len(models.models) == 1


async def test_replaying_a_turn_id_does_not_run_the_model_again(
    client, register, make_order, chat_runner
):
    conversation_id, headers, customer_id = await _open_conversation(client, register)
    await make_order(uuid.UUID(customer_id), order_number=ORDER_NUMBER, status="shipped")
    models = chat_runner([_order_script()])
    turn_id = str(uuid.uuid4())

    first = await _chat(client, conversation_id, headers, "Where is my order ORD-1024?", turn_id)
    assert first.status_code == 200, first.text

    second = await _chat(client, conversation_id, headers, "Where is my order ORD-1024?", turn_id)
    assert second.status_code == 200, second.text

    replay = _frames(second)
    assert [frame["type"] for frame in replay] == ["token", "card", "turn_status", "done"]
    assert replay[0]["value"] == REPLY
    assert replay[1]["kind"] == "order_status"

    # One model, one run, two messages: the retry changed nothing.
    assert len(models.models) == 1
    assert len(await _rows(conversation_id)) == 2
    assert len(await _ai_runs(conversation_id)) == 1


async def test_previous_turn_is_loaded_from_the_database(
    client, register, make_order, chat_runner
):
    """A brand-new checkpointer must still see earlier turns (DB is the source)."""
    conversation_id, headers, customer_id = await _open_conversation(client, register)
    await make_order(uuid.UUID(customer_id), order_number=ORDER_NUMBER, status="shipped")

    models = chat_runner([_order_script()], checkpointer=InMemorySaver())
    first = await _chat(client, conversation_id, headers, "Where is my order ORD-1024?", str(uuid.uuid4()))
    assert first.status_code == 200, first.text

    follow_up = "Thanks. Can you remind me what you just told me?"
    models = chat_runner(
        [[AIMessage(content="You asked about ORD-1024; it is in transit.")]],
        checkpointer=InMemorySaver(),
    )
    second = await _chat(client, conversation_id, headers, follow_up, str(uuid.uuid4()))
    assert second.status_code == 200, second.text

    compose_prompt = models.models[-1].calls[-1]
    contents = [message.content for message in compose_prompt]
    assert "Where is my order ORD-1024?" in contents
    assert REPLY in contents
    assert follow_up in contents

    rows = await _rows(conversation_id)
    assert [row.role for row in rows] == ["user", "assistant", "user", "assistant"]


async def test_model_failure_is_reported_and_recorded(
    client, register, chat_runner, monkeypatch
):
    conversation_id, headers, _ = await _open_conversation(client, register)

    def broken_models() -> FakeToolCallingModel:
        raise RuntimeError("provider exploded")

    def _dep(db: AsyncSession = Depends(get_db)) -> AgentRunner:
        return AgentRunner(
            db,
            llm_factory=broken_models,
            classifier_factory=lambda _llm: KeywordClassifier(),
            checkpointer=InMemorySaver(),
        )

    application.dependency_overrides[get_agent_runner] = _dep
    try:
        response = await _chat(client, conversation_id, headers, "Hello", str(uuid.uuid4()))
    finally:
        application.dependency_overrides.pop(get_agent_runner, None)

    assert response.status_code == 200
    frames = _frames(response)
    assert frames[-2]["type"] == "error"
    assert frames[-2]["code"] == "agent_error"
    assert frames[-1]["type"] == "done"

    runs = await _ai_runs(conversation_id)
    assert runs[0].status == "failed"
    assert runs[0].error_code == "agent_error"

    rows = await _rows(conversation_id)
    assert [row.role for row in rows] == ["user"]
