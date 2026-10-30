"""User schemas."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserBase(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    email: EmailStr


class UserUpdate(BaseModel):
    full_name: str | None = Field(None, min_length=1, max_length=255)
    phone: str | None = Field(None, max_length=30)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime
    last_login_at: datetime | None = None


class CustomerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    phone: str | None = None
    loyalty_tier: str
    created_at: datetime
    full_name: str | None = None
    email: str | None = None


class AgentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    display_name: str
    team: str
    is_active: bool
    created_at: datetime


class AddressCreate(BaseModel):
    label: str = Field(default="Home", max_length=50)
    line1: str = Field(max_length=255)
    line2: str | None = Field(None, max_length=255)
    city: str = Field(max_length=100)
    region: str | None = Field(None, max_length=100)
    postal_code: str = Field(max_length=20)
    country: str = Field(default="US", max_length=3)
    is_default: bool = False


class AddressOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    label: str
    line1: str
    line2: str | None = None
    city: str
    region: str | None = None
    postal_code: str
    country: str
    is_default: bool


# Admin schemas
class AdminUserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)
    role: str = Field(pattern=r"^(CUSTOMER|SUPPORT_AGENT|ADMIN)$")


class AdminUserUpdate(BaseModel):
    full_name: str | None = Field(None, min_length=1, max_length=255)
    role: str | None = Field(None, pattern=r"^(CUSTOMER|SUPPORT_AGENT|ADMIN)$")
    is_active: bool | None = None


class AdminAgentUpdate(BaseModel):
    team: str | None = Field(None, max_length=100)
    is_active: bool | None = None
