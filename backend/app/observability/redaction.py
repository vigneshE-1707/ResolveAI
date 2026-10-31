"""PII redaction helpers for logs and trace metadata.

These are deliberately conservative: redact on the way out, never rely on the
caller remembering to strip fields.
"""
from __future__ import annotations

import re
from typing import Any

_EMAIL_RE = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
_PHONE_RE = re.compile(r"(?<!\d)(?:\+?\d[\d\s().-]{7,}\d)(?!\d)")
_CARD_RE = re.compile(r"\b(?:\d[ -]*?){13,19}\b")

SENSITIVE_KEYS = {
    "password",
    "password_hash",
    "token",
    "access_token",
    "refresh_token",
    "authorization",
    "api_key",
    "secret",
    "phone",
    "email",
    "line1",
    "line2",
    "postal_code",
    "tracking_number",
}


def redact_text(value: str) -> str:
    value = _EMAIL_RE.sub("[email]", value)
    value = _PHONE_RE.sub("[phone]", value)
    value = _CARD_RE.sub("[card]", value)
    return value


def redact_mapping(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            key: "[redacted]" if str(key).lower() in SENSITIVE_KEYS else redact_mapping(item)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [redact_mapping(item) for item in value]
    if isinstance(value, str):
        return redact_text(value)
    return value
