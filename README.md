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

**Milestone 1 — Design & Architecture: COMPLETE (awaiting approval).**
Implementation starts with Milestone 2 (frontend UI foundation) after review. See `ROADMAP.md`.

## Local prerequisites (planned Milestone 3)

- Python 3.12, Node 20+, Git
- PostgreSQL 16+ with `pgvector` — via Docker Compose (recommended) or local install
- A Gemini API key (`GOOGLE_API_KEY`); LangSmith key optional
