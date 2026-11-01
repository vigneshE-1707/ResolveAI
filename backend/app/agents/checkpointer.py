"""Durable LangGraph checkpointer lifecycle.

The saver is opened lazily on the first chat turn so the REST API still boots
when Postgres is briefly unavailable. Tests inject an ``InMemorySaver``.
"""
from __future__ import annotations

import asyncio
import logging
import re

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.checkpoint.memory import InMemorySaver
from sqlalchemy import text
from sqlalchemy.engine import make_url

from app.core.config import settings
from app.db.session import engine

logger = logging.getLogger("resolveai.agent")

_SCHEMA_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,62}$")


def checkpoint_schema() -> str:
    schema = settings.agent_checkpoint_schema
    return schema if _SCHEMA_RE.match(schema) else "langgraph"


def checkpoint_conninfo() -> str:
    """psycopg conninfo derived from the SQLAlchemy URL (no asyncpg driver)."""
    from psycopg.conninfo import make_conninfo

    url = make_url(settings.database_url)
    return make_conninfo(
        host=url.host or "localhost",
        port=url.port or 5432,
        dbname=url.database or "resolveai",
        user=url.username or "",
        password=url.password or "",
        options=f"-c search_path={checkpoint_schema()},public",
    )


class CheckpointerManager:
    def __init__(self) -> None:
        self._saver: BaseCheckpointSaver | None = None
        self._context = None
        self._lock = asyncio.Lock()
        self._memory: InMemorySaver | None = None

    async def get(self) -> BaseCheckpointSaver:
        if settings.agent_checkpointer.lower() == "memory":
            if self._memory is None:
                self._memory = InMemorySaver()
            return self._memory

        if self._saver is not None:
            return self._saver

        async with self._lock:
            if self._saver is not None:
                return self._saver
            await self._ensure_schema()
            # Imported lazily: the package needs psycopg, which only the
            # durable-checkpointer deployment requires.
            from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

            context = AsyncPostgresSaver.from_conn_string(checkpoint_conninfo())
            saver = await context.__aenter__()
            try:
                await saver.setup()
            except Exception:
                await context.__aexit__(None, None, None)
                raise
            self._context = context
            self._saver = saver
            logger.info("LangGraph Postgres checkpointer ready", extra={"event": "checkpointer_ready"})
            return saver

    async def _ensure_schema(self) -> None:
        schema = checkpoint_schema()
        async with engine.begin() as connection:
            await connection.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema}"'))

    async def close(self) -> None:
        if self._context is not None:
            await self._context.__aexit__(None, None, None)
        self._context = None
        self._saver = None


checkpointer_manager = CheckpointerManager()
