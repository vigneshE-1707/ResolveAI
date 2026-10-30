"""Order schemas."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


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


class OrderSummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    order_number: str
    status: str
    placed_at: datetime
    total_cents: int
    currency: str
    item_count: int = 0


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
