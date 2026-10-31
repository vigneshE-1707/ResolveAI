"""Return eligibility and request creation.

Eligibility is deterministic and deliberately conservative:
- the order must exist and belong to the customer;
- it must be delivered (a return window cannot start before delivery);
- the window is ``return_window_days`` from delivery;
- no active return may already exist for the order.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.constants import RETURN_REASON_CODES
from app.core.errors import DuplicateError, NotFoundError, ValidationError
from app.models.audit import IdempotencyKey
from app.models.order import Order, ReturnRequest
from app.repositories.analytics_repo import IdempotencyKeyRepository
from app.repositories.order_repo import OrderRepository, ReturnRequestRepository
from app.services.audit_service import AuditService


def evaluate_return_eligibility(
    order: Order,
    *,
    active_return: ReturnRequest | None = None,
    now: datetime | None = None,
) -> dict[str, Any]:
    """Pure eligibility decision, kept free of DB access for unit testing."""
    now = now or datetime.now(timezone.utc)
    window_days = settings.return_window_days

    if order.status == "cancelled":
        return _result(order, False, "Cancelled orders cannot be returned", None)
    if order.status == "returned" or active_return is not None:
        return _result(order, False, "A return is already in progress for this order", None)
    if order.status != "delivered":
        return _result(
            order,
            False,
            f"Order status '{order.status}' is not eligible for return; it must be delivered first",
            None,
        )

    delivered_at = getattr(getattr(order, "shipment", None), "delivered_at", None)
    if delivered_at is None:
        # Some legacy rows have status=delivered without a shipment event.
        delivered_at = order.updated_at
    if delivered_at.tzinfo is None:
        delivered_at = delivered_at.replace(tzinfo=timezone.utc)

    window_end = delivered_at + timedelta(days=window_days)
    if now > window_end:
        return _result(
            order,
            False,
            f"The {window_days}-day return window ended on {window_end.date().isoformat()}",
            window_end,
        )

    return _result(order, True, "Order is eligible for return", window_end)


def _result(order: Order, eligible: bool, reason: str, window_end: datetime | None) -> dict[str, Any]:
    return {
        "eligible": eligible,
        "reason": reason,
        "order_number": order.order_number,
        "order_status": order.status,
        "return_window_end": window_end.date().isoformat() if window_end else None,
    }


class ReturnService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.order_repo = OrderRepository(session)
        self.return_repo = ReturnRequestRepository(session)
        self.idempotency_repo = IdempotencyKeyRepository(session)
        self.audit = AuditService(session)

    async def check_eligibility(self, order_number: str, customer_id: uuid.UUID) -> dict[str, Any]:
        order = await self._get_owned_order(order_number, customer_id)
        active_return = await self.return_repo.get_active_for_order(order.id)
        return evaluate_return_eligibility(order, active_return=active_return)

    async def create_return(
        self,
        *,
        customer_id: uuid.UUID,
        actor_user_id: uuid.UUID,
        order_number: str,
        reason_code: str,
        reason_text: str | None,
        idempotency_key: str | None,
    ) -> ReturnRequest:
        if reason_code not in RETURN_REASON_CODES:
            raise ValidationError(
                "Invalid return reason",
                details={"allowed": sorted(RETURN_REASON_CODES)},
            )

        # Idempotent replay: return the original resource, never a duplicate.
        if idempotency_key:
            existing = await self.return_repo.get_by_idempotency_key(idempotency_key)
            if existing:
                return existing

        order = await self._get_owned_order(order_number, customer_id)
        active_return = await self.return_repo.get_active_for_order(order.id)
        eligibility = evaluate_return_eligibility(order, active_return=active_return)
        if not eligibility["eligible"]:
            raise ValidationError(eligibility["reason"])

        if idempotency_key and await self.idempotency_repo.exists(idempotency_key):
            raise DuplicateError("This request has already been processed")

        now = datetime.now(timezone.utc)
        request = ReturnRequest(
            order_id=order.id,
            customer_id=customer_id,
            reason_code=reason_code,
            reason_text=reason_text,
            status="requested",
            requested_at=now,
            idempotency_key=idempotency_key,
        )
        await self.return_repo.create(request)

        if idempotency_key:
            await self.idempotency_repo.create(
                IdempotencyKey(
                    key=idempotency_key,
                    scope="returns",
                    resource_type="return_request",
                    resource_id=request.id,
                )
            )

        await self.audit.record(
            actor_user_id=actor_user_id,
            actor_role="CUSTOMER",
            action="return.requested",
            entity_type="return_request",
            entity_id=request.id,
            meta={"order_number": order.order_number, "reason_code": reason_code},
        )
        await self.session.commit()
        return request

    async def list_customer_returns(
        self, customer_id: uuid.UUID, *, page: int = 1, page_size: int = 20
    ) -> tuple[list[ReturnRequest], int]:
        offset = (page - 1) * page_size
        return await self.return_repo.list_by_customer(customer_id, offset=offset, limit=page_size)

    async def _get_owned_order(self, order_number: str, customer_id: uuid.UUID) -> Order:
        order = await self.order_repo.get_by_order_number(order_number, customer_id=customer_id)
        if not order:
            # Do not distinguish "does not exist" from "belongs to someone else".
            raise NotFoundError("Order", order_number)
        return order
