from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # General
    app_env: str = "development"
    app_name: str = "ResolveAI"
    log_level: str = "INFO"
    log_format: str = "text"
    frontend_origin: str = "http://localhost:5173"
    backend_port: int = 8000

    # Database
    database_url: str = "postgresql+asyncpg://postgres:admin@localhost:5432/ResolveAI"
    db_pool_size: int = 10
    db_statement_timeout_ms: int = 15000

    # Auth / JWT
    jwt_secret_key: str = "change-me-32+chars-random"
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = 15
    refresh_token_ttl_days: int = 7
    cookie_secure: bool = False
    actor_token_ttl_seconds: int = 60

    # AI / LLM (used in later milestones)
    llm_provider: str = "google_genai"
    llm_model: str = "gemini-2.5-flash"
    google_api_key: str = ""
    llm_temperature: float = 0.2
    llm_timeout_seconds: int = 30
    agent_max_steps: int = 4
    embedding_model: str = "gemini-embedding-001"
    embedding_dim: int = 768
    knowledge_top_k: int = 4

    # MCP
    mcp_server_url: str = "http://127.0.0.1:8100/mcp"
    mcp_port: int = 8100
    mcp_call_timeout_seconds: int = 10
    mcp_audience: str = "business-tools"

    # LangSmith
    langsmith_tracing: bool = False
    langsmith_api_key: str = ""
    langsmith_project: str = "resolveai-development"
    langsmith_content_capture: bool = False

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


settings = Settings()
