"""Print the tables present in the configured database.

Usage (from ``backend/``)::

    .venv/Scripts/python.exe scripts/check_tables.py

Reads ``DATABASE_URL`` through the application settings — never hardcode
credentials here.
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text  # noqa: E402

from app.db.session import engine  # noqa: E402


async def main() -> None:
    try:
        async with engine.connect() as connection:
            result = await connection.execute(
                text(
                    "SELECT tablename FROM pg_tables "
                    "WHERE schemaname = 'public' ORDER BY tablename"
                )
            )
            tables = [row[0] for row in result]
    finally:
        await engine.dispose()

    print(f"Tables found: {len(tables)}")
    for table in tables:
        print(f"  - {table}")


if __name__ == "__main__":
    asyncio.run(main())
