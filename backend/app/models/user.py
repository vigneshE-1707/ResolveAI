"""User, Customer, SupportAgent, CustomerAddress models."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDMixin, TimestampMixin


class User(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    session_version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")

    customer: Mapped[Customer | None] = relationship("Customer", back_populates="user", uselist=False)
    support_agent: Mapped[SupportAgent | None] = relationship("SupportAgent", back_populates="user", uselist=False)


class Customer(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "customers"

    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), unique=True, nullable=False,
    )
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    loyalty_tier: Mapped[str] = mapped_column(String(20), default="standard", server_default="'standard'")

    user: Mapped[User] = relationship("User", back_populates="customer")
    addresses: Mapped[list[CustomerAddress]] = relationship("CustomerAddress", back_populates="customer")
    orders: Mapped[list] = relationship("Order", back_populates="customer")
    tickets: Mapped[list] = relationship("SupportTicket", back_populates="customer")
    conversations: Mapped[list] = relationship("Conversation", back_populates="customer")


class SupportAgent(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "support_agents"

    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), unique=True, nullable=False,
    )
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    team: Mapped[str] = mapped_column(String(100), default="general", server_default="'general'")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")

    user: Mapped[User] = relationship("User", back_populates="support_agent")


class CustomerAddress(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "customer_addresses"

    customer_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False,
    )
    label: Mapped[str] = mapped_column(String(50), default="Home")
    line1: Mapped[str] = mapped_column(String(255), nullable=False)
    line2: Mapped[str | None] = mapped_column(String(255), nullable=True)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    region: Mapped[str | None] = mapped_column(String(100), nullable=True)
    postal_code: Mapped[str] = mapped_column(String(20), nullable=False)
    country: Mapped[str] = mapped_column(String(3), default="US")
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    customer: Mapped[Customer] = relationship("Customer", back_populates="addresses")
