"""Conversation, Message, ConversationEvent repositories."""
from __future__ import annotations

import uuid

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import Conversation, Message, ConversationEvent


class ConversationRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, conversation_id: uuid.UUID, *, customer_id: uuid.UUID | None = None) -> Conversation | None:
        stmt = select(Conversation).where(Conversation.id == conversation_id)
        if customer_id:
            stmt = stmt.where(Conversation.customer_id == customer_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_customer(self, customer_id: uuid.UUID, *, offset: int = 0, limit: int = 20) -> tuple[list[Conversation], int]:
        stmt = select(Conversation).where(Conversation.customer_id == customer_id)
        count_stmt = select(func.count()).select_from(Conversation).where(Conversation.customer_id == customer_id)
        total = (await self.session.execute(count_stmt)).scalar() or 0
        stmt = stmt.order_by(Conversation.updated_at.desc()).offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all()), total

    async def list_for_agent(
        self, *, mode: str | None = None, status: str | None = None,
        assigned_agent_id: uuid.UUID | None = None, unassigned: bool = False,
        q: str | None = None, offset: int = 0, limit: int = 20,
    ) -> tuple[list[Conversation], int]:
        stmt = select(Conversation)
        count_stmt = select(func.count()).select_from(Conversation)
        if mode:
            stmt = stmt.where(Conversation.mode == mode)
            count_stmt = count_stmt.where(Conversation.mode == mode)
        if status:
            stmt = stmt.where(Conversation.status == status)
            count_stmt = count_stmt.where(Conversation.status == status)
        if assigned_agent_id:
            stmt = stmt.where(Conversation.assigned_agent_id == assigned_agent_id)
            count_stmt = count_stmt.where(Conversation.assigned_agent_id == assigned_agent_id)
        if unassigned:
            stmt = stmt.where(Conversation.assigned_agent_id.is_(None))
            count_stmt = count_stmt.where(Conversation.assigned_agent_id.is_(None))
        if q:
            pattern = f"%{q}%"
            stmt = stmt.where(Conversation.subject.ilike(pattern))
            count_stmt = count_stmt.where(Conversation.subject.ilike(pattern))
        total = (await self.session.execute(count_stmt)).scalar() or 0
        stmt = stmt.order_by(Conversation.updated_at.desc()).offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all()), total

    async def create(self, conversation: Conversation) -> Conversation:
        self.session.add(conversation)
        await self.session.flush()
        return conversation

    async def update(self, conversation_id: uuid.UUID, **kwargs) -> Conversation | None:
        conv = await self.session.get(Conversation, conversation_id)
        if not conv:
            return None
        for key, value in kwargs.items():
            if hasattr(conv, key) and value is not None:
                setattr(conv, key, value)
        await self.session.flush()
        return conv


class MessageRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_by_conversation(self, conversation_id: uuid.UUID, *, offset: int = 0, limit: int = 50) -> tuple[list[Message], int]:
        stmt = select(Message).where(Message.conversation_id == conversation_id)
        count_stmt = select(func.count()).select_from(Message).where(Message.conversation_id == conversation_id)
        total = (await self.session.execute(count_stmt)).scalar() or 0
        stmt = stmt.order_by(Message.seq.asc()).offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all()), total

    async def get_next_seq(self, conversation_id: uuid.UUID) -> int:
        stmt = select(func.coalesce(func.max(Message.seq), 0)).where(Message.conversation_id == conversation_id)
        result = await self.session.execute(stmt)
        return (result.scalar() or 0) + 1

    async def list_recent(self, conversation_id: uuid.UUID, *, limit: int = 20) -> list[Message]:
        stmt = (
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.seq.desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(reversed(list(result.scalars().all())))

    async def get_by_trace_id(self, conversation_id: uuid.UUID, trace_id: str) -> Message | None:
        stmt = (
            select(Message)
            .where(
                Message.conversation_id == conversation_id,
                Message.trace_id == trace_id,
                Message.role == "assistant",
            )
            .order_by(Message.created_at.desc())
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def create(self, message: Message) -> Message:
        self.session.add(message)
        await self.session.flush()
        return message


class ConversationEventRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, event: ConversationEvent) -> ConversationEvent:
        self.session.add(event)
        await self.session.flush()
        return event

    async def list_by_conversation(self, conversation_id: uuid.UUID, *, limit: int = 50) -> list[ConversationEvent]:
        stmt = select(ConversationEvent).where(
            ConversationEvent.conversation_id == conversation_id
        ).order_by(ConversationEvent.created_at.desc()).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
