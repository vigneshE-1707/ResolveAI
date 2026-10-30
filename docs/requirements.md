# Requirements — ResolveAI

**Version:** 1.0 · **Status:** Proposed (Milestone 1)

## 1. User roles

| Role | Persona | Access |
|---|---|---|
| **CUSTOMER** | Shopper of the demo e-commerce storefront | Own profile; own orders & shipments; own conversations/tickets; chat with AI; submit returns, cancellations, complaints; request human |
| **SUPPORT_AGENT** | Human customer support operator | Queue of escalated/open conversations; customer profile + order context; reply, assign, resolve; limited ticket management; no admin functions |
| **ADMIN** | Platform/ops administrator | Everything agents see (read-only conversations), plus: user mgmt, product/order mgmt, knowledge base mgmt, analytics, settings |

Role is stored on `users.role`; every request is authorized server-side via FastAPI dependency
`require_role(...)` — the frontend merely hides what users can't do (defense in depth).

## 2. Functional requirements

### 2.1 Auth (`F-AUTH`)
- Register (customer role only), login, logout, token refresh; get `me`.
- JWT access (15 min) + refresh (7 d, rotated); argon2id hashes.
- Duplicate email → `409`; wrong creds → `401` with identical message for unknown-email vs wrong-password.

### 2.2 Customer portal (`F-CUST`)
- Chat with AI assistant (SSE-streamed, tool-grounded); suggested questions; message history per
  conversation; rich card payloads for order status / ticket created / approval request; error &
  retry states; typing indicator.
- Conversations: list mine; reopen; PDF/text export deferred (post-MVP).
- Orders: list mine (paginated), detail w/ timeline of shipment events; “Where’s my order?” answered
  by agent tool use, not UI alone.
- Tickets: list mine; create via agent or direct form; track status; comment.
- Returns: check eligibility (deterministic service), submit request (after explicit confirmation).
- Escalation: explicit “connect me to a human” at any time.

### 2.3 Agent workspace (`F-AGENT`)
- Three-pane layout: conversation queue | transcript | customer/order/timeline context.
- Dashboards: totals for active/pending/resolved tickets, AI-handled vs escalated conversations,
  satisfaction figures (CSAT if captured; otherwise explicitly labeled “Not collected yet”).
- Reply to customer (message part in `conversations`; SSE pushes to customer tab).
- Assign/unassign, set status, resolve; add `resolution_note`.
- Review `escalation_reason` and the tool results/context the agent had.
- Explicitly take over → conversation `mode: ai → human` (blocks autonomous AI tool use).

### 2.4 Admin dashboard (`F-ADMIN`)
- Entity CRUD: users, customers, agents, products, orders (read + status fix), knowledge docs
  (upload/edit/deactivate; chunk regenerate), settings (read-only for MVP).
- Analytics: from real tables only — support request volume, AI resolution rate, escalation rate,
  avg first-response, avg ticket resolution time, active conversations, failed AI executions,
  category distribution. **Zero fabricated metrics.** Demo seed data explicitly labeled.
- Monitoring: recent `ai_runs` (latency, tokens, errors, trace_id link), escalation list,
  audit log search.

### 2.5 Agent behavior requirements (`F-AI`)
- Intent set (v1): `order_status`, `return_request`, `cancel_order`, `policy_qa`, `complaint`,
  `general_question`, `filter human_handoff`, `off_topic`.
- Must ground **every factual claim** in either tool output or retrieved knowledge chunk; refusal to
  invent policy; citation list surfaced for knowledge answers.
- Destructive ops (return request, order cancel) **always** paused at approval node.
- Max 2 sequential tool retries; on repeated failure or missing data → ask clarifying question; if
  still failed → escalate.
- Conversation mode gate: when mode ≠ `ai`, agent nodes short-circuit to polite handoff message.

## 3. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-1 | Backend: async I/O throughout; no blocking calls on the event loop |
| NFR-2 | p50 first-token ≤ 2.5 s, p95 ≤ 6 s (warm); SSE survives 60 s idle |
| NFR-3 | All state-changing ops idempotent (UNIQUE idempotency_key) |
| NFR-4 | Role-based authorization enforced server-side for every route |
| NFR-5 | Secrets only via env; none committed; `.env.example` documents fields |
| NFR-6 | PII (addresses, phones, full names, emails, message bodies) excluded or redacted from logs & traces |
| NFR-7 | Unit + integration coverage for business rules, auth, MCP auth, graph state, approvals (target ≥ 85% on `services/`+`agents/`) |
| NFR-8 | Public API error envelope stable: `{code, message, details?, request_id}`; never raw stack traces |
| NFR-9 | Migrations reversible; extension `pgvector` installable on Supabase |
| NFR-10 | Frontend responsive 360 → 1920; accessible (focus states, labelled controls, keyboard nav for chat) |
| NFR-11 | LLM provider pluggable via settings (`LLM_PROVIDER`) with no business-logic changes |
| NFR-12 | LangSmith off-by-default in dev (runs fine without a key), per-env project names |

## 4. MVP scope (definitive for v0→v1 demo)

**In scope**
1. Three-role auth + JWT + RBAC.
2. Customer: chat, conversations, orders, tickets, returns, human handover request.
3. Agent: dashboard, 3-pane workspace, reply/assign/status/resolve.
4. Admin: dashboards + management over entities + knowledge upload + analytics + monitoring.
5. AI: single LangGraph agent; intent; tool-calling; knowledge tool; clarify; approval gate; escalation.
6. MCP server with the 8 documented tools (read-only + gated mutations).
7. pgvector knowledge base (seeded: returns/refunds/shipping/cancellation/warranty/FAQ).
8. Analytics + monitoring views (real data).
9. Automated tests incl. AI eval harness; seed script; `.env.example`; docs; Docker Compose (M10).
10. Deployment trajectory: local Docker now, Supabase prod path documented.

**Deferred (explicitly out of MVP)**
- Redis, Celery, WebSocket realtime agent↔agent, WebRTC, multilingual UI, tenant onboarding,
  SSO/SAML, email/SMS notification channels, mobile apps, payment/refund gateway integration,
  file uploads in chat (images), RAG over *up to* 1k docs (we cap at ~50).

## 5. User journeys (happy paths)

### J1 — “Where is my order ORD-1024?”
Register/login → open Support → ask → SSE streams answer grounded in `shipments.log` →
OrderStatusCard in chat → follow-up “can I return it?” → eligibility tool → step-by-step confirm →
ReturnRequest created → ticket linked → all this appears in admin analytics.

### J2 — Human takeover
Agent can’t answer policy edge case → agent asks clarifying → still stuck →
`escalate_to_agent` → ticket created, conversation mode → `human_agent` → appears in agent queue →
agent replies in 3-pane → customer sees agent avatar + message → resolution recorded; escalation
appears in metrics.

### J3 — Policy question with citation
“What’s the refund window?” → `search_knowledge_base` top-4 chunks → answer summarised with
sources (doc title + section) → if no chunk ≥ threshold, agent honestly says it can’t find and
offers to create ticket.

### J4 — Admin shift review
Login → analytics: escalation spike detected → drill into `ai_runs` failures row → click
`trace_id` → LangSmith trace → see tool 429 rate limit → duplicate `order_number` in idempotency →
resolved product-side fix; audit log confirms no unauthorized access.
