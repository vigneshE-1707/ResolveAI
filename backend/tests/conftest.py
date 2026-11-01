"""Shared test configuration.

The environment is configured *before* any ``app`` module is imported so the
settings singleton and the engine point at the throwaway test database.
"""
from __future__ import annotations

import asyncio
import os
import sys

# psycopg's async driver (Postgres checkpointer) cannot run on the Windows
# ProactorEventLoop; pytest-asyncio honours this policy when creating loops.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

os.environ["APP_ENV"] = "test"
os.environ["DATABASE_URL"] = (
    "postgresql+asyncpg://resolveai:resolveai@localhost:5432/resolveai_test"
)
os.environ["JWT_SECRET_KEY"] = "test-only-secret-key-with-32-plus-characters"
os.environ["DB_ECHO"] = "false"
os.environ["LOG_FORMAT"] = "text"
