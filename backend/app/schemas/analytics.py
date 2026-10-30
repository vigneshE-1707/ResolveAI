"""Analytics and monitoring schemas."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class OverviewStats(BaseModel):
    total_conversations: int = 0
    active_conversations: int = 0
    ai_handled: int = 0
    escalated: int = 0
    open_tickets: int = 0
    resolved_today: int = 0
    avg_first_response_ms: float | None = None
    avg_resolution_ms: float | None = None


class AgentStats(BaseModel):
    open_conversations: int = 0
    pending_conversations: int = 0
    my_active: int = 0
    resolved_today: int = 0
    escalated_today: int = 0


class AiRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    conversation_id: str
    trace_id: str | None = None
    model_name: str
    status: str
    latency_ms: int
    prompt_tokens: int
    completion_tokens: int
    tool_calls: dict | None = None
    created_at: datetime


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    actor_user_id: str | None = None
    actor_role: str
    action: str
    entity_type: str
    entity_id: str | None = None
    conversation_id: str | None = None
    request_id: str | None = None
    meta: dict | None = None
    created_at: datetime
