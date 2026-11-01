"""Unique assistant reply per conversation turn.

Revision ID: b1d4f7c2a9e5
Revises: 8f2c1a9d4b10
Create Date: 2026-11-01
"""
from __future__ import annotations

from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "b1d4f7c2a9e5"
down_revision: Union[str, None] = "8f2c1a9d4b10"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    op.create_index(
        "uq_messages_conversation_trace",
        "messages",
        ["conversation_id", "trace_id"],
        unique=True,
        postgresql_where=sa.text("trace_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_messages_conversation_trace", table_name="messages")
