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
| [`docs/ui-design.md`](docs/ui-design.md) | Design system and component mapping |
| [`CLAUDE.md`](CLAUDE.md) | Agent instructions for AI-assisted development |
| [`.env.example`](.env.example) | All environment variables with docs |

## Status

**Milestone 2 — Frontend UI Foundation: COMPLETE (awaiting approval).**
Milestone 1 (design & architecture) is approved. All UI in `frontend/` runs on clearly labelled demo
data (`frontend/src/mocks/data.ts`); no backend calls are made yet.

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

## Local prerequisites (planned Milestone 3)

- Python 3.12, Node 20+, Git
- PostgreSQL 16+ with `pgvector` — via Docker Compose (recommended) or local install
- A Gemini API key (`GOOGLE_API_KEY`); LangSmith key optional
