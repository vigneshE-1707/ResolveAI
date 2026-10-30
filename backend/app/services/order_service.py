"""Order service."""
from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.repositories.order_repo import OrderRepository


class OrderService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.order_repo = OrderRepository(session)

    async def get_customer_orders(self, customer_id: uuid.UUID, *, status: str | None = None, q: str | None = None, page: int = 1, page_size: int = 20):
        offset = (page - 1) * page_size
        return await self.order_repo.list_by_customer(customer_id, status=status, q=q, offset=offset, limit=page_size)

    async def get_order_by_number(self, order_number: str, *, customer_id: uuid.UUID | None = None):
        order = await self.order_repo.get_by_order_number(order_number, customer_id=customer_id)
        if not order:
            raise NotFoundError("Order", order_number)
        return order

    async def list_all_orders(self, *, status: str | None = None, q: str | None = None, page: int = 1, page_size: int = 20):
        offset = (page - 1) * page_size
        return await self.order_repo.list_all(status=status, q=q, offset=offset, limit=page_size)

    async def update_order_status(self, order_id: uuid.UUID, status: str, **kwargs):
        order = await self.order_repo.update_status(order_id, status, **kwargs)
        if not order:
            raise NotFoundError("Order")
        await self.session.commit()
        return order

    async def check_return_eligibility(self, order_number: str, customer_id: uuid.UUID) -> dict:
        order = await self.order_repo.get_by_order_number(order_number, customer_id=customer_id)
        if not order:
            raise NotFoundError("Order", order_number)
        eligible = order.status in ("delivered", "shipped")
        reason = "Order is eligible for return" if eligible else f"Order status '{order.status}' is not eligible for return"
        return {"eligible": eligible, "reason": reason, "order_number": order.order_number, "order_status": order.status}
