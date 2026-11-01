"""Event-loop helpers.

``psycopg`` (used by LangGraph's Postgres checkpointer) cannot run on the
Windows ``ProactorEventLoop``. Uvicorn selects that loop by default on win32,
so the dev entrypoint passes ``selector_loop_factory`` explicitly. On other
platforms it is simply the standard selector loop.
"""
from __future__ import annotations

import asyncio
import selectors


def selector_loop_factory(use_subprocess: bool = False) -> asyncio.AbstractEventLoop:
    """Uvicorn-compatible loop factory (it passes ``use_subprocess``)."""
    del use_subprocess
    return asyncio.SelectorEventLoop(selectors.SelectSelector())
