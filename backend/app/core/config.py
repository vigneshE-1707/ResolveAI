from __future__ import annotations

from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

_BASE_DIR = Path(__file__).resolve().parents[2]  # backend
_ROOT_DIR = Path(__file__).resolve().parents[3]  # project root


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(_ROOT_DIR / ".env", _BASE_DIR / ".env", ".env"),
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
    database_url: str = "postgresql+asyncpg://resolveai:resolveai@localhost:5432/resolveai"
    db_pool_size: int = 10
    db_statement_timeout_ms: int = 15000
    # SQL echo is opt-in: statements can contain PII and must not be logged by default.
    db_echo: bool = False

    # Auth / JWT
    jwt_secret_key: str = "change-me-please-use-a-32-plus-character-random-secret"
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = 15
    refresh_token_ttl_days: int = 7
    cookie_secure: bool = False

    # LLM & Agent
    llm_provider: str = "google_genai"
    llm_model: str = "gemini-3.5-flash"
    google_api_key: str = ""
    llm_temperature: float = 0.2
    llm_timeout_seconds: int = 30
    agent_turn_timeout_seconds: int = 45
    agent_max_steps: int = 4
    agent_history_messages: int = 20
    agent_graph_version: str = "v1"
    agent_checkpointer: str = "postgres"
    agent_checkpoint_schema: str = "langgraph"
    embedding_model: str = "gemini-embedding-001"
    embedding_dim: int = 768
    knowledge_top_k: int = 4

    # Return window starts at delivery, not order placement.
    return_window_days: int = 30

    # MCP Integration (Milestone 5)
    mcp_server_url: str = "http://127.0.0.1:8100/mcp"
    mcp_port: int = 8100
    mcp_call_timeout_seconds: int = 10
    mcp_actor_token_ttl_seconds: int = 60
    actor_token_ttl_seconds: int = 60
    mcp_audience: str = "business-tools"

    # LangSmith
    langsmith_tracing: bool = False
    langsmith_endpoint: str = "https://api.smith.langchain.com"
    langsmith_api_key: str = ""
    langsmith_project: str = "resolveai"
    langsmith_content_capture: bool = False

    # Rate limiting
    rate_limit_auth_per_minute: int = 10
    rate_limit_chat_per_minute: int = 30

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() in ("production", "prod")


settings = Settings()
