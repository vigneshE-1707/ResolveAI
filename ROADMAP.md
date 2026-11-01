# ResolveAI — Roadmap

One milestone at a time. Each milestone: **implement → run → test → review → document → stop for approval**.

| # | Milestone | Status | Core deliverables | Acceptance criteria |
|---|---|---|---|---|
| 1 | **Design & Architecture** | ✅ **COMPLETE — awaiting approval** | `ARCHITECTURE.md`, `docs/*`, `ROADMAP.md`, `CLAUDE.md`, `.env.example` | Every requirement from §21 addressed; decisions justified; review passed |
| 2 | **Frontend UI Foundation** | ✅ **COMPLETE — awaiting approval** | Vite8+React19+TS7+Tailwind4+shadcn; design tokens; AppSidebar, TopNavbar, StatCard, ChatPanel, CustomerProfileCard, OrderStatusCard, TicketCard, ConversationList, ActivityTimeline, AnalyticsChart, EmptyState/ErrorState/LoadingSkeleton; 3 portals (routes + shells); `frontend/src/mocks/*` clearly demarcated as demo | `npm run build && npm run test` green; all 3 portals navigable and responsive; demo screens visually match spec; no backend calls yet |
| 3 | **Backend Foundation + Frontend Integration** | ✅ **COMPLETE — awaiting approval** | FastAPI0.162 + SQLAlchemy2.1 async + Alembic + Postgres16/pgvector; JWT auth (argon2) + RBAC deps; entities from schema; orders/products/tickets/returns/health endpoints; deterministic seed script; frontend wired to the live API (auth context + route guards, typed fetch client with refresh-on-401, React Query hooks, snake_case→camelCase mappers) | CRUD + auth flows pass pytest (45); manual API walkthrough via /docs; migrations up/down/up clean; `npm run typecheck && npm run lint && npm run test && npm run build` green (27 tests); remaining demo surfaces visibly labelled |
| 4 | **AI Agent Foundation** | ⏳ | Gemini via provider factory; SupportState + minimal graph (classify → route → tool → compose); `AsyncPostgresSaver` checkpointer; messages/ai_runs persistence; SSE streaming endpoint; chat UI wired to it | Asking “Where is my order ORD-1024?” returns real DB facts (correct order), streamed; conversation history resumes correctly across restart |
| 5 | **MCP Integration** | ⏳ | mcp==2.3 MCPServer: 8 tools; backend `mcp_client` + actor-JWT; graph tools rewired to MCP; structured outputs; error taxonomy; smoke/integration tests | LangGraph tool calls actually traverse MCP → service → DB; unauthorized cross-customer attempt returns `forbidden` (test proves it) |
| 6 | Knowledge Retrieval | ⏳ | pgvector; ingest pipeline (upload→chunk→embed w/ `gemini-embedding-001`, dim 768); `search_knowledge_base` tool; admin KB UI | Policy question returns grounded answer + source citations; changed doc → re-embedded; no match → honest “I don’t find this in policy” |
| 7 | Advanced Workflows | ⏳ | Ticket creation via agent; delivery complaint flows; return-eligibility check; return request; multi-turn clarify; **approval via `interrupt()`**; escalation trigger conditions | Agent asks “please confirm” before creating return; Confirm resumes and executes exactly once (idempotent); cancel path deniable |
| 8 | Human Agent Workspace | ⏳ | Escalated queue; 3-pane conversation view; reply (SSE to other sessions later / REST now); assignment; status transitions; resolution; AI paused while human active (gate in graph route) | Agent resolves escalated conversation; customer receives agent replies; re-enabled AI only by explicit action |
| 9 | Analytics & Monitoring | ⏳ | Recharts dashboards fed only by `ai_runs`/`support_tickets`/`conversations` aggregates; LangSmith traces verified; structured logs; error “investigate from trace_id”; eval suite + first real results | Charts non-empty from real data (or honest “no data”); ≥5 eval categories with actual scored results reported |
| 10 | Prod hardening + Deployment | ⏳ | Dockerfiles + compose; Supabase migration walkthrough; GitHub Actions (lint/type/test); security review; performance pass; README/demo script | `docker compose up` boots full stack; CI green on PR; security checklist documented and checked |

## Milestone sequencing note
Milestones 3 and 4 are prerequisites for 4/5 streaming & tool behavior; M6 depends on M4 (model
provider wiring) and on embedding decisions in M1 review. M2 frontend mocks will be replaced by real
integrations in M3 (REST) and M4/M5 (chat/SSE/MCP).

## Post-MVP (not scheduled, not approved)
Redis-backed rate limiting/caching, WebSocket for agent-to-agent realtime, multi-tenant SaaS
organization layer, additional verticals (SaaS support, fintech), multilingual support.
