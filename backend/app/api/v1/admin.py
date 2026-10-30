"""Admin endpoints — users, products, orders, agents, knowledge, analytics, monitoring."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import CurrentUser, get_db, require_role
from app.schemas.user import AdminUserCreate, AdminUserUpdate, AdminAgentUpdate
from app.schemas.product import ProductCreate, ProductUpdate
from app.schemas.knowledge import KnowledgeDocumentCreate
from app.services.admin_service import AdminService
from app.services.order_service import OrderService
from app.services.ticket_service import TicketService

router = APIRouter(prefix="/admin", tags=["admin"])


# ── Stats ──────────────────────────────────────────────────

@router.get("/stats")
async def overview_stats(
    user: CurrentUser = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    svc = AdminService(db)
    return await svc.get_overview_stats()


# ── Users ──────────────────────────────────────────────────

@router.get("/users")
async def list_users(
    role: str | None = None, q: str | None = None,
    page: int = 1, page_size: int = 20,
    user: CurrentUser = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    svc = AdminService(db)
    offset = (page - 1) * page_size
    users, total = await svc.list_users(role=role, q=q, offset=offset, limit=page_size)
    return {"data": [{"id": str(u.id), "email": u.email, "full_name": u.full_name, "role": u.role, "is_active": u.is_active, "created_at": u.created_at.isoformat()} for u in users], "meta": {"page": page, "page_size": page_size, "total": total}}


@router.post("/users", status_code=201)
async def create_user(
    body: AdminUserCreate,
    user: CurrentUser = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    svc = AdminService(db)
    new_user = await svc.create_user(body.email, body.password, body.full_name, body.role)
    return {"id": str(new_user.id), "email": new_user.email, "role": new_user.role}


@router.patch("/users/{user_id}")
async def update_user(
    user_id: uuid.UUID, body: AdminUserUpdate,
    user: CurrentUser = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    svc = AdminService(db)
    updated = await svc.update_user(user_id, **body.model_dump(exclude_unset=True))
    return {"id": str(updated.id), "email": updated.email, "role": updated.role, "is_active": updated.is_active}


@router.post("/users/{user_id}/reset-password")
async def reset_password(
    user_id: uuid.UUID,
    user: CurrentUser = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    svc = AdminService(db)
    temp_pw = await svc.reset_password(user_id)
    return {"temporary_password": temp_pw}


# ── Products ───────────────────────────────────────────────

@router.get("/products")
async def list_products(
    category: str | None = None, q: str | None = None,
    page: int = 1, page_size: int = 20,
    user: CurrentUser = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    svc = AdminService(db)
    offset = (page - 1) * page_size
    products, total = await svc.list_products(category=category, q=q, offset=offset, limit=page_size)
    return {"data": [{"id": str(p.id), "sku": p.sku, "name": p.name, "category": p.category, "price_cents": p.price_cents, "currency": p.currency, "is_active": p.is_active} for p in products], "meta": {"page": page, "page_size": page_size, "total": total}}


@router.post("/products", status_code=201)
async def create_product(
    body: ProductCreate,
    user: CurrentUser = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    svc = AdminService(db)
    product = await svc.create_product(**body.model_dump())
    return {"id": str(product.id), "sku": product.sku, "name": product.name}


@router.patch("/products/{product_id}")
async def update_product(
    product_id: uuid.UUID, body: ProductUpdate,
    user: CurrentUser = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    svc = AdminService(db)
    product = await svc.update_product(product_id, **body.model_dump(exclude_unset=True))
    return {"id": str(product.id), "sku": product.sku, "name": product.name, "is_active": product.is_active}


# ── Orders ─────────────────────────────────────────────────

@router.get("/orders")
async def list_orders(
    status: str | None = None, q: str | None = None,
    page: int = 1, page_size: int = 20,
    user: CurrentUser = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    svc = OrderService(db)
    orders, total = await svc.list_all_orders(status=status, q=q, page=page, page_size=page_size)
    from app.api.v1.customers import _order_summary
    return {"data": [_order_summary(o) for o in orders], "meta": {"page": page, "page_size": page_size, "total": total}}


@router.get("/orders/{order_number}")
async def get_order(
    order_number: str,
    user: CurrentUser = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    svc = OrderService(db)
    order = await svc.get_order_by_number(order_number)
    from app.api.v1.customers import _order_detail
    return _order_detail(order)


@router.patch("/orders/{order_id}/status")
async def update_order_status(
    order_id: uuid.UUID, body: dict,
    user: CurrentUser = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    svc = OrderService(db)
    order = await svc.update_order_status(order_id, body.get("status", ""))
    return {"id": str(order.id), "status": order.status}


# ── Agents ─────────────────────────────────────────────────

@router.get("/agents")
async def list_agents(
    page: int = 1, page_size: int = 20,
    user: CurrentUser = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    svc = AdminService(db)
    offset = (page - 1) * page_size
    agents, total = await svc.list_agents(offset=offset, limit=page_size)
    return {"data": [{"id": str(a.id), "display_name": a.display_name, "team": a.team, "is_active": a.is_active} for a in agents], "meta": {"page": page, "page_size": page_size, "total": total}}


@router.patch("/agents/{agent_id}")
async def update_agent(
    agent_id: uuid.UUID, body: AdminAgentUpdate,
    user: CurrentUser = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    svc = AdminService(db)
    agent = await svc.update_agent(agent_id, **body.model_dump(exclude_unset=True))
    return {"id": str(agent.id), "display_name": agent.display_name, "team": agent.team, "is_active": agent.is_active}


# ── Tickets ────────────────────────────────────────────────

@router.get("/tickets")
async def list_all_tickets(
    status: str | None = None, priority: str | None = None,
    q: str | None = None, page: int = 1, page_size: int = 20,
    user: CurrentUser = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    svc = TicketService(db)
    tickets, total = await svc.list_all_tickets(status=status, priority=priority, q=q, page=page, page_size=page_size)
    from app.api.v1.customers import _ticket_out
    return {"data": [_ticket_out(t) for t in tickets], "meta": {"page": page, "page_size": page_size, "total": total}}


# ── Knowledge ──────────────────────────────────────────────

@router.get("/knowledge")
async def list_knowledge(
    category: str | None = None, page: int = 1, page_size: int = 20,
    user: CurrentUser = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    svc = AdminService(db)
    offset = (page - 1) * page_size
    docs, total = await svc.list_knowledge_docs(category=category, offset=offset, limit=page_size)
    return {"data": [{"id": str(d.id), "title": d.title, "category": d.category, "status": d.status, "version": d.version, "chunk_count": d.chunk_count, "updated_at": d.updated_at.isoformat()} for d in docs], "meta": {"page": page, "page_size": page_size, "total": total}}


@router.post("/knowledge/upload", status_code=201)
async def upload_knowledge(
    body: KnowledgeDocumentCreate,
    user: CurrentUser = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    svc = AdminService(db)
    doc = await svc.create_knowledge_doc(body.title, body.category, body.content_text, created_by=user.user_id)
    return {"id": str(doc.id), "title": doc.title, "status": doc.status}


@router.delete("/knowledge/{doc_id}", status_code=204)
async def delete_knowledge(
    doc_id: uuid.UUID,
    user: CurrentUser = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    svc = AdminService(db)
    await svc.delete_knowledge_doc(doc_id)
    return None


# ── Analytics ──────────────────────────────────────────────

@router.get("/ai-runs")
async def list_ai_runs(
    status: str | None = None, trace_id: str | None = None,
    page: int = 1, page_size: int = 20,
    user: CurrentUser = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    svc = AdminService(db)
    offset = (page - 1) * page_size
    runs, total = await svc.list_ai_runs(status=status, trace_id=trace_id, offset=offset, limit=page_size)
    return {"data": [{"id": str(r.id), "conversation_id": str(r.conversation_id), "trace_id": r.trace_id, "model_name": r.model_name, "status": r.status, "latency_ms": r.latency_ms, "prompt_tokens": r.prompt_tokens, "completion_tokens": r.completion_tokens, "created_at": r.created_at.isoformat()} for r in runs], "meta": {"page": page, "page_size": page_size, "total": total}}


@router.get("/audit-logs")
async def list_audit_logs(
    action: str | None = None, entity_type: str | None = None,
    page: int = 1, page_size: int = 20,
    user: CurrentUser = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    svc = AdminService(db)
    offset = (page - 1) * page_size
    logs, total = await svc.list_audit_logs(action=action, entity_type=entity_type, offset=offset, limit=page_size)
    return {"data": [{"id": str(l.id), "actor_user_id": str(l.actor_user_id) if l.actor_user_id else None, "actor_role": l.actor_role, "action": l.action, "entity_type": l.entity_type, "created_at": l.created_at.isoformat()} for l in logs], "meta": {"page": page, "page_size": page_size, "total": total}}


@router.get("/settings")
async def get_settings(user: CurrentUser = Depends(require_role("ADMIN"))):
    from app.core.config import settings
    return {"app_env": settings.app_env, "llm_model": settings.llm_model, "llm_provider": settings.llm_provider, "langsmith_tracing": settings.langsmith_tracing}
