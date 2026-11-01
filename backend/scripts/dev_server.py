"""Development server entrypoint.

Uvicorn defaults to the Windows ProactorEventLoop, which psycopg's async
driver (used by the LangGraph Postgres checkpointer) cannot use. Passing an
explicit selector loop factory keeps `python scripts/dev_server.py` working on
Windows and Linux alike.

Usage (from backend/):
    .\\.venv\\Scripts\\python.exe scripts\\dev_server.py
    .\\.venv\\Scripts\\python.exe scripts\\dev_server.py --reload
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import uvicorn

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the ResolveAI API in development.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--reload", action="store_true")
    args = parser.parse_args()

    uvicorn.run(
        "app.main:application",
        host=args.host,
        port=args.port,
        reload=args.reload,
        loop="app.core.loop:selector_loop_factory",
    )


if __name__ == "__main__":
    main()
