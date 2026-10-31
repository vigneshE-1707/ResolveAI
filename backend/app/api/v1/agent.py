"""Agent workspace endpoints."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import CurrentUser, get_db, require_role
from app.core.errors import ValidationError
from app.schemas.conversation import AgentReplyCreate, AssignRequest, ResolveRequest
from app.schemas.ticket import TicketUpdate
from app.services.admin_service import AdminService
from app.services.audit_service import AuditService
from app.services.conversation_service import ConversationService
from app.services.ticket_service import TicketService

router = APIRouter(prefix="/agent", tags=["agent"])


@router.get("/stats")
async def agent_stats(
    user: CurrentUser = Depends(require_role("SUPPORT_AGENT", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    svc = AdminService(db)
    return await svc.get_agent_stats(user.agent_id)


@router.get("/conversations")
async def list_conversations(
    mode: str | None = None,
    status: str | None = None,
    assigned: str | None = None,
    unassigned: bool = False,
    q: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: CurrentUser = Depends(require_role("SUPPORT_AGENT", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    svc = ConversationService(db)
    try:
        assigned_id = uuid.UUID(assigned) if assigned else None
    except ValueError:
        raise ValidationError("Invalid agent id")

    convs, total = await svc.list_agent_conversations(
        mode=mode,
        status=status,
        assigned_agent_id=assigned_id,
        unassigned=unassigned,
        q=q,
        page=page,
        page_size=page_size,
    )
    from app.api.v1.customers import _conv_out

    return {
        "data": [_conv_out(c) for c in convs],
        "meta": {"page": page, "page_size": page_size, "total": total},
    }


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
    body: AgentReplyCreate,
    user: CurrentUser = Depends(require_role("SUPPORT_AGENT", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    svc = ConversationService(db)
    conv = await svc.get_conversation(conversation_id)
    msg = await svc.add_message(conversation_id, "agent", body.content)
    await svc.add_event(conversation_id, "agent_reply", actor_id=user.user_id)
    await AuditService(db).record(
        actor_user_id=user.user_id,
        actor_role=user.role,
        action="conversation.agent_reply",
        entity_type="conversation",
        entity_id=conv.id,
        conversation_id=conv.id,
    )
    await db.commit()
    from app.api.v1.customers import _msg_out

    return _msg_out(msg)


@router.post("/conversations/{conversation_id}/assign")
async def assign_conversation(
    conversation_id: uuid.UUID,
    body: AssignRequest | None = None,
    user: CurrentUser = Depends(require_role("SUPPORT_AGENT", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    svc = ConversationService(db)
    agent_id: uuid.UUID | None = None
    if body and body.agent_id:
        try:
            agent_id = uuid.UUID(body.agent_id)
        except ValueError:
            raise ValidationError("Invalid agent id")

    conv = await svc.update_conversation(conversation_id, assigned_agent_id=agent_id)
    await svc.add_event(
        conversation_id,
        "assigned",
        actor_id=user.user_id,
        payload={"agent_id": str(agent_id) if agent_id else None},
    )
    await AuditService(db).record(
        actor_user_id=user.user_id,
        actor_role=user.role,
        action="conversation.assigned",
        entity_type="conversation",
        entity_id=conv.id,
        conversation_id=conv.id,
        meta={"agent_id": str(agent_id) if agent_id else None},
    )
    await db.commit()
    return {"message": "Conversation assigned"}


@router.post("/conversations/{conversation_id}/takeover")
async def takeover_conversation(
    conversation_id: uuid.UUID,
    user: CurrentUser = Depends(require_role("SUPPORT_AGENT", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    svc = ConversationService(db)
    conv = await svc.update_conversation(
        conversation_id, mode="human", assigned_agent_id=user.agent_id
    )
    await svc.add_event(conversation_id, "ai_paused", actor_id=user.user_id)
    await AuditService(db).record(
        actor_user_id=user.user_id,
        actor_role=user.role,
        action="conversation.takeover",
        entity_type="conversation",
        entity_id=conv.id,
        conversation_id=conv.id,
    )
    await db.commit()
    return {"message": "AI paused, conversation taken over"}


@router.post("/conversations/{conversation_id}/resolve")
async def resolve_conversation(
    conversation_id: uuid.UUID,
    body: ResolveRequest | None = None,
    user: CurrentUser = Depends(require_role("SUPPORT_AGENT", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    svc = ConversationService(db)
    conv = await svc.update_conversation(
        conversation_id, status="resolved", resolved_at=datetime.now(timezone.utc)
    )
    note = body.resolution_note if body else None
    await svc.add_event(
        conversation_id, "resolved", actor_id=user.user_id, payload={"note": note}
    )
    await AuditService(db).record(
        actor_user_id=user.user_id,
        actor_role=user.role,
        action="conversation.resolved",
        entity_type="conversation",
        entity_id=conv.id,
        conversation_id=conv.id,
        meta={"resolution_note": note},
    )
    await db.commit()
    return {"message": "Conversation resolved"}


@router.post("/conversations/{conversation_id}/reopen")
async def reopen_conversation(
    conversation_id: uuid.UUID,
    user: CurrentUser = Depends(require_role("SUPPORT_AGENT", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    svc = ConversationService(db)
    conv = await svc.update_conversation(conversation_id, mode="ai", status="open")
    await svc.add_event(conversation_id, "ai_resumed", actor_id=user.user_id)
    await AuditService(db).record(
        actor_user_id=user.user_id,
        actor_role=user.role,
        action="conversation.reopen",
        entity_type="conversation",
        entity_id=conv.id,
        conversation_id=conv.id,
    )
    await db.commit()
    return {"message": "AI re-enabled"}


@router.get("/tickets")
async def list_agent_tickets(
    status: str | None = None,
    priority: str | None = None,
    q: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: CurrentUser = Depends(require_role("SUPPORT_AGENT", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    svc = TicketService(db)
    tickets, total = await svc.list_all_tickets(
        status=status, priority=priority, q=q, page=page, page_size=page_size
    )
    from app.api.v1.customers import _ticket_out

    return {
        "data": [_ticket_out(t) for t in tickets],
        "meta": {"page": page, "page_size": page_size, "total": total},
    }


@router.patch("/tickets/{ticket_number}")
async def update_ticket(
    ticket_number: str,
    body: TicketUpdate,
    user: CurrentUser = Depends(require_role("SUPPORT_AGENT", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    svc = TicketService(db)
    updates = body.model_dump(exclude_unset=True)

    # The API accepts an id string; the ORM expects a UUID. Only allow real agents.
    if "assigned_agent_id" in updates:
        raw_agent_id = updates["assigned_agent_id"]
        if raw_agent_id:
            try:
                updates["assigned_agent_id"] = uuid.UUID(raw_agent_id)
            except ValueError:
                raise ValidationError("Invalid agent id")
        else:
            updates["assigned_agent_id"] = None

    ticket = await svc.update_ticket(ticket_number, **updates)
    await AuditService(db).record(
        actor_user_id=user.user_id,
        actor_role=user.role,
        action="ticket.updated",
        entity_type="support_ticket",
        entity_id=ticket.id,
        meta={"fields": sorted(updates.keys())},
    )
    await db.commit()
    from app.api.v1.customers import _ticket_out

    return _ticket_out(ticket)
