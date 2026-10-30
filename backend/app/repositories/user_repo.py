"""User, Customer, SupportAgent, Address repositories."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.user import User, Customer, SupportAgent, CustomerAddress


class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, user_id: uuid.UUID) -> User | None:
        return await self.session.get(User, user_id)

    async def get_by_email(self, email: str) -> User | None:
        stmt = select(User).where(func.lower(User.email) == email.lower())
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def create(self, user: User) -> User:
        self.session.add(user)
        await self.session.flush()
        return user

    async def update_last_login(self, user_id: uuid.UUID) -> None:
        user = await self.get_by_id(user_id)
        if user:
            user.last_login_at = datetime.now(timezone.utc)
            await self.session.flush()

    async def bump_session_version(self, user_id: uuid.UUID) -> None:
        user = await self.get_by_id(user_id)
        if user:
            user.session_version += 1
            await self.session.flush()

    async def list_users(
        self, *, role: str | None = None, is_active: bool | None = None,
        q: str | None = None, offset: int = 0, limit: int = 20,
    ) -> tuple[list[User], int]:
        stmt = select(User)
        count_stmt = select(func.count()).select_from(User)
        if role:
            stmt = stmt.where(User.role == role)
            count_stmt = count_stmt.where(User.role == role)
        if is_active is not None:
            stmt = stmt.where(User.is_active == is_active)
            count_stmt = count_stmt.where(User.is_active == is_active)
        if q:
            pattern = f"%{q}%"
            stmt = stmt.where(User.full_name.ilike(pattern) | User.email.ilike(pattern))
            count_stmt = count_stmt.where(User.full_name.ilike(pattern) | User.email.ilike(pattern))
        total = (await self.session.execute(count_stmt)).scalar() or 0
        stmt = stmt.order_by(User.created_at.desc()).offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all()), total

    async def update_user(self, user_id: uuid.UUID, **kwargs) -> User | None:
        user = await self.get_by_id(user_id)
        if not user:
            return None
        for key, value in kwargs.items():
            if hasattr(user, key) and value is not None:
                setattr(user, key, value)
        await self.session.flush()
        return user


class CustomerRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, customer_id: uuid.UUID) -> Customer | None:
        return await self.session.get(Customer, customer_id)

    async def get_by_user_id(self, user_id: uuid.UUID) -> Customer | None:
        stmt = select(Customer).where(Customer.user_id == user_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def create(self, customer: Customer) -> Customer:
        self.session.add(customer)
        await self.session.flush()
        return customer

    async def list_customers(
        self, *, q: str | None = None, offset: int = 0, limit: int = 20,
    ) -> tuple[list[Customer], int]:
        stmt = select(Customer).join(User)
        count_stmt = select(func.count()).select_from(Customer)
        if q:
            pattern = f"%{q}%"
            stmt = stmt.where(User.full_name.ilike(pattern) | User.email.ilike(pattern))
            count_stmt = count_stmt.join(User).where(User.full_name.ilike(pattern) | User.email.ilike(pattern))
        total = (await self.session.execute(count_stmt)).scalar() or 0
        stmt = stmt.options(selectinload(Customer.user)).order_by(Customer.created_at.desc()).offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all()), total


class SupportAgentRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, agent_id: uuid.UUID) -> SupportAgent | None:
        return await self.session.get(SupportAgent, agent_id)

    async def get_by_user_id(self, user_id: uuid.UUID) -> SupportAgent | None:
        stmt = select(SupportAgent).where(SupportAgent.user_id == user_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def create(self, agent: SupportAgent) -> SupportAgent:
        self.session.add(agent)
        await self.session.flush()
        return agent

    async def list_agents(
        self, *, is_active: bool | None = None, offset: int = 0, limit: int = 20,
    ) -> tuple[list[SupportAgent], int]:
        stmt = select(SupportAgent)
        count_stmt = select(func.count()).select_from(SupportAgent)
        if is_active is not None:
            stmt = stmt.where(SupportAgent.is_active == is_active)
            count_stmt = count_stmt.where(SupportAgent.is_active == is_active)
        total = (await self.session.execute(count_stmt)).scalar() or 0
        stmt = stmt.options(selectinload(SupportAgent.user)).order_by(SupportAgent.created_at.desc()).offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all()), total

    async def update_agent(self, agent_id: uuid.UUID, **kwargs) -> SupportAgent | None:
        agent = await self.get_by_id(agent_id)
        if not agent:
            return None
        for key, value in kwargs.items():
            if hasattr(agent, key) and value is not None:
                setattr(agent, key, value)
        await self.session.flush()
        return agent


class AddressRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_by_customer(self, customer_id: uuid.UUID) -> list[CustomerAddress]:
        stmt = select(CustomerAddress).where(
            CustomerAddress.customer_id == customer_id
        ).order_by(CustomerAddress.is_default.desc(), CustomerAddress.created_at.desc())
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create(self, address: CustomerAddress) -> CustomerAddress:
        self.session.add(address)
        await self.session.flush()
        return address
