# ResolveAI — Architecture

**Version:** 1.0 · **Status:** Proposed (Milestone 1, pending approval) · **Date:** 2026-10-30

---

## 1. Overview and principles

ResolveAI is a full-stack AI support platform. Customers converse with a single LangGraph agent;
the agent gathers business facts through MCP tools backed by deterministic services; state-changing
operations require validation and (where sensitive) explicit approval; anything unresolved escalates
to human agents; admins manage data, knowledge, and analytics stored in PostgreSQL.

**Guiding principles**

1. **Single agent, strong guardrails.** One `SupportGraph` + typed state. Specialized agents only when
   a real business need appears (get approval first).
2. **The LLM proposes, the system decides.** Identity, authorization, eligibility, and idempotency are
   enforced by deterministic code. LLM outputs are advisory signals, never facts.
3. **MCP as the business boundary.** Business/tools travel graph → MCP client → MCP server →
   service → repository → Postgres. Clear seams to swap Gemini for another provider, Postgres for
   Supabase, or MCP for a future REST/queue transport.
4. **Observable and honest.** Every AI run is recorded (latency, tokens, errors, trace ID),
   every sensitive mutation is audited, demo data is labeled as demo.
5. **Boring where possible.** No Redis, no FAISS, no microservices, no extra agents until justified.

## 2. System components

```
                 ┌────────────────────────────────────────────────────────────┐
                 │                    resolveai-monorepo                      │
                 │                                                            │
 Browser ──HTTP──►  frontend (React 19 SPA)                                   │
                 │      ├─ Customer portal  (chat, orders, tickets)           │
                 │      ├─ Agent workspace  (queue, 3-pane conversations)     │
                 │      └─ Admin dashboard  (mgmt, KB, analytics)             │
                 │                                                            │
                 │  frontend ──REST + SSE──► backend/app (FastAPI 0.162)      │
                 │                            ├─ api/v1 routers               │
                 │                            ├─ core (settings, security,    │
                 │                            │        logging, dependencies) │
                 │                            ├─ services (business rules)    │
                 │                            ├─ repositories (SQLAlchemy)    │
                 │                            ├─ agents (LangGraph graph)     │
                 │                            ├─ knowledge (ingest, retrieve) │
                 │                            └─ mcp_client (MCP Client)      │
                 │                                   │                        │
                 │                                   │ Streamable HTTP +      │
                 │                                   │ scoped actor JWT       │
                 │                                   ▼                        │
                 │           mcp_server (mcp==2.3 MCPServer process)           │
                 │             ├─ auth: verify actor JWT (sub, role, conv)    │
                 │             ├─ tools: 8 business tools (see §7)            │
                 │             └─ calls the same services layer               │
                 │                                   │                        │
                 │                                   ▼                        │
                 │           PostgreSQL 16 + pgvector                         │
                 │            schemas: app (business+support),                │
                 │                     langgraph (AsyncPostgresSaver)         │
                 └────────────────────────────────────────────────────────────┘
       external (optional): Gemini API · LangSmith (tracing) · Supabase (prod DB)
```

Key characteristics:

- **Two backend processes** in dev: `uvicorn app.main:app` (REST + SSE) and
  `python -m app.mcp_server.main` (MCP over Streamable HTTP). The MCP server imports the same
  `services`/`repositories` package — one implementation, two transports.
- **Frontend** is a single SPA with role-guarded route trees. Chat uses SSE for token streaming;
  polling via TanStack Query elsewhere; WebSockets deliberately deferred (agent↔agent realtime is
  not a Milestone-8 requirement; SSE + polling is enough and simpler).
- **No Redis** in the MVP. Vertical scaling first; add Redis later for rate limits/caching if real
  load demands it.

## 3. Runtime flows

### 3.1 Customer chat turn (happy path)

```
1  POST /api/v1/conversations/{id}/chat   (JWT access token)
2  API: auth → load conversation (must belong to customer) → persist user message row
3  API: build SupportState (messages, customer_id, conversation_id, idempotent turn id)
4  graph.ainvoke / astream(state, config={thread_id: str(conversation_id)})
     classify_intent ─ route ─ to_retriever / to_tools / to_clarify / to_escalate
                        to_tools: LLM (tool calling) → MCPClient.call_tool(...)
                                  → mcp_server verifies actor JWT → service validates
                                  → DB → structured result
                        validate_result: schema + ownership + sanity checks
              (destructive ops stop here at the approval node → interrupt())
     compose_response: LLM streams grounded answer + optional rich card payloads
5  SSE frames to browser: {token|card|turn_status|error}
6  On graph completion: persist assistant message, ai_run record, audit events
```

### 3.2 Approval-gated action (return request, cancellation)

```
... intent=return_request → eligibility check (deterministic, service-callable directly)
    → approval node: interrupt(graphstate)  ✋ graph pauses (checkpoint in `langgraph` schema)
    → SSE: "needs_confirmation" + ApprovalEnvelope {action, data, options}
    → Customer clicks Confirm → POST /api/v1/conversations/{id}/approvals
    → API verifies stored approval token matches & state is pending
    → graph.invoke(Command(resume=decision), config) resumes → executes via MCP tool
      → idempotency_key(scope, turn) guards duplicates → audit_log row → turn completes
```

### 3.3 Escalation (human handover)

```
detect_escalation (explicit request | low confidence caps | repeated tool failure |
                   unavailable data) → conversation.mode switches ai → human_pending;
agent loop refuses further autonomous tool use for that conversation until a human
agent explicitly re-enables AI (or resolves). Escalation creates/links a support_ticket,
emits conversation_event, appears in the agent dashboard queue with escalation_reason.
```

## 4. Database design

PostgreSQL 16+, two schemas:

- `app` — business + support data (Alembic-managed)
- `langgraph` — checkpoint tables from `AsyncPostgresSaver` (auto-created by the saver; excluded from Alembic)

Extension: `CREATE EXTENSION IF NOT EXISTS vector;` (required on Supabase too). Embedding column is
`vector(768)` (Gemini embedding dimension; fixed at Milestone 6 with a startup compat check).

Conventions: UUID PKs (gen_random_uuid), `created_at/updated_at TIMESTAMPTZ`, money as
`{kind}_cents BIGINT` + `currency CHAR(3)`, statuses as `TEXT + CHECK` (portable, easy to extend),
soft flags `is_active BOOL`, flexible extras in `JSONB meta`.

### 4.1 Tables

```
users              (id, email CITEXT UNIQUE, password_hash, full_name, role
                    CHECK role∈{CUSTOMER,SUPPORT_AGENT,ADMIN}, is_active, last_login_at)
customers          (id, user_id UNIQUE→users, phone, loyalty_tier, created_at)
support_agents     (id, user_id UNIQUE→users, display_name, team, is_active)
customer_addresses (id, customer_id→customers, label, line1, line2, city, region,
                    postal_code, country, is_default)
products           (id, sku UNIQUE, name, description, category, price_cents,
                    currency, is_active, image_url)

orders             (id, order_number UNIQUE, customer_id→customers, status CHECK
                    {pending,confirmed,processing,shipped,delivered,cancelled,returned},
                    placed_at, subtotal/shipping/tax/total (cents), currency,
                    shipping_address_id, cancelled_at, cancel_reason)
order_items        (id, order_id→orders, product_id→products, quantity,
                    unit_price_cents, name_snapshot)
shipments          (id, order_id→orders, carrier, tracking_number, status CHECK
                    {prepared,in_transit,out_for_delivery,delivered,exception},
                    shipped_at, estimated_delivery_at, delivered_at,
                    last_event_desc, last_event_at)
return_requests    (id, order_id→orders, customer_id, reason_code, reason_text,
                    status CHECK {requested,approved,rejected,refunded,closed},
                    requested_at, decided_at, decided_by, refund_amount_cents,
                    idempotency_key)

support_tickets      (id, ticket_number UNIQUE, customer_id, order_id NULL,
                      conversation_id NULL, subject, category CHECK {order_status,
                      delivery_issue,wrong_item,return_request,cancellation,
                      refund,billing,product_quality,other}, description, status
                      CHECK {open,in_progress,pending_customer,resolved,closed},
                      priority {low,normal,high}, assigned_agent_id NULL,
                      escalation_reason, created_at, first_response_at,
                      resolved_at, resolution_note, idempotency_key)
conversations        (id, customer_id, channel {web}, subject, mode {ai,human,human_pending},
                      status {open,escalated,resolved,closed}, assigned_agent_id,
                      escalation_reason, escalated_at, resolved_at, closed_at)
messages             (id, conversation_id, role {user,assistant,agent,system,tool},
                      content TEXT, content_type {text,card,system_note},
                      card JSONB NULL,        -- rich UI payloads (order status, ticket…)
                      sources JSONB NULL,      -- KB citations [{doc,chunk,score}]
                      trace_id NULL, latency_ms NULL, token_usage JSONB NULL,
                      seq INTEGER              -- ordering; partial index on (conversation_id, seq))
conversation_events  (id, conversation_id, event_type {created,escalated,reopened,
                      ai_paused,ai_resumed,assigned,ticket_created,approval_granted,
                      approval_denied,resolved,closed}, actor_or NULL, payload JSONB, created_at)

knowledge_documents  (id, title, category {returns,refunds,shipping,cancellation,
                      warranty,faq}, source_type {upload,seed}, content_text,
                      status {processing,ready,failed}, version, embedding_model,
                      embedding_dim, chunk_count, created_by, created_at)
knowledge_chunks     (id, document_id→docs CASCADE, chunk_index, content, token_count,
                      metadata JSONB, embedding vector(768))
                     HNSW index (embedding vector_cosine_ops)
ai_runs              (id, conversation_id, message_id, trace_id, graph_version,
                      model_name, status {succeeded,failed,interrupted,escalated},
                      error_code NULL, latency_ms, prompt_tokens, completion_tokens,
                      tool_calls JSONB, created_at)        -- per-turn telemetry for analytics
idempotency_keys     (id, key UNIQUE, scope, resource_type, resource_id, created_at)
audit_logs           (id, actor_user_id NULL, actor_role, action, entity_type,
                      entity_id NULL, conversation_id NULL, request_id NULL,
                      ip_address NULL, meta JSONB, created_at)
```

### 4.2 Indexes & integrity (notable)

```
orders(customer_id, status), orders(order_number UNIQUE)
shipments(order_id), support_tickets(status, priority), support_tickets(assigned_agent_id, status)
conversations(mode, status), conversations(customer_id, updated_at DESC)
messages(conversation_id, seq DESC)
knowledge_chunks HNSW(embedding) WHERE document status='ready'
idempotency_keys UNIQUE(key), support_tickets/return_requests UNIQUE(idempotency_key) NULLS DISTINCT
customers.user_id UNIQUE, support_agents.user_id UNIQUE
FKs ON DELETE RESTRICT (business data), CASCADE (chunks→documents)
```

## 5. LangGraph agent design

### 5.1 State (typed, minimal, no duplication)

```python
class SupportState(TypedDict):
    conversation_id: UUID
    customer_id: UUID           # from auth, NOT from the model
    messages: Annotated[list[BaseMessage], add_messages]
    intent: SupportIntent | None          # enum: order_status, return_request, policy_qa,
                                          # complaint, escalate, cancel_order, general, off_topic
    retrieved_context: list[RetrievedChunk] | None
    tool_results: list[ToolCallResult] | None      # validated structured outputs
    pending_action: PendingAction | None           # the outcome candidate business mutation
    approval: ApprovalDecision | None              # granted/denied after resume
    escalation: EscalationInfo | None
    errors: Annotated[list[GraphError], operator.add]
    turn_id: UUID                                  # correlation + idempotency seed
```

Everything else (order payloads, ticket rows) lives in `tool_results`, NOT in state.

### 5.2 Graph

```
 START → load_context ─→ classify_intent ─→ route ─┬─(smalltalk/off_topic)──────► compose_response
                                                   ├─(policy_qa)──► retrieve_knowledge ─┘
                                                   ├─(order_status/general tools)─► tool_loop ─► validate_results ─┐
                                                   ├─(needs confirmation)──► prepare_action ─► approval ──interrupt()──┤*
                                                   ├─(escalate)───────────────────────────────► escalate_to_agent
                                                   └─(insufficient info)──► ask_clarification ─► compose_response
        * after resume: validate_results ─► execute_action (MCP) ─► record_outcome ─► compose_response

 tool_loop      : bounded (max_steps=4) ReAct-style node — LLM picks from MCP-bound tools
 validate_results: every tool payload checked: schema + ownership + business sanity; failures add
                  to `errors` and cap retries (2) before forcing escalate
 approval       : interrupt() → Postgres checkpoint; resume via Command(resume={decision, actor})
 compose_response: streams grounded text; emits card payloads; **never invents facts** —
                  response is only over messages + tool_results + retrieved_context
 always         : terminate → END (a small `finish` node records ai_run + events)
```

Config:

```python
llm = init_chat_model(settings.LLM_MODEL, provider=settings.LLM_PROVIDER, temperature=0.2)
checkpointer = AsyncPostgresSaver(engine)   # `langgraph` schema, thread_id=str(conversation_id)
graph = builder.compile(checkpointer=checkpointer, interrupt_after=..., ...)
# every invocation: config = {"configurable": {"thread_id": str(conversation_id)}, "tags": [...],
#                              "run_id": str(turn_id)}   # ⇒ trace == conversation thread
```

- **Persistence** gives automatic multi-turn memory (checkpoint per thread) and durable interrupts
  (server may restart with a paused approval pending; resume works after restart).
- **Fallback**: `InMemorySaver` for unit tests and if Supabase Postgres privileges are restricted.
- The LLM provider is configured via `LLM_PROVIDER`/`LLM_MODEL` + provider-specific keys, so a
  ChatOpenAI/Anthropic swap is a settings change, not code surgery.

## 6. MCP integration

### 6.1 Trusted-context architecture (the crux)

```python
# backend issues a short-lived, audience-scoped token per MCP call
actor_claims = {sub: str(customer_id), role: "CUSTOMER", act: "ai-agent",
                cid: str(conversation_id), scopes: ["orders:read","tickets:write",...],
                aud: "business-tools", exp: now + 60s, jti: str(turn_id)}
headers = {"Authorization": f"Bearer {mint(actor_claims)}"}
async with Client("http://127.0.0.1:8100/mcp", headers=headers) as client:
    await client.call_tool("get_order_status", {"order_number": "ORD1024"})
```

- Tool **schemas never ask for `customer_id`** — it can't be spearphished out of the LLM.
- mcp_server verifies signature + `aud` + TTL, then passes `Actor` (customer_id, role, scopes,
  conversation_id) into services, which re-check ownership AND positive authorization per resource.
- Defence in depth: even if a tool schema were misused, a superuser token is never in play;
  the AI's actor token carries narrow scopes and only its own conversation's id.

### 6.2 Tool surface (initial 8, structured outputs)

```python
# mcp_server/tools/…
get_order_info(order_number) -> OrderInfo        # access-checked read, includes shipment events
get_recent_orders(limit=10)  -> list[OrderSummary]
get_ticket(ticket_number)    -> TicketInfo
create_support_ticket(subject,category,description,order_number?) -> TicketCreated
check_return_eligibility(order_number) -> ReturnEligibility{eligible,reason,window_end}
create_return_request(order_number, reason, idempotency_key) -> ReturnCreated   # gated
cancel_order(order_number, reason, confirmation_id, idempotency_key) -> Cancelled  # gated
request_human_handover(conversation_id, reason, priority)        -> Handover
search_knowledge_base(query, top_k=4) -> list[KnowledgeHit]      # milestone 6
```

Server performs:

- Zod-equivalent (pydantic) argument validation — mcp SDK validates against the tool signature.
- Structured output models (no free strings when structure exists).
- Per-request `request_id` in logs; user-scoped DB access; graceful error frames
  (`isError` with sanitized message + error code, never stack traces).
- **No SQL tools. No LLM-generated filters.** Anything the model wants fulfilled maps to one of
  these fixed operations.

## 7. Security requirements

| Requirement       | Implementation                                                                                                                                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Password storage  | argon2id via `argon2-cffi`                                                                                                                                                                                           |
| Session           | JWT access (15 min) in-memory on the SPA + refresh rotation (7 d) in httpOnly, Secure, SameSite=Strict cookie; revocable by `session_version` claim                                                                  |
| AuthN             | `/api/v1/auth/*`; email/username unguessable errors (`401` uniform)                                                                                                                                                |
| AuthZ             | FastAPI dependency `require_role(...)`; **every customer-scoped repository query filters by `customer_id from token`, never from request body or LLM**                                                       |
| RBAC              | CUSTOMER / SUPPORT_AGENT / ADMIN; agents can read conversations/unassigned tickets; assignment updates limited to agent/admin; admin-only: users, knowledge, analytics, settings                                       |
| MCP               | Separate audience JWT per call (see §6), server verifies + adds `Actor`; mcp server binds `127.0.0.1` in dev, private network in compose/prod                                                                     |
| Input validation  | Pydantic strict mode at the boundary; Zod in the SPA; parameterized SQLAlchemy only                                                                                                                                    |
| PII out of traces | LangSmith off by default in dev (`LANGSMITH_TRACING=false`), send `tags` but strip `order_number`/addresses/phones from custom trace metadata; prompt/response **content capture disabled** in prod traces |
| Audit             | `audit_logs` for every sensitive mutation + escalation + approval, with actor + request_id                                                                                                                           |
| Rate limiting     | per-IP on auth; per-user 60 chat turns/15 min returns safe "too many requests" message (in-app counter, Redis later if needed)                                                                                         |
| Frontend          | No secrets in the SPA; only public-safe error envelopes                                                                                                                                                                |
| Headers           | `(HX                                                                                                                                                                                                                   |

Threat-model notes: prompt injection can only steer tool choice within a small allowlist; it cannot
escalate scope (token scopes fixed), produce unauthorized reads (server rechecks), or create
duplicates (idempotency keys).

## 8. Scalability & performance requirements

| Concern                               | Target / approach                                                                                                                            |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Concurrent chats (MVP)                | 50 without degradation; async SQLAlchemy + asyncpg, no blocking calls in the event loop                                                      |
| Chat latency                          | first token ≤ 2.5 s p50, ≤ 6 s p95 (warm); tool calls ≤ 2 s each                                                                          |
| Streaming                             | SSE keepalive; timeouts (LLM read 30 s, MCP 10 s, DB statement 15 s) configurable                                                            |
| DB at MVP scale (< 500k messages)     | single node; HNSW for vector search; no caching layer                                                                                        |
| Statelessness                         | app servers are stateless (session-in-JWT, graph state-in-Postgres) ⇒ horizontal scale at will                                              |
| Backpressure                          | bounded agent N (configurable), per-turn `asyncio.timeout`, cancel SSE on disconnect and mark turn interrupted (checkpoint enables resume) |
| Future levers (documented, not built) | Redis for rate-limit/cache, Celery/background queue for KB ingestion, pgBouncer for Supabase pooling                                         |

## 9. Reliability & error handling

- **Typed errors** bubble through FastAPI handlers to stable codes
  (`404 booking:not-found`, `403 booking:forbidden`, `409 duplicate-action`, `429 rate-limited`,
  `503 mcp-unavailable`, `503 model-unavailable`) with human-safe messages.
- Retries (tenacity-style): LLM read and idempotent MCP reads only, 2 attempts + jitter;
  never on mutations.
- **Idempotency**: муttations carry `idempotency_key`; UNIQUE constraint is the final guard.
- Degradation: if model provider is down → front gets `503 model-unavailable` + auto fallback note
  (offer to create a ticket without AI).
- Every `ai_run` records status/error/latency/tokens; failed → `errors` → escalate if ≥2 failed in
  a turn (chart "failed AI executions" reads this table).

## 10. Observability

- **Trace id** = `ai_runs.trace_id` (also injected into logs via contextvar). Logs (orjson-style
  JSON to stdout) include: ts, level, request_id, turn_id, event, latency_ms, model.
- **LangSmith**: env-driven; `LANGSMITH_PROJECT` differs for dev (resolveai-dev) vs prod
  (`-prod`). Custom `@traced` wrappers on: mcp client call, retrieval, graph nodes; `hide_inputs`
  for message bodies to avoid raw customer content in export tooling.
- Dashboard: Recharts reads `ai_runs`/`support_tickets` only. No fabricated data. Demo seed points
  are labeled.

## 11. Key technical decisions (ADR summary)

| Decision        | Choice                                                      | Rationale / rejected alternative                                                                                                                                                             |
| --------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth            | Custom JWT + argon2 (own backend)                           | Consistent dev/prod on Supabase Postgres; no lock-in to Supabase Auth. Rejected: Supabase Auth (roles/composition of CUSTOMER vs SUPPORT_AGENT vs ADMIN is domain-specific, custom is tiny). |
| MCP SDK version | official `mcp == 2.3.x`, MCPServer high-level API         | Get true protocol support + Streamable HTTP by default. Rejected: Steamless SSE transport (deprecated), hand-rolled HTTP.                                                                    |
| Tool exposure   | Only 8 fixed typed tools via MCP                            | Auditable surface; testable; injection-resistant. Rejected: dynamic codegen tools, SQL tool.                                                                                                 |
| HITL            | `interrupt()` + AsyncPostgresSaver                        | Durable, restart-safe, matches spec; no custom pause plumbing.                                                                                                                               |
| Vector store    | pgvector `vector(768)` + HNSW                             | One DB for everything; portability to Supabase Free; no FAISS.                                                                                                                               |
| Streaming       | SSE (StreamingResponse)                                     | Simpler than WebSocket; one-directional; easy`text/event-stream` in FastAPI.                                                                                                               |
| Frontend state  | TanStack Query + SSE for chat only                          | No global store needed at MVP scope (no Zustand/Redux).                                                                                                                                      |
| Dev DB          | Docker Compose Postgres 16+pgvector; zip-installer fallback | Mandatory `pgvector` extension. Skip Redis.                                                                                                                                                |
| Testing         | pytest + pytest-asyncio + HTTPX; Vitest/RTL                 | Standard; LLM faked in unit tests; live eval in M9.                                                                                                                                          |

## 12. Repository structure (canonical)

```
backend/app/
  api/v1/          routers.py per domain + dependencies.py (auth, rbac, pagination)
  core/            config.py(pydantic-settings), security.py(JWT/argon2), logging.py,
                   errors.py, exceptions.py, contextvars.py(trace ids), constants.py
  db/              base.py(Base, UUID pk mixin, ts mixin), session.py(async engine/scoped)
  models/          one file per aggregate: user.py, order.py, ticket.py, knowledge.py, ...
  schemas/         pydantic DTOs per domain
  repositories/    CRUD + query filters (all customer-scoped reads filtered here)
  services/        orders, tickets, returns, conversations, auth, analytics — pure logic
  agents/          state.py, graph.py, nodes/{intent,route,retrieve,tools,validate,
                   approval,compose,escalate,finish}.py, prompts/*.md, tools.py,
                   checkpointer.py, llm.py( provider factory), config.py
  mcp_client/      tools.py (typed async client wrapper), actor.py (JWT mint)
  mcp_server/      main.py(MCPServer), auth.py, tools/*.py, output models
  knowledge/       ingest.py, chunking.py, embeddings.py, retriever.py, routers
  observability/   logger.py, redaction.py, langsmith.py
frontend/src/
  app/{routes,providers,layout}  features/{auth,customer,agent,admin}
  components/{ui/shadcn/*, shared/*}   lib/{api,tanstack-query,sse,utils}   types/
```

## 13. Risks and mitigations

| Risk                                           | Impact               | Mitigation                                                                                                                                                       |
| ---------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MCP v2 API churn** (2.3 just released) | integration rework   | pin exact version; smoke-test server↔client in CI (M5); wrap in `mcp_client/` to keep blast radius small                                                      |
| Gemini tool-calling quality drift              | wrong tool selection | Tune per-tool system-prompt + few-shot in classify node; `evals/` dataset measured before release (M9); read-only tools + strict schemas minimize blast radius |
| Postgres checkpointer on Supabase limitations  | breaks resume        | `langgraph` schema + `InMemorySaver` runtime fallback flag; document pooler caveat (use session pooler or direct conn for saver)                             |
| Streaming + interrupt UX mismatch              | stuck UI             | Design SSE contract around 5 frame kinds (`token`, `card`, `turn_status: awaiting_confirmation`, `error`, `done`); resume is a normal POST             |
| Stale embeddings after doc edit                | wrong answers        | knowledge_documents.version + regenerate on update + only `status=ready` searchable                                                                            |
| Over-engineering                               | slows delivery       | skip Redis/microservices; horizontal scale documented, built later only if needed                                                                                |

---

*Status: proposed. Awaiting approval to begin implementation (Milestone 2).*
