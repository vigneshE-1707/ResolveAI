# ResolveAI

**AI-Powered Customer Support Automation Platform** — e-commerce first, industry-extensible by design.

ResolveAI lets customers talk to an AI support agent that grounds every answer in real business data
(orders, shipments, tickets) and a vector knowledge base, executes business operations only after
deterministic validation and explicit approval, and escalates cleanly to human agents.

## Highlights

- **Agentic core** — a single LangGraph 1.x support agent with typed state, persistent
  Postgres checkpointer, tool-calling, and `interrupt()`-based human-in-the-loop.
- **MCP-mediated business tools** — the agent talks to the business system through a dedicated
  MCP server (official Python SDK **v2**, Streamable HTTP). Identity flows from a verified JWT,
  never from LLM-generated arguments.
- **Grounded policy answers** — pgvector semantic retrieval with source citations; the agent won't
  invent policy.
- **Three-role product** — customer portal, human agent workspace, admin dashboard, all on real data.
- **Observable** — LangSmith traces (optional) with PII redaction + structured app logs and audit trail.

## Docs

| File | Contents |
|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | System architecture, DB schema, LangGraph workflow, MCP design, security & scalability requirements |
| [`ROADMAP.md`](ROADMAP.md) | Milestones 1–10 with acceptance criteria and current status |
| [`docs/requirements.md`](docs/requirements.md) | Functional/non-functional requirements, MVP scope, roles, user journeys |
| [`docs/api-design.md`](docs/api-design.md) | REST + SSE API surface (v1) |
| [`frontend/src/index.css`](frontend/src/index.css) | Design tokens (Tailwind 4 `@theme`) and base styles |
| [`frontend/src/components/ui`](frontend/src/components/ui) | shadcn/ui component library used across portals |
| [`CLAUDE.md`](CLAUDE.md) | Agent instructions for AI-assisted development |
| [`.env.example`](.env.example) | All environment variables with docs |

## Status

**Milestone 3 — Backend Foundation: COMPLETE (awaiting review).**
Auth (register/login/refresh/logout with DB-backed session revocation), RBAC, orders, returns,
tickets, conversations, agent workspace, admin, health, structured logging, audit trail, Alembic
migrations (up → down → up verified), deterministic seed, and 40 passing tests.

**Frontend integration is the remaining part of Milestone 3.** All UI in `frontend/` still runs on
clearly labelled demo data (`frontend/src/mocks/data.ts`); the API client, auth provider, route
guards, and snake_case → camelCase mappers are next.

## Run the backend

Requires Docker Desktop (for Postgres 16 + pgvector) and Python 3.12+.

```powershell
# 1. Database (from the repository root)
docker compose up -d db

# 2. Python environment (from backend/)
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"

# 3. Schema + demo data
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe scripts\seed_demo.py

# 4. API
.\.venv\Scripts\python.exe -m uvicorn app.main:application --host 127.0.0.1 --port 8000
```

OpenAPI docs: <http://127.0.0.1:8000/docs>. Health: `/api/v1/healthz`, `/api/v1/readyz`.

**Demo credentials** (password `ResolveAI#2026` for every account):

| Role | Email |
|---|---|
| Customer | `john.doe@email.com` |
| Support agent | `maya.fernandez@resolveai.app` |
| Admin | `alex.morgan@resolveai.app` |

```powershell
# Tests (integration tests create and migrate a separate resolveai_test database)
cd backend
.\.venv\Scripts\python.exe -m pytest -q

# Reset demo data to its deterministic state
.\.venv\Scripts\python.exe scripts\seed_demo.py --reset
```

### API conventions

- JSON fields are **snake_case** on the wire; the frontend maps them to camelCase at the API-client
  boundary.
- Errors always use `{ "code", "message", "details", "request_id" }` with a stable `code`
  (`not_found`, `forbidden`, `validation_error`, `authentication_failed`, `duplicate`, …).
- List endpoints return `{ "data": [...], "meta": { "page", "page_size", "total" } }`.
- State-changing customer requests accept an `Idempotency-Key` header and replay the original
  resource on retry.

## Run the frontend

The project pins a local portable Node 22 (`vite` 8 requires ≥22.12). From the repository root:

```powershell
$env:PATH = "$(Get-Location)\.tools\node22;$env:PATH"
cd frontend
npm install          # first run only
npm run dev          # http://localhost:5173
```

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server with `/api` proxy to `localhost:8000` |
| `npm run build` | `tsc -b` typecheck + production bundle |
| `npm run typecheck` | Types only |
| `npm run test` / `test:watch` | Vitest + Testing Library (jsdom) |
| `npm run lint` | oxlint |

Routes: `/support`, `/orders`, `/tickets` (customer) · `/agent`, `/agent/conversations`,
`/agent/tickets` · `/admin` and the admin operations/intelligence pages · `/login`, `/register`,
`/profile`, `/settings`. Use the sidebar or topbar avatar to preview another role — that switcher is
a **local demo affordance**, not authentication.

## Local prerequisites

- Python 3.12+ (3.13 is verified), Node 20+, Git
- Docker Desktop for PostgreSQL 16 + `pgvector` (`docker compose up -d db`)
- A Gemini API key (`GOOGLE_API_KEY`); LangSmith key optional
