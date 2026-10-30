"""Conversation and message schemas."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ConversationCreate(BaseModel):
    subject: str = Field(max_length=255)
    order_number: str | None = None


class ConversationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    customer_id: str
    subject: str
    channel: str
    mode: str
    status: str
    assigned_agent_id: str | None = None
    escalation_reason: str | None = None
    created_at: datetime
    updated_at: datetime
    escalated_at: datetime | None = None
    resolved_at: datetime | None = None
    closed_at: datetime | None = None


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    conversation_id: str
    role: str
    content: str
    content_type: str
    card: dict | None = None
    sources: dict | None = None
    seq: int
    created_at: datetime


class ConversationEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    conversation_id: str
    event_type: str
    actor_id: str | None = None
    payload: dict | None = None
    created_at: datetime
