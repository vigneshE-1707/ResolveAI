"""Chat endpoint — SSE stream of one agent turn."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.llm import is_llm_configured
from app.agents.runner import AgentRunner, sse_frame
from app.api.v1.dependencies import CurrentUser, get_db, require_role
from app.core.errors import ConflictError, ModelUnavailableError, PermissionDeniedError
from app.schemas.conversation import ChatRequest
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


@router.post("/conversations/{conversation_id}/chat")
async def chat(
    conversation_id: uuid.UUID,
    body: ChatRequest,
    user: CurrentUser = Depends(require_role("CUSTOMER")),
    db: AsyncSession = Depends(get_db),
    runner: AgentRunner = Depends(get_agent_runner),
):
    service = ConversationService(db)
    conversation = await service.get_conversation(conversation_id, customer_id=user.customer_id)
    if user.customer_id is None:
        raise PermissionDeniedError("Customer profile is missing")

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
        (sse_frame(frame) for frame in frames),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )
