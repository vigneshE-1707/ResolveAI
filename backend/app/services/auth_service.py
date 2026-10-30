"""Authentication service — register, login, refresh, logout."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AuthenticationError, DuplicateError, ValidationError
from app.core.security import create_access_token, create_refresh_token, decode_token, hash_password, verify_password
from app.models.user import User, Customer
from app.repositories.user_repo import UserRepository, CustomerRepository, SupportAgentRepository


class AuthService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.user_repo = UserRepository(session)
        self.customer_repo = CustomerRepository(session)

    async def register(self, email: str, password: str, full_name: str) -> dict:
        self._validate_password(password)
        existing = await self.user_repo.get_by_email(email)
        if existing:
            raise DuplicateError("An account with this email already exists")

        user = User(
            email=email.lower().strip(),
            password_hash=hash_password(password),
            full_name=full_name.strip(),
            role="CUSTOMER",
        )
        await self.user_repo.create(user)
        customer = Customer(user_id=user.id)
        await self.customer_repo.create(customer)
        await self.session.commit()

        access_token = create_access_token(user.id, user.role, customer_id=customer.id)
        refresh_token = create_refresh_token(user.id)
        return {"access_token": access_token, "user": user, "customer_id": customer.id, "refresh_token": refresh_token}

    async def login(self, email: str, password: str) -> dict:
        user = await self.user_repo.get_by_email(email)
        if not user or not verify_password(password, user.password_hash):
            raise AuthenticationError("Invalid credentials")
        if not user.is_active:
            raise AuthenticationError("Invalid credentials")

        await self.user_repo.update_last_login(user.id)
        await self.session.commit()

        customer_id, agent_id = None, None
        if user.role == "CUSTOMER":
            customer = await self.customer_repo.get_by_user_id(user.id)
            customer_id = customer.id if customer else None
        elif user.role == "SUPPORT_AGENT":
            agent_repo = SupportAgentRepository(self.session)
            agent = await agent_repo.get_by_user_id(user.id)
            agent_id = agent.id if agent else None

        access_token = create_access_token(user.id, user.role, customer_id=customer_id, agent_id=agent_id, session_version=user.session_version)
        refresh_token = create_refresh_token(user.id, user.session_version)
        return {"access_token": access_token, "user": user, "customer_id": customer_id, "agent_id": agent_id, "refresh_token": refresh_token}

    async def refresh(self, refresh_token_str: str) -> dict:
        import jwt as pyjwt
        try:
            payload = decode_token(refresh_token_str)
        except pyjwt.PyJWTError:
            raise AuthenticationError("Invalid refresh token")
        if payload.get("type") != "refresh":
            raise AuthenticationError("Invalid token type")

        user_id = uuid.UUID(payload["sub"])
        user = await self.user_repo.get_by_id(user_id)
        if not user or not user.is_active:
            raise AuthenticationError("Invalid refresh token")
        if payload.get("session_version") != user.session_version:
            raise AuthenticationError("Session has been revoked")

        customer_id, agent_id = None, None
        if user.role == "CUSTOMER":
            customer = await self.customer_repo.get_by_user_id(user.id)
            customer_id = customer.id if customer else None
        elif user.role == "SUPPORT_AGENT":
            agent_repo = SupportAgentRepository(self.session)
            agent = await agent_repo.get_by_user_id(user.id)
            agent_id = agent.id if agent else None

        access_token = create_access_token(user.id, user.role, customer_id=customer_id, agent_id=agent_id, session_version=user.session_version)
        new_refresh = create_refresh_token(user.id, user.session_version)
        return {"access_token": access_token, "refresh_token": new_refresh, "user": user, "customer_id": customer_id, "agent_id": agent_id}

    async def logout(self, user_id: uuid.UUID) -> None:
        await self.user_repo.bump_session_version(user_id)
        await self.session.commit()

    @staticmethod
    def _validate_password(password: str) -> None:
        if len(password) < 10:
            raise ValidationError("Password must be at least 10 characters")
        if not (any(c.isupper() for c in password) and any(c.islower() for c in password) and any(c.isdigit() for c in password)):
            raise ValidationError("Password must contain uppercase, lowercase, and a digit")
