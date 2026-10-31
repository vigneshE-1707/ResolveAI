"""Order, Shipment, ReturnRequest repositories."""
from __future__ import annotations

import uuid

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.order import Order, OrderItem, Shipment, ReturnRequest
from app.models.user import Customer


class OrderRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, order_id: uuid.UUID) -> Order | None:
        stmt = select(Order).where(Order.id == order_id).options(
            selectinload(Order.items).selectinload(OrderItem.product),
            selectinload(Order.shipment),
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_order_number(self, order_number: str, *, customer_id: uuid.UUID | None = None) -> Order | None:
        stmt = select(Order).where(Order.order_number == order_number).options(
            selectinload(Order.items).selectinload(OrderItem.product),
            selectinload(Order.shipment),
        )
        if customer_id:
            stmt = stmt.where(Order.customer_id == customer_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_customer(
        self, customer_id: uuid.UUID, *, status: str | None = None,
        q: str | None = None, offset: int = 0, limit: int = 20,
    ) -> tuple[list[Order], int]:
        stmt = select(Order).where(Order.customer_id == customer_id)
        count_stmt = select(func.count()).select_from(Order).where(Order.customer_id == customer_id)
        if status:
            stmt = stmt.where(Order.status == status)
            count_stmt = count_stmt.where(Order.status == status)
        if q:
            pattern = f"%{q}%"
            stmt = stmt.where(Order.order_number.ilike(pattern))
            count_stmt = count_stmt.where(Order.order_number.ilike(pattern))
        total = (await self.session.execute(count_stmt)).scalar() or 0
        stmt = stmt.options(
            selectinload(Order.items).selectinload(OrderItem.product),
            selectinload(Order.shipment),
            selectinload(Order.customer).selectinload(Customer.user),
        ).order_by(Order.placed_at.desc()).offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all()), total

    async def list_all(
        self, *, status: str | None = None, q: str | None = None,
        offset: int = 0, limit: int = 20,
    ) -> tuple[list[Order], int]:
        stmt = select(Order)
        count_stmt = select(func.count()).select_from(Order)
        if status:
            stmt = stmt.where(Order.status == status)
            count_stmt = count_stmt.where(Order.status == status)
        if q:
            pattern = f"%{q}%"
            stmt = stmt.where(Order.order_number.ilike(pattern))
            count_stmt = count_stmt.where(Order.order_number.ilike(pattern))
        total = (await self.session.execute(count_stmt)).scalar() or 0
        stmt = stmt.options(
            selectinload(Order.items).selectinload(OrderItem.product),
            selectinload(Order.shipment),
            selectinload(Order.customer).selectinload(Customer.user),
        ).order_by(Order.placed_at.desc()).offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all()), total

    async def create(self, order: Order) -> Order:
        self.session.add(order)
        await self.session.flush()
        return order

    async def update_status(self, order_id: uuid.UUID, status: str, **kwargs) -> Order | None:
        order = await self.session.get(Order, order_id)
        if not order:
            return None
        order.status = status
        for key, value in kwargs.items():
            if hasattr(order, key) and value is not None:
                setattr(order, key, value)
        await self.session.flush()
        return order


class ReturnRequestRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_idempotency_key(self, key: str) -> ReturnRequest | None:
        stmt = select(ReturnRequest).where(ReturnRequest.idempotency_key == key)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_active_for_order(self, order_id: uuid.UUID) -> ReturnRequest | None:
        stmt = (
            select(ReturnRequest)
            .where(
                ReturnRequest.order_id == order_id,
                ReturnRequest.status.in_(["requested", "approved", "refunded"]),
            )
            .order_by(ReturnRequest.created_at.desc())
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def get_by_order(self, order_id: uuid.UUID) -> list[ReturnRequest]:
        stmt = (
            select(ReturnRequest)
            .where(ReturnRequest.order_id == order_id)
            .order_by(ReturnRequest.created_at.desc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_by_customer(self, customer_id: uuid.UUID, *, offset: int = 0, limit: int = 20) -> tuple[list[ReturnRequest], int]:
        stmt = select(ReturnRequest).where(ReturnRequest.customer_id == customer_id)
        count_stmt = select(func.count()).select_from(ReturnRequest).where(ReturnRequest.customer_id == customer_id)
        total = (await self.session.execute(count_stmt)).scalar() or 0
        stmt = stmt.order_by(ReturnRequest.created_at.desc()).offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all()), total

    async def create(self, return_request: ReturnRequest) -> ReturnRequest:
        self.session.add(return_request)
        await self.session.flush()
        return return_request
