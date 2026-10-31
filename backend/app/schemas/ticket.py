"""Ticket schemas."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TicketCreate(BaseModel):
    subject: str = Field(max_length=255)
    category: str = Field(pattern=r"^(order_status|delivery_issue|wrong_item|return_request|cancellation|refund|billing|product_quality|other)$")
    description: str | None = None
    order_number: str | None = None


class TicketUpdate(BaseModel):
    status: str | None = Field(None, pattern=r"^(open|in_progress|pending_customer|resolved|closed)$")
    priority: str | None = Field(None, pattern=r"^(low|normal|high|urgent)$")
    assigned_agent_id: str | None = None
    resolution_note: str | None = None


class TicketOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    ticket_number: str
    customer_id: str
    order_id: str | None = None
    order_number: str | None = None
    subject: str
    category: str
    description: str | None = None
    status: str
    priority: str
    assigned_agent_id: str | None = None
    escalation_reason: str | None = None
    created_at: datetime
    updated_at: datetime
    first_response_at: datetime | None = None
    resolved_at: datetime | None = None
    resolution_note: str | None = None
