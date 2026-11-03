# API Design — ResolveAI v1

Base URL: `/api/v1` · Auth: `Authorization: Bearer <access JWT>` (except `/auth/*`, `/healthz`)

## Conventions

- **Success**: data body or `{data, meta}` (lists carry `meta.pagination`).
- **Error**: `HTTP {code}` + `{code: <machine>, message: <human>, details?, request_id}`.
- **Idempotency**: mutating endpoints accept `Idempotency-Key` header (UUID) — stored in
  `idempotency_keys`; repeat → same response, no duplicate resource.
- **Pagination**: `?page=1&page_size=20` → `meta.pagination {page, page_size, total}`.
- **Streaming**: chat uses SSE (`text/event-stream`) with `frame` events
  (`turn_status[streaming|complete]` | `token` | `card` | `error` | `done`).
  `waiting_confirmation` / `escalated` arrive with the M5–M7 approval and escalation paths.

## Endpoints

```
HEALTH
GET   /healthz                          liveness (no auth, DB-less)
GET   /readyz                           readiness: database connectivity

AUTH
POST  /auth/register                    {email, password, full_name}            → 201 user+tokens
POST  /auth/login                       {email, password}                       → 200 {access, refresh, user}
POST  /auth/refresh                     (refresh cookie or body)                → 200 tokens (rotated)
POST  /auth/logout                                                              → 204
GET   /auth/me                          current {id, email, full_name, role, customer_id?}

ME (any authenticated)
PATCH /me                               {full_name?, phone?}                    → 200
GET   /me/addresses                     list
POST  /me/addresses
GET   /me/orders                        list mine (filters: status, q)
GET   /me/orders/:order_number          detail + shipment + items
GET   /me/tickets                       list mine
POST  /me/tickets                        direct creation (no agent) if desired
GET   /me/conversations                 list mine
POST  /me/conversations                 open new {subject, order_number?}
GET   /me/returns                       list mine
POST  /me/returns                       {order_number, reason_code, reason_text?} → 201 (idempotent)

RESS (role CUSTOMER)
POST  /conversations/:id/chat           SSE stream of one turn; body {message, turn_id}
                                        turn_id is client-generated and idempotent (retry replays)
POST  /conversations/:id/messages       {content} → append (used for clarify-only replies)
GET   /conversations/:id/messages       paginated transcript (customer: own; agent/admin: any)
POST  /conversations/:id/approvals      {turn_id, decision: granted|denied}     → resumes graph (interrupt path)
POST  /conversations/:id/escalate       {reason}                                → request human
GET   /returns/eligibility/:order_number deterministic eligibility preview (no mutation)

RESS (role SUPPORT_AGENT)
GET   /agent/stats                      compact dashboard aggregates (real data)
GET   /agent/conversations              queue (filters: mode, status, assigned, unassigned, q)
GET   /agent/conversations/:id          detail incl. customer, orders touched, tool summary
POST  /agent/conversations/:id/replies  {content} → agent message row (customer sees it)
POST  /agent/conversations/:id/assign   {agent_id?} unassign if body omitted
POST  /agent/conversations/:id/takeover flips mode ai→human (explicit, audited)
POST  /agent/conversations/:id/resolve  {resolution_note} closes; emits event
GET   /agent/tickets                    list (filters)
PATCH /agent/tickets/:ticket_number      {status?, priority?, assigned_agent_id?, resolution_note?}
POST  /agent/conversations/:id/reopen   re-enable AI (explicit action, audited)

RESD (role ADMIN)
GET   /admin/stats                      overview aggregates
GET   /admin/users                      list (filters role, active, q)
POST  /admin/users                      create (any role, sets password reset)
PATCH /admin/users/:id                   {full_name?, role?, is_active?}
POST  /admin/users/:id/reset-password   admin-initiated reset (sends no email in MVP)
GET   /admin/products                   list / POST create / PATCH :id
GET   /admin/orders                     list all / GET :id detail / PATCH :id status
GET   /admin/agents                     list agents + load
PATCH /admin/agents/:id                  {team?, is_active?}
GET   /admin/tickets                    all tickets (filters)
GET   /admin/knowledge                  list documents
POST  /admin/knowledge/upload           multipart: file+{title, category} → ingest async job
POST  /admin/knowledge/:id/regenerate   re-embed (bump version)
DELETE /admin/knowledge/:id             deactivate (soft) — chunks removed from search
GET   /admin/analytics/:dimension       date ranged aggregates:
                                        requests | resolutions | escalations | latency |
                                        failed-executions | categories
GET   /admin/ai-runs                    monitoring list (filters by status/trace_id)
                                        status: running|succeeded|failed|timeout|interrupted|escalated
GET   /admin/audit-logs                 searchable audit trail
GET   /admin/settings                   read-only env feature flags
```

## Representative payloads

```jsonc
// POST /conversations/:id/chat  →  SSE
// frame: data: {"type":"turn_status","value":"streaming"}
// frame: data: {"type":"token","value":"Your order #ORD-1024 "}
// frame: data: {"type":"card","kind":"order_status","data":{
//   "kind":"order_status","orderNumber":"ORD-1024","status":"shipped",
//   "carrier":"UPS","trackingNumber":"1Z999AA10123456784",
//   "estimatedDelivery":"2026-11-02T00:00:00+00:00",
//   "steps":[{"label":"Placed","at":"Oct 12","state":"done"},
//            {"label":"Shipped","at":"Oct 14","state":"done"},
//            {"label":"In transit","at":"Oct 14","state":"current"},
//            {"label":"Delivered","at":"Nov 2","state":"upcoming"}]}}
// frame: data: {"type":"turn_status","value":"complete"}
// frame: data: {"type":"done","turn_id":"…"}
//
// failure: {"type":"error","code":"turn_timeout|agent_error|model_unavailable","message":"…"}
//          followed by {"type":"done","turn_id":"…"}
//
// future (M5–M7): {"type":"card","kind":"approval_request","data":{…}} +
//                  {"type":"turn_status","value":"waiting_confirmation"}
```

```jsonc
// GET /me/orders/ORD-1024  200
{
  "order_number": "ORD-1024",
  "status": "shipped",
  "placed_at": "2026-10-12T10:04:00Z",
  "totals": {"subtotal": 8400, "shipping": 499, "tax": 714, "total": 9613, "currency": "USD"},
  "items": [{"sku":"LMP-AUR-01","name":"Aurora Desk Lamp","qty":1,"unit_price":8400}],
  "shipping_address": {"label":"Home","line1":"221 Lake St","city":"Portland","country":"US"},
  "shipment": {"carrier":"UPS","tracking":"1Z999AA10123456784","status":"in_transit",
               "estimated_delivery":"2026-11-02","events":[{"at":"2026-10-14T08:11:00Z",
               "desc":"Departed facility — Louisville KY"}]},
  "return_eligible": true,
  "return_window_end": "2026-11-11"
}
```

## Auth details

- Registering validates password complexity (min 10 chars, mixed classes).
- Access token claims: `sub` (user id), `role`, `customer_id?`, `session_version`, `exp`;
  refresh token cookie: `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`.
- Logout revokes by bumping `session_version` on user row (cheap, general).
- Frontend attaches `request_id` uuid per call (also stored in error bodies server-side).

## SSE contract

```
event: frame
data: {...one of the frame shapes above...}
```

Headers: `Cache-Control: no-cache`, `X-Accel-Buffering: no`, `Connection: keep-alive`.
Guards before the stream opens: customer role, conversation ownership, `mode == "ai"`, open status,
and a configured model — each failure is a normal JSON error response (`404` / `403` / `409` / `503`),
never a half-open stream.

Turn lifecycle:

1. `turn_status: streaming`
2. zero or more `token` frames (compose node only)
3. optional `card` frame (`{type, kind, data}`)
4. `turn_status: complete`
5. `done` with the `turn_id`

A replay of an already-persisted `turn_id` emits the stored reply and card, then `complete` + `done`,
without calling the model or writing a second assistant message. Server-side timeout
(`AGENT_TURN_TIMEOUT_SECONDS`) emits `error` + `done` and closes the `ai_runs` row as `timeout`;
a client disconnect records `interrupted` and leaves the checkpoint intact, so the next turn
continues the same thread.

Heartbeats (`event: ping`) are **not implemented yet** — turns are short-lived and buffering is
disabled on the proxy. If a future path streams idle waits (approvals), add a 15 s ping.
