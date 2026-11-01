"""Transcript access: customers read their own thread, agents/admins read any."""
from __future__ import annotations


async def _open_conversation(client, register, email: str, subject: str) -> tuple[str, str]:
    body = await register(email)
    auth = {"Authorization": f"Bearer {body['access_token']}"}
    created = await client.post(
        "/api/v1/me/conversations", headers=auth, json={"subject": subject}
    )
    assert created.status_code == 201, created.text
    return created.json()["id"], body["access_token"]


async def test_agent_can_read_a_customer_transcript(
    client, register, make_user, login
):
    conversation_id, customer_token = await _open_conversation(
        client, register, "transcript-owner@example.com", "Where is my order?"
    )
    customer_auth = {"Authorization": f"Bearer {customer_token}"}

    await make_user("SUPPORT_AGENT", "transcript-agent@example.com", "Agent Smith")
    agent_token = await login("transcript-agent@example.com")
    agent_auth = {"Authorization": f"Bearer {agent_token}"}

    replied = await client.post(
        f"/api/v1/agent/conversations/{conversation_id}/replies",
        headers=agent_auth,
        json={"content": "Checking that for you now."},
    )
    assert replied.status_code == 201, replied.text

    as_agent = await client.get(
        f"/api/v1/conversations/{conversation_id}/messages", headers=agent_auth
    )
    assert as_agent.status_code == 200, as_agent.text
    assert as_agent.json()["meta"]["total"] == 1
    assert as_agent.json()["data"][0]["role"] == "agent"

    # The owner still sees the same transcript.
    as_owner = await client.get(
        f"/api/v1/conversations/{conversation_id}/messages", headers=customer_auth
    )
    assert as_owner.status_code == 200, as_owner.text
    assert as_owner.json()["meta"]["total"] == 1


async def test_another_customer_cannot_read_the_transcript(client, register):
    conversation_id, _ = await _open_conversation(
        client, register, "private-owner@example.com", "Private thread"
    )
    intruder = await register("private-intruder@example.com")

    response = await client.get(
        f"/api/v1/conversations/{conversation_id}/messages",
        headers={"Authorization": f"Bearer {intruder['access_token']}"},
    )

    assert response.status_code == 404
    assert response.json()["code"] == "not_found"
