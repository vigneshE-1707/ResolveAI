"""FastAPI application entry point."""
from __future__ import annotations

import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse

from app.core.config import settings
from app.core.context import request_id_var
from app.core.errors import AppError


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown."""
    # Import models so metadata is populated
    import app.models  # noqa: F401
    yield


application = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    default_response_class=ORJSONResponse,
    lifespan=lifespan,
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
)

# CORS
application.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request ID middleware
@application.middleware("http")
async def add_request_id(request: Request, call_next):
    rid = request.headers.get("x-request-id", str(uuid.uuid4()))
    request_id_var.set(rid)
    response = await call_next(request)
    response.headers["x-request-id"] = rid
    return response


# Exception handlers
@application.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    return ORJSONResponse(
        status_code=exc.status_code,
        content={
            "code": exc.code,
            "message": exc.message,
            "details": exc.details,
            "request_id": request_id_var.get(),
        },
    )


# Register routers
from app.api.v1.health import router as health_router
from app.api.v1.auth import router as auth_router
from app.api.v1.customers import router as customer_router
from app.api.v1.agent import router as agent_router
from app.api.v1.admin import router as admin_router

application.include_router(health_router, prefix="/api/v1")
application.include_router(auth_router, prefix="/api/v1")
application.include_router(customer_router, prefix="/api/v1")
application.include_router(agent_router, prefix="/api/v1")
application.include_router(admin_router, prefix="/api/v1")
