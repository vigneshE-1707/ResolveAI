"""Auth router — register, login, refresh, logout, me."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import CurrentUser, get_current_user, get_db
from app.core.config import settings
from app.schemas.auth import AuthResponse, LoginRequest, RefreshRequest, RegisterRequest, UserResponse
from app.schemas.common import MessageResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


def _user_response(user, customer_id=None, agent_id=None) -> UserResponse:
    return UserResponse(
        id=str(user.id), email=user.email, full_name=user.full_name,
        role=user.role, customer_id=str(customer_id) if customer_id else None,
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
async def refresh(body: RefreshRequest, response: Response, db: AsyncSession = Depends(get_db)):
    svc = AuthService(db)
    token = body.refresh_token or ""
    result = await svc.refresh(token)
    _set_refresh_cookie(response, result["refresh_token"])
    return AuthResponse(
        access_token=result["access_token"],
        user=_user_response(result["user"], result.get("customer_id"), result.get("agent_id")),
    )


@router.post("/logout", response_model=MessageResponse, status_code=204)
async def logout(
    response: Response,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = AuthService(db)
    await svc.logout(user.user_id)
    response.delete_cookie("refresh_token", path="/api/v1/auth")
    return MessageResponse(message="Logged out")


@router.get("/me", response_model=UserResponse)
async def me(user: CurrentUser = Depends(get_current_user)):
    return UserResponse(
        id=str(user.user_id), email="", full_name="", role=user.role,
        customer_id=str(user.customer_id) if user.customer_id else None,
        agent_id=str(user.agent_id) if user.agent_id else None,
    )


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="refresh_token", value=token,
        httponly=True, secure=settings.cookie_secure,
        samesite="strict", path="/api/v1/auth",
        max_age=settings.refresh_token_ttl_days * 86400,
    )
