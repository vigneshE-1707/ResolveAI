"""harden constraints, indexes, and ticket numbering

Revision ID: 8f2c1a9d4b10
Revises: 73bb3024ec73
Create Date: 2026-10-30
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "8f2c1a9d4b10"
down_revision: Union[str, None] = "73bb3024ec73"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


CHECKS: list[tuple[str, str, str]] = [
    ("ck_users_role", "users", "role IN ('CUSTOMER','SUPPORT_AGENT','ADMIN')"),
    (
        "ck_orders_status",
        "orders",
        "status IN ('pending','confirmed','processing','shipped','delivered','cancelled','returned')",
    ),
    ("ck_order_items_quantity", "order_items", "quantity > 0"),
    (
        "ck_shipments_status",
        "shipments",
        "status IN ('prepared','in_transit','out_for_delivery','delivered','exception')",
    ),
    (
        "ck_return_requests_status",
        "return_requests",
        "status IN ('requested','approved','rejected','refunded','closed')",
    ),
    (
        "ck_support_tickets_status",
        "support_tickets",
        "status IN ('open','in_progress','pending_customer','resolved','closed')",
    ),
    (
        "ck_support_tickets_priority",
        "support_tickets",
        "priority IN ('low','normal','high','urgent')",
    ),
    (
        "ck_support_tickets_category",
        "support_tickets",
        "category IN ('order_status','delivery_issue','wrong_item','return_request',"
        "'cancellation','refund','billing','product_quality','other')",
    ),
    (
        "ck_conversations_mode",
        "conversations",
        "mode IN ('ai','human_pending','human')",
    ),
    (
        "ck_conversations_status",
        "conversations",
        "status IN ('open','escalated','resolved','closed')",
    ),
    (
        "ck_messages_role",
        "messages",
        "role IN ('user','assistant','agent','system','tool')",
    ),
    (
        "ck_messages_content_type",
        "messages",
        "content_type IN ('text','card','system_note')",
    ),
    (
        "ck_knowledge_documents_status",
        "knowledge_documents",
        "status IN ('processing','ready','failed')",
    ),
    (
        "ck_knowledge_documents_category",
        "knowledge_documents",
        "category IN ('returns','refunds','shipping','cancellation','warranty','faq')",
    ),
    (
        "ck_ai_runs_status",
        "ai_runs",
        "status IN ('succeeded','failed','interrupted','escalated')",
    ),
]


INDEXES: list[tuple[str, str, list]] = [
    ("ix_orders_customer_status", "orders", ["customer_id", "status"]),
    ("ix_support_tickets_status_priority", "support_tickets", ["status", "priority"]),
    ("ix_support_tickets_assigned_status", "support_tickets", ["assigned_agent_id", "status"]),
    ("ix_conversations_mode_status", "conversations", ["mode", "status"]),
    ("ix_conversations_customer_updated", "conversations", ["customer_id", "updated_at"]),
    ("ix_messages_conversation_seq", "messages", ["conversation_id", "seq"]),
    ("ix_ai_runs_status_created", "ai_runs", ["status", "created_at"]),
    ("ix_return_requests_order_status", "return_requests", ["order_id", "status"]),
    ("ix_return_requests_customer_created", "return_requests", ["customer_id", "created_at"]),
]


def upgrade() -> None:
    # Case-insensitive uniqueness: the ORM lowercases on write, but the DB must
    # enforce it too (two concurrent registrations can otherwise differ by case).
    op.create_index("uq_users_email_lower", "users", [sa.text("lower(email)")], unique=True)

    for name, table, condition in CHECKS:
        op.create_check_constraint(name, table, condition)

    for name, table, columns in INDEXES:
        op.create_index(name, table, columns, unique=False)

    # Race-safe human-readable ticket numbers.
    op.execute("CREATE SEQUENCE IF NOT EXISTS support_ticket_number_seq START WITH 1000")


def downgrade() -> None:
    op.execute("DROP SEQUENCE IF EXISTS support_ticket_number_seq")

    for name, table, _columns in reversed(INDEXES):
        op.drop_index(name, table_name=table)

    for name, table, _condition in reversed(CHECKS):
        op.drop_constraint(name, table, type_="check")

    op.drop_index("uq_users_email_lower", table_name="users")
