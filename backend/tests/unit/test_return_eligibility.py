"""Unit tests for the deterministic return-eligibility rule."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.services.return_service import evaluate_return_eligibility

NOW = datetime(2026, 10, 30, 12, 0, tzinfo=timezone.utc)


def make_order(status: str, *, delivered_at: datetime | None = None, updated_at: datetime | None = None):
    shipment = SimpleNamespace(delivered_at=delivered_at) if delivered_at is not None else None
    return SimpleNamespace(
        order_number="ORD-1000",
        status=status,
        shipment=shipment,
        updated_at=updated_at or NOW,
    )


def test_delivered_inside_window_is_eligible():
    order = make_order("delivered", delivered_at=NOW - timedelta(days=5))

    result = evaluate_return_eligibility(order, now=NOW)

    assert result["eligible"] is True
    assert result["order_number"] == "ORD-1000"
    assert result["return_window_end"] == "2026-11-24"


def test_delivered_outside_window_is_rejected():
    order = make_order("delivered", delivered_at=NOW - timedelta(days=31))

    result = evaluate_return_eligibility(order, now=NOW)

    assert result["eligible"] is False
    assert "30-day return window" in result["reason"]


def test_delivery_boundary_is_inclusive():
    order = make_order("delivered", delivered_at=NOW - timedelta(days=30))

    result = evaluate_return_eligibility(order, now=NOW)

    assert result["eligible"] is True


def test_shipped_order_is_not_eligible():
    result = evaluate_return_eligibility(make_order("shipped"), now=NOW)

    assert result["eligible"] is False
    assert "must be delivered first" in result["reason"]


def test_cancelled_order_is_not_eligible():
    result = evaluate_return_eligibility(make_order("cancelled"), now=NOW)

    assert result["eligible"] is False
    assert "Cancelled" in result["reason"]


def test_existing_active_return_blocks_a_second_one():
    order = make_order("delivered", delivered_at=NOW - timedelta(days=2))

    result = evaluate_return_eligibility(
        order, active_return=SimpleNamespace(id="return-1"), now=NOW
    )

    assert result["eligible"] is False
    assert "already in progress" in result["reason"]


def test_returned_order_is_not_eligible():
    result = evaluate_return_eligibility(make_order("returned"), now=NOW)

    assert result["eligible"] is False


def test_naive_delivery_timestamp_is_treated_as_utc():
    naive = datetime(2026, 10, 25, 12, 0)  # no tzinfo
    order = make_order("delivered", delivered_at=naive)

    result = evaluate_return_eligibility(order, now=NOW)

    assert result["eligible"] is True
    assert result["return_window_end"] == "2026-11-24"
