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
if "TEST_DATABASE_URL" in os.environ:
    os.environ["DATABASE_URL"] = os.environ["TEST_DATABASE_URL"]
else:
    from dotenv import dotenv_values
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    env_vals = dotenv_values(env_path) if os.path.exists(env_path) else {}
    configured_db = env_vals.get("DATABASE_URL")
    if configured_db:
        base_prefix = configured_db.rsplit("/", 1)[0]
        os.environ["DATABASE_URL"] = f"{base_prefix}/resolveai_test"
    else:
        os.environ["DATABASE_URL"] = (
            "postgresql+asyncpg://resolveai:resolveai@localhost:5432/resolveai_test"
        )

os.environ["JWT_SECRET_KEY"] = "test-only-secret-key-with-32-plus-characters"
os.environ["DB_ECHO"] = "false"
os.environ["LOG_FORMAT"] = "text"
