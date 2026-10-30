"""Agent workspace endpoints."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import CurrentUser, get_db, require_role
from app.services.conversation_service import ConversationService
from app.services.ticket_service import TicketService
from app.services.admin_service import AdminService

router = APIRouter(prefix="/agent", tags=["agent"])


@router.get("/stats")
async def agent_stats(
    user: CurrentUser = Depends(require_role("SUPPORT_AGENT", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    svc = AdminService(db)
    return await svc.get_agent_stats(user.agent_id or user.user_id)


@router.get("/conversations")
async def list_conversations(
    mode: str | None = None, status: str | None = None,
    assigned: str | None = None, unassigned: bool = False,
    q: str | None = None, page: int = 1, page_size: int = 20,
    user: CurrentUser = Depends(require_role("SUPPORT_AGENT", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    svc = ConversationService(db)
    assigned_id = uuid.UUID(assigned) if assigned else None
    convs, total = await svc.list_agent_conversations(
        mode=mode, status=status, assigned_agent_id=assigned_id,
        unassigned=unassigned, q=q, page=page, page_size=page_size,
    )
    from app.api.v1.customers import _conv_out
    return {"data": [_conv_out(c) for c in convs], "meta": {"page": page, "page_size": page_size, "total": total}}


@router.get("/conversations/{conversation_id}")
async def get_conversation(
    conversation_id: uuid.UUID,
    user: CurrentUser = Depends(require_role("SUPPORT_AGENT", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    svc = ConversationService(db)
    conv = await svc.get_conversation(conversation_id)
    from app.api.v1.customers import _conv_out
    return _conv_out(conv)


@router.post("/conversations/{conversation_id}/replies", status_code=201)
async def agent_reply(
    conversation_id: uuid.UUID,
    body: dict,
    user: CurrentUser = Depends(require_role("SUPPORT_AGENT", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    svc = ConversationService(db)
    msg = await svc.add_message(conversation_id, "agent", body.get("content", ""))
    await svc.add_event(conversation_id, "agent_reply", actor_id=user.user_id)
    from app.api.v1.customers import _msg_out
    return _msg_out(msg)


@router.post("/conversations/{conversation_id}/assign")
async def assign_conversation(
    conversation_id: uuid.UUID,
    body: dict = {},
    user: CurrentUser = Depends(require_role("SUPPORT_AGENT", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    svc = ConversationService(db)
    agent_id = uuid.UUID(body["agent_id"]) if body.get("agent_id") else None
    await svc.update_conversation(conversation_id, assigned_agent_id=agent_id)
    await svc.add_event(conversation_id, "assigned", actor_id=user.user_id, payload={"agent_id": str(agent_id) if agent_id else None})
    return {"message": "Conversation assigned"}


@router.post("/conversations/{conversation_id}/takeover")
async def takeover_conversation(
    conversation_id: uuid.UUID,
    user: CurrentUser = Depends(require_role("SUPPORT_AGENT", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    svc = ConversationService(db)
    await svc.update_conversation(conversation_id, mode="human", assigned_agent_id=user.agent_id or user.user_id)
    await svc.add_event(conversation_id, "ai_paused", actor_id=user.user_id)
    return {"message": "AI paused, conversation taken over"}


@router.post("/conversations/{conversation_id}/resolve")
async def resolve_conversation(
    conversation_id: uuid.UUID,
    body: dict = {},
    user: CurrentUser = Depends(require_role("SUPPORT_AGENT", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    svc = ConversationService(db)
    await svc.update_conversation(conversation_id, status="resolved", resolved_at=datetime.now(timezone.utc))
    await svc.add_event(conversation_id, "resolved", actor_id=user.user_id, payload={"note": body.get("resolution_note")})
    return {"message": "Conversation resolved"}


@router.post("/conversations/{conversation_id}/reopen")
async def reopen_conversation(
    conversation_id: uuid.UUID,
    user: CurrentUser = Depends(require_role("SUPPORT_AGENT", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    svc = ConversationService(db)
    await svc.update_conversation(conversation_id, mode="ai", status="open")
    await svc.add_event(conversation_id, "ai_resumed", actor_id=user.user_id)
    return {"message": "AI re-enabled"}


@router.get("/tickets")
async def list_agent_tickets(
    status: str | None = None, priority: str | None = None,
    q: str | None = None, page: int = 1, page_size: int = 20,
    user: CurrentUser = Depends(require_role("SUPPORT_AGENT", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    svc = TicketService(db)
    tickets, total = await svc.list_all_tickets(status=status, priority=priority, q=q, page=page, page_size=page_size)
    from app.api.v1.customers import _ticket_out
    return {"data": [_ticket_out(t) for t in tickets], "meta": {"page": page, "page_size": page_size, "total": total}}


@router.patch("/tickets/{ticket_number}")
async def update_ticket(
    ticket_number: str,
    body: dict,
    user: CurrentUser = Depends(require_role("SUPPORT_AGENT", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    svc = TicketService(db)
    ticket = await svc.update_ticket(ticket_number, **body)
    from app.api.v1.customers import _ticket_out
    return _ticket_out(ticket)
