"""Integration tests for approval resumption and escalation endpoints."""
from __future__ import annotations

import json
import uuid
import pytest
from app.api.v1.chat import get_agent_runner
from app.core.config import settings
from app.main import application


class StubApprovalRunner:
    def __init__(self):
        self.stream_calls = []
        self.resume_calls = []

    async def stream_turn(self, *, conversation, customer_id, content, turn_id):
        self.stream_calls.append({"turn_id": turn_id, "content": content})
        yield {"type": "token", "value": "Order ORD-1024 is eligible for return. Please confirm below."}
        yield {
            "type": "card",
            "kind": "approval_request",
            "data": {
                "kind": "approval_request",
                "action": "create_return",
                "summary": "Return order ORD-1024 (damaged)",
                "approvalId": f"appr-{turn_id}",
            },
        }
        yield {"type": "turn_status", "value": "awaiting_confirmation"}
        yield {"type": "done", "turn_id": turn_id}

    async def resume_turn(self, *, conversation, customer_id, turn_id, decision):
        self.resume_calls.append({"turn_id": turn_id, "decision": decision})
        if decision == "granted":
            yield {"type": "token", "value": "Your return request has been submitted successfully."}
            yield {"type": "turn_status", "value": "complete"}
            yield {"type": "done", "turn_id": turn_id}
        else:
            yield {"type": "token", "value": "Return request was cancelled."}
            yield {"type": "turn_status", "value": "complete"}
            yield {"type": "done", "turn_id": turn_id}


@pytest.fixture
def stub_approval_runner(monkeypatch):
    monkeypatch.setattr(settings, "google_api_key", "test-key")
    runner = StubApprovalRunner()
    application.dependency_overrides[get_agent_runner] = lambda: runner
    yield runner
    application.dependency_overrides.pop(get_agent_runner, None)


async def _open_conversation(client, register, email: str = "workflow@example.com") -> tuple[str, dict]:
    body = await register(email)
    headers = {"Authorization": f"Bearer {body['access_token']}"}
    response = await client.post(
        "/api/v1/me/conversations", headers=headers, json={"subject": "Return assistance"}
    )
    assert response.status_code == 201, response.text
    return response.json()["id"], headers


def _parse_frames(response) -> list[dict]:
    frames = []
    for block in response.text.strip().split("\n\n"):
        lines = [line for line in block.splitlines() if line]
        if len(lines) >= 2 and lines[0] == "event: frame":
            assert lines[1].startswith("data: ")
            frames.append(json.loads(lines[1][len("data: ") :]))
    return frames


@pytest.mark.asyncio
async def test_chat_turn_interrupts_with_approval_request(client, register, stub_approval_runner):
    conv_id, headers = await _open_conversation(client, register, "approval1@example.com")
    turn_id = str(uuid.uuid4())

    response = await client.post(
        f"/api/v1/conversations/{conv_id}/chat",
        headers=headers,
        json={"message": "I want to return order ORD-1024", "turn_id": turn_id},
    )

    assert response.status_code == 200
    frames = _parse_frames(response)
    types = [f["type"] for f in frames]
    assert types == ["token", "card", "turn_status", "done"]
    assert frames[1]["kind"] == "approval_request"
    assert frames[2]["value"] == "awaiting_confirmation"


@pytest.mark.asyncio
async def test_resume_approval_granted_streams_completion(client, register, stub_approval_runner):
    conv_id, headers = await _open_conversation(client, register, "approval2@example.com")
    turn_id = str(uuid.uuid4())

    response = await client.post(
        f"/api/v1/conversations/{conv_id}/approvals",
        headers=headers,
        json={"turn_id": turn_id, "decision": "granted"},
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    frames = _parse_frames(response)
    types = [f["type"] for f in frames]
    assert "complete" in [f.get("value") for f in frames if f["type"] == "turn_status"]
    assert len(stub_approval_runner.resume_calls) == 1
    assert stub_approval_runner.resume_calls[0]["decision"] == "granted"


@pytest.mark.asyncio
async def test_resume_approval_denied_cancels_action(client, register, stub_approval_runner):
    conv_id, headers = await _open_conversation(client, register, "approval3@example.com")
    turn_id = str(uuid.uuid4())

    response = await client.post(
        f"/api/v1/conversations/{conv_id}/approvals",
        headers=headers,
        json={"turn_id": turn_id, "decision": "denied"},
    )

    assert response.status_code == 200
    frames = _parse_frames(response)
    assert any("cancelled" in f.get("value", "") for f in frames if f["type"] == "token")
    assert stub_approval_runner.resume_calls[0]["decision"] == "denied"


@pytest.mark.asyncio
async def test_escalation_endpoint_flips_mode_and_records_event(client, register):
    conv_id, headers = await _open_conversation(client, register, "escalate1@example.com")

    response = await client.post(
        f"/api/v1/conversations/{conv_id}/escalate",
        headers=headers,
        json={"reason": "Customer is frustrated with delivery and requested a human manager.", "priority": "high"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    assert data["mode"] == "human_pending"
    assert "human manager" in data["escalation_reason"]


@pytest.mark.asyncio
async def test_cross_customer_approval_attempt_is_rejected(client, register, stub_approval_runner):
    conv_id, _ = await _open_conversation(client, register, "owner@example.com")
    intruder = await register("intruder@example.com")
    intruder_headers = {"Authorization": f"Bearer {intruder['access_token']}"}

    response = await client.post(
        f"/api/v1/conversations/{conv_id}/approvals",
        headers=intruder_headers,
        json={"turn_id": str(uuid.uuid4()), "decision": "granted"},
    )

    assert response.status_code == 404
    assert stub_approval_runner.resume_calls == []
