"""Order schemas."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class OrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    sku: str | None = None
    name_snapshot: str
    quantity: int
    unit_price_cents: int


class ShipmentEventOut(BaseModel):
    at: str
    label: str
    location: str | None = None
    completed: bool


class ShipmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    carrier: str
    tracking_number: str
    status: str
    shipped_at: datetime | None = None
    estimated_delivery_at: datetime | None = None
    delivered_at: datetime | None = None
    last_event_desc: str | None = None
    last_event_at: datetime | None = None


class ShipmentSummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    carrier: str
    tracking_number: str
    status: str
    estimated_delivery_at: datetime | None = None
    last_event_desc: str | None = None


class OrderSummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    order_number: str
    status: str
    placed_at: datetime
    total_cents: int
    currency: str
    item_count: int = 0
    line_count: int = 0
    first_item_name: str | None = None
    customer_name: str | None = None
    shipment: ShipmentSummaryOut | None = None


class OrderDetailOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    order_number: str
    customer_id: str
    status: str
    placed_at: datetime
    subtotal_cents: int
    shipping_cents: int
    tax_cents: int
    total_cents: int
    currency: str
    items: list[OrderItemOut] = []
    shipment: ShipmentOut | None = None
    return_eligible: bool = False
    return_window_end: str | None = None
    cancelled_at: datetime | None = None
    cancel_reason: str | None = None


class OrderStatusUpdate(BaseModel):
    status: str = Field(
        pattern=r"^(pending|confirmed|processing|shipped|delivered|cancelled|returned)$"
    )
    reason: str | None = Field(default=None, max_length=2000)


class ReturnCreate(BaseModel):
    order_number: str = Field(min_length=1, max_length=30)
    reason_code: str = Field(
        pattern=r"^(wrong_item|damaged|not_as_described|changed_mind|late_delivery|other)$"
    )
    reason_text: str | None = Field(default=None, max_length=2000)


class ReturnOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    order_id: str
    customer_id: str
    reason_code: str
    reason_text: str | None = None
    status: str
    requested_at: datetime
    decided_at: datetime | None = None
    refund_amount_cents: int | None = None


class ReturnEligibilityOut(BaseModel):
    eligible: bool
    reason: str
    order_number: str
    order_status: str
    return_window_end: str | None = None
