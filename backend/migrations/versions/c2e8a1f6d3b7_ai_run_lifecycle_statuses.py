"""Allow in-flight and timed-out AI runs.

The M3 constraint only listed terminal statuses, but the agent runner inserts
the row before the turn starts (status ``running``) and records ``timeout``
separately from generic failures.

Revision ID: c2e8a1f6d3b7
Revises: b1d4f7c2a9e5
Create Date: 2026-11-02
"""
from __future__ import annotations

from typing import Union

from alembic import op

revision: str = "c2e8a1f6d3b7"
down_revision: Union[str, None] = "b1d4f7c2a9e5"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None

_NEW_STATUSES = "status IN ('running','succeeded','failed','interrupted','escalated','timeout')"
_OLD_STATUSES = "status IN ('succeeded','failed','interrupted','escalated')"


def upgrade() -> None:
    op.drop_constraint("ck_ai_runs_status", "ai_runs", type_="check")
    op.create_check_constraint("ck_ai_runs_status", "ai_runs", _NEW_STATUSES)


def downgrade() -> None:
    # Terminal statuses from the new vocabulary are folded back into the old one.
    op.execute("UPDATE ai_runs SET status = 'succeeded' WHERE status = 'running'")
    op.execute("UPDATE ai_runs SET status = 'failed' WHERE status = 'timeout'")
    op.drop_constraint("ck_ai_runs_status", "ai_runs", type_="check")
    op.create_check_constraint("ck_ai_runs_status", "ai_runs", _OLD_STATUSES)
