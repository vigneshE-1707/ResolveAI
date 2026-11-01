"""FastAPI application entry point."""
from __future__ import annotations

import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings
from app.core.context import request_id_var
from app.core.errors import AppError
from app.observability.logger import configure_logging

logger = logging.getLogger("resolveai.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown."""
    configure_logging()
    # Import models so metadata is populated
    import app.models  # noqa: F401

    yield

    from app.agents.checkpointer import checkpointer_manager

    await checkpointer_manager.close()


application = FastAPI(
    title=settings.app_name,
    version="0.1.0",
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


def _error_body(code: str, message: str, details: dict | None = None) -> dict:
    return {
        "code": code,
        "message": message,
        "details": details,
        "request_id": request_id_var.get(),
    }


# Exception handlers
@application.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    return JSONResponse(
        status_code=exc.status_code,
        content=_error_body(exc.code, exc.message, exc.details),
    )


@application.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    # Keep the documented envelope; expose field errors without echoing input values.
    details = {
        "errors": [
            {
                "loc": list(error.get("loc", [])),
                "type": error.get("type", "value_error"),
                "msg": error.get("msg", "Invalid value"),
            }
            for error in exc.errors()
        ]
    }
    return JSONResponse(
        status_code=422,
        content=_error_body("validation_error", "Request validation failed", details),
    )


@application.exception_handler(StarletteHTTPException)
async def http_error_handler(request: Request, exc: StarletteHTTPException):
    code = {
        400: "bad_request",
        401: "authentication_failed",
        403: "forbidden",
        404: "not_found",
        405: "method_not_allowed",
        409: "duplicate",
        429: "rate_limited",
    }.get(exc.status_code, "http_error")
    message = exc.detail if isinstance(exc.detail, str) else "Request failed"
    return JSONResponse(status_code=exc.status_code, content=_error_body(code, message))


@application.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception):
    logger.exception(
        "Unhandled request error",
        extra={"request_id": request_id_var.get(), "event": "unhandled_error"},
    )
    return JSONResponse(
        status_code=500,
        content=_error_body("internal_error", "An unexpected error occurred"),
    )


# Register routers
from app.api.v1.health import router as health_router
from app.api.v1.auth import router as auth_router
from app.api.v1.customers import router as customer_router
from app.api.v1.agent import router as agent_router
from app.api.v1.admin import router as admin_router
from app.api.v1.chat import router as chat_router

application.include_router(health_router, prefix="/api/v1")
application.include_router(auth_router, prefix="/api/v1")
application.include_router(customer_router, prefix="/api/v1")
application.include_router(agent_router, prefix="/api/v1")
application.include_router(admin_router, prefix="/api/v1")
application.include_router(chat_router, prefix="/api/v1")
