"""Structured application logging.

Kept intentionally small: one stdout handler, JSON in production, human-readable
text in development. Never log request bodies or credentials here.
"""
from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone

from app.core.config import settings


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for key in ("request_id", "turn_id", "event", "latency_ms", "model", "status_code"):
            value = getattr(record, key, None)
            if value is not None:
                payload[key] = value
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


def configure_logging() -> None:
    root = logging.getLogger()
    root.setLevel(settings.log_level.upper())

    # Avoid duplicate handlers when uvicorn reloads the app.
    for handler in list(root.handlers):
        if getattr(handler, "_resolveai", False):
            root.removeHandler(handler)

    handler = logging.StreamHandler(sys.stdout)
    handler._resolveai = True  # type: ignore[attr-defined]
    if settings.log_format == "json":
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(
            logging.Formatter("%(asctime)s %(levelname)-5s [%(name)s] %(message)s")
        )
    root.addHandler(handler)
