"""Auth router — register, login, refresh, logout, me."""
from __future__ import annotations

from fastapi import APIRouter, Cookie, Depends, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import CurrentUser, get_current_user, get_db
from app.core.config import settings
from app.models.user import Customer, SupportAgent, User
from app.schemas.auth import AuthResponse, LoginRequest, RefreshRequest, RegisterRequest, UserResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE = "refresh_token"
REFRESH_COOKIE_PATH = "/api/v1/auth"


def _user_response(user: User, customer_id=None, agent_id=None) -> UserResponse:
    return UserResponse(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        customer_id=str(customer_id) if customer_id else None,
        agent_id=str(agent_id) if agent_id else None,
    )


@router.post("/register", response_model=AuthResponse, status_code=201)
async def register(body: RegisterRequest, response: Response, db: AsyncSession = Depends(get_db)):
    svc = AuthService(db)
    result = await svc.register(body.email, body.password, body.full_name)
    _set_refresh_cookie(response, result["refresh_token"])
    return AuthResponse(
        access_token=result["access_token"],
        user=_user_response(result["user"], result.get("customer_id")),
    )


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    svc = AuthService(db)
    result = await svc.login(body.email, body.password)
    _set_refresh_cookie(response, result["refresh_token"])
    return AuthResponse(
        access_token=result["access_token"],
        user=_user_response(result["user"], result.get("customer_id"), result.get("agent_id")),
    )


@router.post("/refresh", response_model=AuthResponse)
async def refresh(
    response: Response,
    body: RefreshRequest | None = None,
    refresh_cookie: str | None = Cookie(default=None, alias=REFRESH_COOKIE),
    db: AsyncSession = Depends(get_db),
):
    token = (body.refresh_token if body else None) or refresh_cookie
    if not token:
        from app.core.errors import AuthenticationError

        raise AuthenticationError("Missing refresh token")

    svc = AuthService(db)
    result = await svc.refresh(token)
    _set_refresh_cookie(response, result["refresh_token"])
    return AuthResponse(
        access_token=result["access_token"],
        user=_user_response(result["user"], result.get("customer_id"), result.get("agent_id")),
    )


@router.post("/logout", status_code=204)
async def logout(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = AuthService(db)
    await svc.logout(user.user_id)
    response = Response(status_code=204)
    response.delete_cookie(REFRESH_COOKIE, path=REFRESH_COOKIE_PATH)
    return response


@router.get("/me", response_model=UserResponse)
async def me(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(User, user.user_id)
    if not row:
        from app.core.errors import AuthenticationError

        raise AuthenticationError("Invalid or expired token")

    customer_id = None
    agent_id = None
    if row.role == "CUSTOMER":
        customer_id = (
            await db.execute(select(Customer.id).where(Customer.user_id == row.id))
        ).scalar_one_or_none()
    elif row.role == "SUPPORT_AGENT":
        agent_id = (
            await db.execute(select(SupportAgent.id).where(SupportAgent.user_id == row.id))
        ).scalar_one_or_none()

    return _user_response(row, customer_id, agent_id)


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="strict",
        path=REFRESH_COOKIE_PATH,
        max_age=settings.refresh_token_ttl_days * 86400,
    )
