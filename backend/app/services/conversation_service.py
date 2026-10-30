"""Conversation service."""
from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.models.conversation import Conversation, Message, ConversationEvent
from app.repositories.conversation_repo import ConversationRepository, MessageRepository, ConversationEventRepository


class ConversationService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.conv_repo = ConversationRepository(session)
        self.msg_repo = MessageRepository(session)
        self.event_repo = ConversationEventRepository(session)

    async def create_conversation(self, customer_id: uuid.UUID, subject: str) -> Conversation:
        conv = Conversation(customer_id=customer_id, subject=subject)
        await self.conv_repo.create(conv)
        event = ConversationEvent(conversation_id=conv.id, event_type="created")
        await self.event_repo.create(event)
        await self.session.commit()
        return conv

    async def get_conversation(self, conversation_id: uuid.UUID, *, customer_id: uuid.UUID | None = None) -> Conversation:
        conv = await self.conv_repo.get_by_id(conversation_id, customer_id=customer_id)
        if not conv:
            raise NotFoundError("Conversation")
        return conv

    async def list_customer_conversations(self, customer_id: uuid.UUID, *, page: int = 1, page_size: int = 20):
        offset = (page - 1) * page_size
        return await self.conv_repo.list_by_customer(customer_id, offset=offset, limit=page_size)

    async def list_agent_conversations(self, *, mode: str | None = None, status: str | None = None, assigned_agent_id: uuid.UUID | None = None, unassigned: bool = False, q: str | None = None, page: int = 1, page_size: int = 20):
        offset = (page - 1) * page_size
        return await self.conv_repo.list_for_agent(mode=mode, status=status, assigned_agent_id=assigned_agent_id, unassigned=unassigned, q=q, offset=offset, limit=page_size)

    async def add_message(self, conversation_id: uuid.UUID, role: str, content: str, *, content_type: str = "text", card: dict | None = None) -> Message:
        seq = await self.msg_repo.get_next_seq(conversation_id)
        msg = Message(conversation_id=conversation_id, role=role, content=content, content_type=content_type, card=card, seq=seq)
        await self.msg_repo.create(msg)
        await self.session.commit()
        return msg

    async def get_messages(self, conversation_id: uuid.UUID, *, page: int = 1, page_size: int = 50):
        offset = (page - 1) * page_size
        return await self.msg_repo.list_by_conversation(conversation_id, offset=offset, limit=page_size)

    async def update_conversation(self, conversation_id: uuid.UUID, **kwargs) -> Conversation:
        conv = await self.conv_repo.update(conversation_id, **kwargs)
        if not conv:
            raise NotFoundError("Conversation")
        await self.session.commit()
        return conv

    async def add_event(self, conversation_id: uuid.UUID, event_type: str, *, actor_id: uuid.UUID | None = None, payload: dict | None = None) -> ConversationEvent:
        event = ConversationEvent(conversation_id=conversation_id, event_type=event_type, actor_id=actor_id, payload=payload)
        await self.event_repo.create(event)
        await self.session.commit()
        return event
