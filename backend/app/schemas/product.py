"""Product schemas."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ProductCreate(BaseModel):
    sku: str = Field(max_length=50)
    name: str = Field(max_length=255)
    description: str | None = None
    category: str = Field(max_length=100)
    price_cents: int = Field(gt=0)
    currency: str = Field(default="USD", max_length=3)
    image_url: str | None = None


class ProductUpdate(BaseModel):
    name: str | None = Field(None, max_length=255)
    description: str | None = None
    category: str | None = Field(None, max_length=100)
    price_cents: int | None = Field(None, gt=0)
    is_active: bool | None = None
    image_url: str | None = None


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    sku: str
    name: str
    description: str | None = None
    category: str
    price_cents: int
    currency: str
    is_active: bool
    image_url: str | None = None
    created_at: datetime
