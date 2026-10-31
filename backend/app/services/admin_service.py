"""Admin service — user mgmt, products, knowledge, stats."""
from __future__ import annotations

import secrets
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import DuplicateError, NotFoundError
from app.core.security import hash_password
from app.models.user import User, Customer, SupportAgent
from app.models.knowledge import KnowledgeDocument
from app.repositories.user_repo import UserRepository, CustomerRepository, SupportAgentRepository
from app.repositories.product_repo import ProductRepository
from app.repositories.knowledge_repo import KnowledgeDocumentRepository
from app.repositories.analytics_repo import StatsRepository, AiRunRepository, AuditLogRepository


class AdminService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.user_repo = UserRepository(session)
        self.customer_repo = CustomerRepository(session)
        self.agent_repo = SupportAgentRepository(session)
        self.product_repo = ProductRepository(session)
        self.knowledge_repo = KnowledgeDocumentRepository(session)
        self.stats_repo = StatsRepository(session)
        self.ai_run_repo = AiRunRepository(session)
        self.audit_repo = AuditLogRepository(session)

    async def create_user(self, email: str, password: str, full_name: str, role: str) -> User:
        from app.services.auth_service import AuthService

        AuthService._validate_password(password)
        existing = await self.user_repo.get_by_email(email)
        if existing:
            raise DuplicateError("An account with this email already exists")
        user = User(email=email.lower().strip(), password_hash=hash_password(password), full_name=full_name.strip(), role=role)
        await self.user_repo.create(user)
        if role == "CUSTOMER":
            await self.customer_repo.create(Customer(user_id=user.id))
        elif role == "SUPPORT_AGENT":
            await self.agent_repo.create(SupportAgent(user_id=user.id, display_name=full_name))
        await self.session.commit()
        return user

    async def list_users(self, **kwargs):
        return await self.user_repo.list_users(**kwargs)

    async def update_user(self, user_id: uuid.UUID, **kwargs) -> User:
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise NotFoundError("User")

        previous_role = user.role
        updated = await self.user_repo.update_user(user_id, **kwargs)
        if not updated:
            raise NotFoundError("User")

        # A role change must keep the profile row consistent, otherwise the
        # next login cannot resolve customer_id/agent_id.
        if updated.role != previous_role:
            if updated.role == "CUSTOMER" and not await self.customer_repo.get_by_user_id(updated.id):
                await self.customer_repo.create(Customer(user_id=updated.id))
            elif updated.role == "SUPPORT_AGENT" and not await self.agent_repo.get_by_user_id(updated.id):
                await self.agent_repo.create(
                    SupportAgent(user_id=updated.id, display_name=updated.full_name)
                )

        await self.session.commit()
        return updated

    async def reset_password(self, user_id: uuid.UUID) -> str:
        temp_password = secrets.token_urlsafe(16)
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise NotFoundError("User")
        user.password_hash = hash_password(temp_password)
        await self.user_repo.bump_session_version(user_id)
        await self.session.commit()
        return temp_password

    async def list_products(self, **kwargs):
        return await self.product_repo.list_all(**kwargs)

    async def create_product(self, **kwargs):
        from app.models.product import Product
        existing = await self.product_repo.get_by_sku(kwargs.get("sku", ""))
        if existing:
            raise DuplicateError(f"Product with SKU '{kwargs['sku']}' already exists")
        product = Product(**kwargs)
        await self.product_repo.create(product)
        await self.session.commit()
        return product

    async def update_product(self, product_id: uuid.UUID, **kwargs):
        product = await self.product_repo.update(product_id, **kwargs)
        if not product:
            raise NotFoundError("Product")
        await self.session.commit()
        return product

    async def list_agents(self, **kwargs):
        return await self.agent_repo.list_agents(**kwargs)

    async def update_agent(self, agent_id: uuid.UUID, **kwargs):
        agent = await self.agent_repo.update_agent(agent_id, **kwargs)
        if not agent:
            raise NotFoundError("Agent")
        await self.session.commit()
        return agent

    async def list_knowledge_docs(self, **kwargs):
        return await self.knowledge_repo.list_all(**kwargs)

    async def create_knowledge_doc(self, title: str, category: str, content_text: str | None = None, created_by: uuid.UUID | None = None):
        doc = KnowledgeDocument(title=title, category=category, content_text=content_text, status="processing", created_by=created_by)
        await self.knowledge_repo.create(doc)
        await self.session.commit()
        return doc

    async def delete_knowledge_doc(self, doc_id: uuid.UUID) -> bool:
        result = await self.knowledge_repo.delete(doc_id)
        if not result:
            raise NotFoundError("Knowledge document")
        await self.session.commit()
        return True

    async def get_overview_stats(self) -> dict:
        return await self.stats_repo.get_overview_stats()

    async def get_agent_stats(self, agent_id: uuid.UUID) -> dict:
        return await self.stats_repo.get_agent_stats(agent_id)

    async def list_ai_runs(self, **kwargs):
        return await self.ai_run_repo.list_all(**kwargs)

    async def list_audit_logs(self, **kwargs):
        return await self.audit_repo.list_all(**kwargs)
