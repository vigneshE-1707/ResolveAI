"""Product repository."""
from __future__ import annotations

import uuid

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import Product


class ProductRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, product_id: uuid.UUID) -> Product | None:
        return await self.session.get(Product, product_id)

    async def get_by_sku(self, sku: str) -> Product | None:
        stmt = select(Product).where(Product.sku == sku)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_all(
        self, *, category: str | None = None, is_active: bool | None = None,
        q: str | None = None, offset: int = 0, limit: int = 20,
    ) -> tuple[list[Product], int]:
        stmt = select(Product)
        count_stmt = select(func.count()).select_from(Product)
        if category:
            stmt = stmt.where(Product.category == category)
            count_stmt = count_stmt.where(Product.category == category)
        if is_active is not None:
            stmt = stmt.where(Product.is_active == is_active)
            count_stmt = count_stmt.where(Product.is_active == is_active)
        if q:
            pattern = f"%{q}%"
            stmt = stmt.where(Product.name.ilike(pattern) | Product.sku.ilike(pattern))
            count_stmt = count_stmt.where(Product.name.ilike(pattern) | Product.sku.ilike(pattern))
        total = (await self.session.execute(count_stmt)).scalar() or 0
        stmt = stmt.order_by(Product.created_at.desc()).offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all()), total

    async def create(self, product: Product) -> Product:
        self.session.add(product)
        await self.session.flush()
        return product

    async def update(self, product_id: uuid.UUID, **kwargs) -> Product | None:
        product = await self.get_by_id(product_id)
        if not product:
            return None
        for key, value in kwargs.items():
            if hasattr(product, key) and value is not None:
                setattr(product, key, value)
        await self.session.flush()
        return product
