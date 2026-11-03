"""Chat endpoint: SSE framing, guards, and identity handling.

These tests override the runner dependency, so no model is called. Persistence
behaviour of the real runner is covered in ``test_chat_persistence.py``.
"""
from __future__ import annotations

import json
import uuid

import pytest

from app.api.v1.chat import get_agent_runner
from app.core.config import settings
from app.main import application


class StubRunner:
    def __init__(self, frames: list[dict] | None = None):
        self.frames = frames or [
            {"type": "token", "value": "Your order is in transit."},
            {"type": "card", "kind": "order_status", "data": {"kind": "order_status"}},
            {"type": "turn_status", "value": "complete"},
            {"type": "done", "turn_id": "stub"},
        ]
        self.calls: list[dict] = []

    async def stream_turn(self, *, conversation, customer_id, content, turn_id):
        self.calls.append(
            {
                "conversation_id": conversation.id,
                "customer_id": customer_id,
                "content": content,
                "turn_id": turn_id,
            }
        )
        for frame in self.frames:
            yield frame


@pytest.fixture
def stub_runner():
    runner = StubRunner()
    application.dependency_overrides[get_agent_runner] = lambda: runner
    yield runner
    application.dependency_overrides.pop(get_agent_runner, None)


@pytest.fixture
def llm_configured(monkeypatch):
    monkeypatch.setattr(settings, "google_api_key", "test-key")


async def _open_conversation(client, register, email: str = "chat@example.com") -> tuple[str, dict]:
    body = await register(email)
    headers = {"Authorization": f"Bearer {body['access_token']}"}
    response = await client.post(
        "/api/v1/me/conversations", headers=headers, json={"subject": "Order help"}
    )
    assert response.status_code == 201, response.text
    return response.json()["id"], headers


def _frames(response) -> list[dict]:
    """Parse the documented SSE framing: ``event: frame`` + one data line."""
    frames: list[dict] = []
    for block in response.text.strip().split("\n\n"):
        lines = [line for line in block.splitlines() if line]
        assert lines[0] == "event: frame", block
        assert lines[1].startswith("data: ")
        frames.append(json.loads(lines[1][len("data: ") :]))
    return frames


async def test_streams_the_documented_frames(client, register, stub_runner, llm_configured):
    conversation_id, headers = await _open_conversation(client, register)
    turn_id = str(uuid.uuid4())

    response = await client.post(
        f"/api/v1/conversations/{conversation_id}/chat",
        headers=headers,
        json={"message": "Where is my order ORD-1024?", "turn_id": turn_id},
    )

    assert response.status_code == 200, response.text
    assert response.headers["content-type"].startswith("text/event-stream")
    assert response.headers["cache-control"] == "no-cache"
    assert response.headers["x-accel-buffering"] == "no"

    frames = _frames(response)
    assert [frame["type"] for frame in frames] == ["token", "card", "turn_status", "done"]
    assert frames[0]["value"] == "Your order is in transit."
    assert frames[1]["kind"] == "order_status"
    assert frames[1]["data"]["kind"] == "order_status"
    assert frames[2]["value"] == "complete"
    assert frames[3]["turn_id"] == "stub"

    # Identity reaches the runner from the JWT, never from the request body.
    assert len(stub_runner.calls) == 1
    assert stub_runner.calls[0]["turn_id"] == turn_id
    assert stub_runner.calls[0]["customer_id"] is not None
    assert stub_runner.calls[0]["content"] == "Where is my order ORD-1024?"


async def test_another_customers_conversation_is_not_found(
    client, register, stub_runner, llm_configured
):
    conversation_id, _ = await _open_conversation(client, register, "chat-owner@example.com")
    intruder = await register("chat-intruder@example.com")

    response = await client.post(
        f"/api/v1/conversations/{conversation_id}/chat",
        headers={"Authorization": f"Bearer {intruder['access_token']}"},
        json={"message": "Show me their orders", "turn_id": str(uuid.uuid4())},
    )

    assert response.status_code == 404
    assert response.json()["code"] == "not_found"
    assert stub_runner.calls == []


async def test_human_takeover_blocks_the_ai(
    client, register, make_user, login, stub_runner, llm_configured
):
    conversation_id, headers = await _open_conversation(client, register)
    await make_user("SUPPORT_AGENT", "chat-agent@example.com", "Agent Smith")
    agent_token = await login("chat-agent@example.com")
    takeover = await client.post(
        f"/api/v1/agent/conversations/{conversation_id}/takeover",
        headers={"Authorization": f"Bearer {agent_token}"},
    )
    assert takeover.status_code == 200, takeover.text

    response = await client.post(
        f"/api/v1/conversations/{conversation_id}/chat",
        headers=headers,
        json={"message": "Hello?", "turn_id": str(uuid.uuid4())},
    )

    assert response.status_code == 409
    assert response.json()["code"] == "conflict"
    assert stub_runner.calls == []


async def test_closed_conversation_is_rejected(
    client, register, make_user, login, stub_runner, llm_configured
):
    conversation_id, headers = await _open_conversation(client, register)
    await make_user("SUPPORT_AGENT", "chat-resolver@example.com", "Agent Smith")
    agent_token = await login("chat-resolver@example.com")
    resolved = await client.post(
        f"/api/v1/agent/conversations/{conversation_id}/resolve",
        headers={"Authorization": f"Bearer {agent_token}"},
        json={"resolution_note": "Done"},
    )
    assert resolved.status_code == 200, resolved.text

    response = await client.post(
        f"/api/v1/conversations/{conversation_id}/chat",
        headers=headers,
        json={"message": "One more thing", "turn_id": str(uuid.uuid4())},
    )

    assert response.status_code == 409
    assert response.json()["code"] == "conflict"


async def test_unconfigured_model_returns_503(client, register, stub_runner, monkeypatch):
    monkeypatch.setattr(settings, "google_api_key", "")
    conversation_id, headers = await _open_conversation(client, register)

    response = await client.post(
        f"/api/v1/conversations/{conversation_id}/chat",
        headers=headers,
        json={"message": "Hello", "turn_id": str(uuid.uuid4())},
    )

    assert response.status_code == 503
    assert response.json()["code"] == "model_unavailable"
    assert stub_runner.calls == []


async def test_agent_role_cannot_use_the_customer_chat_endpoint(
    client, register, make_user, login, stub_runner, llm_configured
):
    conversation_id, _ = await _open_conversation(client, register)
    await make_user("SUPPORT_AGENT", "chat-agent2@example.com", "Agent Smith")
    token = await login("chat-agent2@example.com")

    response = await client.post(
        f"/api/v1/conversations/{conversation_id}/chat",
        headers={"Authorization": f"Bearer {token}"},
        json={"message": "Hello", "turn_id": str(uuid.uuid4())},
    )

    assert response.status_code == 403


async def test_turn_id_is_required(client, register, stub_runner, llm_configured):
    conversation_id, headers = await _open_conversation(client, register)

    response = await client.post(
        f"/api/v1/conversations/{conversation_id}/chat",
        headers=headers,
        json={"message": "Hello"},
    )

    assert response.status_code == 422
    assert stub_runner.calls == []
