"""LLM provider factory.

The provider and model are configuration, not code: swapping Gemini for another
LangChain chat model is an env change plus one branch here.
"""
from __future__ import annotations

from langchain_core.language_models.chat_models import BaseChatModel

from app.core.config import settings
from app.core.errors import ModelUnavailableError

_GOOGLE_PROVIDERS = {"google_genai", "google", "gemini"}


def is_llm_configured() -> bool:
    """Cheap readiness check used before opening an SSE stream."""
    if settings.llm_provider.lower() in _GOOGLE_PROVIDERS:
        return bool(settings.google_api_key)
    return True


def get_chat_model(*, streaming: bool = True) -> BaseChatModel:
    provider = settings.llm_provider.lower()

    if provider in _GOOGLE_PROVIDERS:
        if not settings.google_api_key:
            raise ModelUnavailableError("AI model is not configured")
        # Imported lazily so non-AI deployments do not need the provider package.
        from langchain_google_genai import ChatGoogleGenerativeAI

        return ChatGoogleGenerativeAI(
            model=settings.llm_model,
            api_key=settings.google_api_key,
            temperature=settings.llm_temperature,
            request_timeout=settings.llm_timeout_seconds,
            streaming=streaming,
        )

    raise ModelUnavailableError(f"Unsupported LLM provider: {provider}")
