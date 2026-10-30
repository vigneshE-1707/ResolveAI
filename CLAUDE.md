# ResolveAI — Agent Instructions (CLAUDE.md)

Instruction file for AI coding agents (Claude Code, OpenCode, Cursor, etc.). Read this before writing any code.

## Project purpose

ResolveAI is an AI-powered customer support automation platform (initial domain: e-commerce).
A customer chats with an AI agent that can look up orders, answer policy questions grounded in a
knowledge base, create tickets, request returns/cancellations behind explicit approval, and
escalate to human agents. Human agents and admins work in dashboards backed by real data.

This is a portfolio-grade product: correctness, security, and observability matter more than demo polish.

## Technology stack (pinned via `pyproject.toml` / `package.json`, verify before installing)

- Backend: Python 3.12, FastAPI 0.162.x, Pydantic 2.14.x, SQLAlchemy 2.1.x (async), Alembic 1.20.x, asyncpg / psycopg3
- AI: LangGraph 1.2.x, LangChain 1.4.x, `langchain-google-genai` 4.x (Gemini), LangSmith 0.14.x (optional)
- MCP: official `mcp` Python SDK **2.x** (`mcp == 2.3.x`) — see "Critical API notes" below
- DB: PostgreSQL 16+ with `pgvector` (dev: local/Docker; prod: Supabase). No FAISS, no Redis in MVP.
- Frontend: React 19, TypeScript, Vite, Tailwind 4, shadcn/ui, TanStack Query 5, React Router 7, Recharts, Zod 4
- Auth: PyJWT (access+refresh JWTs), argon2-cffi password hashing
- Deploy: Docker Compose (dev), GitHub Actions CI

## Repository layout

```
resolveai/
├── backend/
│   ├── app/
│   │   ├── api/v1/          # routers (auth, me, orders, tickets, conversations, chat, admin, knowledge, health)
│   │   ├── core/            # settings, security, logging, errors, dependencies
│   │   ├── db/              # base, session, mixins
│   │   ├── models/          # SQLAlchemy ORM models
│   │   ├── schemas/         # Pydantic request/response models
│   │   ├── repositories/    # DB access only
│   │   ├── services/        # deterministic business logic (no HTTP, no graph)
│   │   ├── agents/          # LangGraph SupportState, graph, nodes, tools, prompts, checkpointer
│   │   ├── mcp_client/      # MCP Client wrapper for the agent layer
│   │   ├── mcp_server/      # separate MCP server process (MCPServer + business tools)
│   │   ├── knowledge/       # ingestion, chunking, embeddings, retrieval
│   │   └── observability/   # logging setup, trace IDs, redaction helpers
│   ├── migrations/          # Alembic
│   ├── tests/               # pytest (+ eval datasets under tests/eval/)
│   └── pyproject.toml
├── frontend/                # React app (see frontend/README for details)
│   └── src/{app,features,components,lib,types}
├── docs/                    # requirements.md, api-design.md, ui-design.md
├── scripts/                 # dev helpers
├── .env.example
├── ARCHITECTURE.md / ROADMAP.md / README.md / CLAUDE.md
```

## Architecture principles (enforce these)

1. **Layering:** `api/v1` → `services` → `repositories` → `models`. Never skip layers.
   LangGraph nodes call `services`, not repositories, and never write HTTP.
2. **One agent, not many.** A single LangGraph customer-support agent with a typed `SupportState`.
   Only add a specialized agent when a *business* requirement forces it — get approval first.
3. **The LLM never holds identity.** Customer identity comes from the authenticated user
   (`current_user.customer_id`) — never from LLM-generated arguments. MCP tool schemas therefore
   do NOT accept `customer_id`.
4. **MCP is the only door to business actions.** State-changing operations (create ticket, request
   return, cancel order) go: graph node → `mcp_client` → MCP server → `service` → DB, with a scoped
   actor JWT carrying `sub`, `role`, `conversation_id`. Deterministic validation lives in services.
5. **No free-form business actions for the LLM.** No SQL tools, no generic "fetch this URL" tool.
   Tools = fixed, documented business operations with structured outputs.
6. **State-changing ops must be idempotent.** Lay `idempotency_key` on tickets/returns/cancellations
   so retries can't create duplicates. Read-only ops may retry with backoff + jitter.
7. **Secrets and PII never leak.** No keys in code/logs/traces; redact addresses/phones/tokens
   before logging or tracing (see `observability/redaction.py`).
8. **Env-config over hardcoding.** Every deployment-varying value lives in settings (`.env`,
   `.env.example` documents it). Never commit real credentials.

## Critical API notes (v2-era libraries — do NOT follow old tutorials)

- **MCP SDK 2.x:** `from mcp.server import MCPServer`; `mcp = MCPServer("ResolveAI-Business")`;
  `@mcp.tool()` with type hints + docstrings for the schema. Client: `from mcp import Client`,
  `async with Client(url) as c: await c.call_tool(name, args)`. Transport: **Streamable HTTP** by
  default when given a URL. Docs: <https://py.sdk.modelcontextprotocol.io>.
- **LangGraph 1.x:** `StateGraph(SupportState)`, `interrupt()` for human-in-the-loop pauses,
  resume with `Command(resume=...)`. Stores: `AsyncPostgresSaver` requires the extra
  `langgraph-checkpoint-postgres` package; `InMemorySaver` for tests. `add_messages` reducer for
  message-list state.
- **SQLAlchemy 2.1:** async ORM — `Mapped[...]` + `mapped_column(...)`, `async with session.begin()`.
  Alembic async migrations or run sync engine for `alembic upgrade head`.
- **Pydantic v2:** use `model_config = ConfigDict(from_attributes=True)`, not `orm_mode`.
- **Tailwind 4:** CSS-first config (`@theme` in CSS), no `tailwind.config.js` by default.

## Coding conventions

- Python 3.12 typing everywhere; `from __future__ import annotations` optional; prefer explicit imports.
- Services raise typed domain errors from `app/core/errors.py` (`NotFoundError`, `PermissionDeniedError`,
  `ValidationError`, `RateLimitError`, `MCPUnavailableError`); exception handlers translate them to
  stable HTTP codes with safe public messages.
- Frontend: function components, hooks, TypeScript strict mode; TanStack Query for all server state;
  Zod schemas shared with API contract shapes in `src/lib/api`.
- Tests colocated by feature; async tests via `pytest-asyncio`; LLM calls always faked in unit tests.

## Testing commands (from Milestone 3 onward)

```bash
# backend
cd backend && uv run pytest -q                 # or: python -m pytest -q
python -m pytest tests/integration -q          # needs local Postgres running
python scripts/seed_demo.py                    # deterministic demo data
# frontend
cd frontend && npm run test                    # vitest + React Testing Library
npm run lint && npm run build
# mcp server
cd backend && python -m app.mcp_server.main
```

## Security constraints (non-negotiable)

- Passwords: argon2id; never store or log plaintext.
- JWTs: short-lived access (~15 min) in memory + refresh token rotation; reject tokens missing
  expected claims; every customer-scoped query filters by the authenticated `customer_id`.
- RBAC roles: CUSTOMER, SUPPORT_AGENT, ADMIN — enforced by FastAPI dependencies, not by the UI.
- Customer data (names, addresses, order totals) is PII: exclude from logs/traces or redact first.
- Never expose Supabase service-role keys or signing secrets to the frontend.
- CORS: allowlist the known frontend origin; no wildcard in production.

## Development workflow

1. Before editing, inspect current code and docs; keep `README.md`, `ARCHITECTURE.md`, `ROADMAP.md`
   in sync with reality.
2. Work milestone-by-milestone per `ROADMAP.md`. **Do not implement unapproved scopes.**
3. Milestone completion = code runs + tests pass + docs updated + issues/limitations reported, then STOP for review.
4. If something is simulated/incomplete, label it clearly in UI copy and docs — never present demo data as real.
