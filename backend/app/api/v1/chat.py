"""Chat endpoint — SSE stream of one agent turn, approvals, and escalations."""
from __future__ import annotations

import uuid
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.llm import is_llm_configured
from app.agents.runner import AgentRunner, ChatFrame, sse_frame
from app.api.v1.dependencies import CurrentUser, get_db, require_role
from app.core.errors import ConflictError, ModelUnavailableError, PermissionDeniedError
from app.schemas.conversation import ApprovalRequest, ChatRequest, EscalateRequest
from app.services.conversation_service import ConversationService

router = APIRouter(tags=["chat"])

_SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
    "Connection": "keep-alive",
}


def get_agent_runner(db: AsyncSession = Depends(get_db)) -> AgentRunner:
    """Overridable in tests so SSE framing can be checked without an LLM."""
    return AgentRunner(db)


def _sse_stream(frames: AsyncIterator[ChatFrame]) -> AsyncIterator[str]:
    """Adapt runner frames to the documented ``event: frame`` SSE framing."""

    async def generate() -> AsyncIterator[str]:
        async for frame in frames:
            yield sse_frame(frame)

    return generate()


@router.post("/conversations/{conversation_id}/chat")
async def chat(
    conversation_id: uuid.UUID,
    body: ChatRequest,
    user: CurrentUser = Depends(require_role("CUSTOMER")),
    db: AsyncSession = Depends(get_db),
    runner: AgentRunner = Depends(get_agent_runner),
):
    if user.customer_id is None:
        raise PermissionDeniedError("Customer profile is missing")

    service = ConversationService(db)
    conversation = await service.get_conversation(conversation_id, customer_id=user.customer_id)

    if conversation.mode != "ai":
        raise ConflictError("A human agent has taken over this conversation")
    if conversation.status in {"resolved", "closed"}:
        raise ConflictError("This conversation is closed")
    if not is_llm_configured():
        raise ModelUnavailableError("AI model is not configured")

    frames = runner.stream_turn(
        conversation=conversation,
        customer_id=user.customer_id,
        content=body.message,
        turn_id=str(body.turn_id),
    )

    return StreamingResponse(
        _sse_stream(frames),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )


@router.post("/conversations/{conversation_id}/approvals")
async def handle_approval(
    conversation_id: uuid.UUID,
    body: ApprovalRequest,
    user: CurrentUser = Depends(require_role("CUSTOMER")),
    db: AsyncSession = Depends(get_db),
    runner: AgentRunner = Depends(get_agent_runner),
):
    """Resume an interrupted agent turn following user approval or rejection."""
    if user.customer_id is None:
        raise PermissionDeniedError("Customer profile is missing")

    service = ConversationService(db)
    conversation = await service.get_conversation(conversation_id, customer_id=user.customer_id)

    if conversation.mode != "ai":
        raise ConflictError("A human agent has taken over this conversation")
    if conversation.status in {"resolved", "closed"}:
        raise ConflictError("This conversation is closed")

    frames = runner.resume_turn(
        conversation=conversation,
        customer_id=user.customer_id,
        turn_id=body.turn_id,
        decision=body.decision,
    )

    return StreamingResponse(
        _sse_stream(frames),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )


@router.post("/conversations/{conversation_id}/escalate")
async def escalate_conversation(
    conversation_id: uuid.UUID,
    body: EscalateRequest,
    user: CurrentUser = Depends(require_role("CUSTOMER")),
    db: AsyncSession = Depends(get_db),
):
    """Explicitly escalate a conversation to human agent queue."""
    if user.customer_id is None:
        raise PermissionDeniedError("Customer profile is missing")

    service = ConversationService(db)
    conversation = await service.get_conversation(conversation_id, customer_id=user.customer_id)

    if conversation.status in {"resolved", "closed"}:
        raise ConflictError("This conversation is closed")

    updated = await service.update_conversation(
        conversation.id,
        mode="human_pending",
        escalation_reason=body.reason,
    )
    await service.add_event(
        conversation.id,
        "escalated",
        actor_id=user.customer_id,
        payload={"reason": body.reason, "priority": body.priority},
    )

    return {
        "ok": True,
        "conversation_id": str(updated.id),
        "mode": updated.mode,
        "escalation_reason": updated.escalation_reason,
    }
