"""Unit tests for log redaction helpers."""
from __future__ import annotations

from app.observability.redaction import redact_mapping, redact_text


def test_redact_text_masks_email_and_phone():
    text = "Contact john.doe@email.com or +1 (503) 555-0144 for details"

    redacted = redact_text(text)

    assert "john.doe@email.com" not in redacted
    assert "555-0144" not in redacted
    assert "[email]" in redacted
    assert "[phone]" in redacted


def test_redact_mapping_masks_sensitive_keys_recursively():
    payload = {
        "user": {"email": "jane@example.com", "full_name": "Jane Doe"},
        "password": "hunter2",
        "nested": [{"access_token": "abc"}, {"note": "call me at +1 503 555 0100"}],
    }

    redacted = redact_mapping(payload)

    assert redacted["password"] == "[redacted]"
    assert redacted["user"]["email"] == "[redacted]"
    assert redacted["user"]["full_name"] == "Jane Doe"
    assert redacted["nested"][0]["access_token"] == "[redacted]"
    assert "[phone]" in redacted["nested"][1]["note"]


def test_redact_mapping_leaves_non_strings_alone():
    assert redact_mapping({"count": 3, "ok": True}) == {"count": 3, "ok": True}
