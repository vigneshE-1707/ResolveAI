"""Add embedding vector column to knowledge_chunks for M6 Knowledge Retrieval.

Revision ID: d3f8a2e1b4c9
Revises: c2e8a1f6d3b7
Create Date: 2026-11-04
"""
from __future__ import annotations

from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "d3f8a2e1b4c9"
down_revision: Union[str, None] = "c2e8a1f6d3b7"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def _supports_pgvector(conn) -> bool:
    try:
        res = conn.execute(
            sa.text("SELECT 1 FROM pg_available_extensions WHERE name = 'vector'")
        ).scalar()
        if res:
            conn.execute(sa.text("CREATE EXTENSION IF NOT EXISTS vector;"))
            return True
        return False
    except Exception:
        return False


def upgrade() -> None:
    conn = op.get_bind()
    if _supports_pgvector(conn):
        try:
            from pgvector.sqlalchemy import Vector
            op.add_column("knowledge_chunks", sa.Column("embedding", Vector(768), nullable=True))
            op.create_index(
                "ix_knowledge_chunks_embedding",
                "knowledge_chunks",
                ["embedding"],
                postgresql_using="hnsw",
                postgresql_ops={"embedding": "vector_cosine_ops"},
            )
            return
        except Exception:
            pass

    # Native vector extension unavailable (e.g. Windows native Postgres without Docker).
    # Use JSONB column; similarity is calculated in-database or via high-performance numpy.
    op.add_column("knowledge_chunks", sa.Column("embedding", postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.execute(sa.text("DROP INDEX IF EXISTS ix_knowledge_chunks_embedding;"))
    op.drop_column("knowledge_chunks", "embedding")
