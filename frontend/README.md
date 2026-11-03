# ResolveAI — Frontend

React 19 + TypeScript + Vite 8 + Tailwind 4 + shadcn/ui (new-york) + TanStack Query + Recharts.

Milestone 3 wired the app to the live FastAPI backend. Authentication, route guards, and the
customer/agent/admin data flows call the real API through a typed client (`src/lib/api/`); the few
surfaces without a backend counterpart are still backed by `src/mocks/data.ts` and are labelled
as demo data on screen. Milestone 4 connects the customer support chat to the SSE agent endpoint
and renders streamed tokens plus grounded order cards.

## Run

Node **≥ 22.12** is required (Vite 8). The repo pins a portable copy at `../.tools/node22`:

```powershell
$env:PATH = "$(Get-Location)\.tools\node22;$env:PATH"   # from the repo root
cd frontend
npm install
npm run dev        # http://localhost:5173 (proxies /api → 127.0.0.1:8000)
```

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | `tsc -b` + production bundle |
| `npm run typecheck` | Types only |
| `npm run test` / `npm run test:watch` | Vitest + Testing Library |
| `npm run lint` | oxlint |

## Structure

```
src/
  app/            # auth context + route guards, navigation config
  components/
    ui/           # shadcn primitives (new-york, Radix + cva)
    layout/       # AppShell, AppSidebar, TopNavbar, PageHeader, StatCard
    chat/         # HeroBanner, ChatPanel, ChatMessageBubble, stepper
    cards/        # OrderCard, TicketCard, CustomerProfileCard, timelines
    charts/       # Recharts wrappers
    feedback/     # EmptyState, ErrorState, skeletons
  features/
    customer/     # support console, orders, tickets, use-agent-chat (SSE)
    agent/        # dashboard, 3-pane workspace
    admin/        # overview, customers, orders, tickets, agents, KB, analytics, monitoring
    auth/         # login/register against the real API (RHF + Zod)
    shared/       # profile, settings, 404
  lib/
    api/          # typed fetch client (+ apiStream), endpoints, React Query hooks, mappers
    ...           # cn, formatters, status tone maps, env
  mocks/          # DEMO DATA ONLY — remaining labelled surfaces
  test/           # vitest setup + renderWithProviders helper
```

## Demo boundaries (read before extending)

- `src/lib/api/` owns every backend call: `client.ts` (fetch + refresh-on-401, plus `apiStream` /
  `parseSseBlock` for SSE), `endpoints.ts` (typed surface), `hooks.ts` (query keys, queries,
  mutations), `mappers.ts` (snake_case → camelCase). Keep wire types in `types.ts`; do not let
  snake_case leak into components.
- Access tokens live in memory only; the session is restored from the HttpOnly refresh cookie
  (`SameSite=strict`, path `/api/v1/auth`). Never persist tokens to `localStorage`.
- `features/customer/use-agent-chat.ts` streams real turns from `POST /conversations/:id/chat`.
  It keeps an optimistic local transcript while a turn is in flight and yields to the refetched
  server transcript once the message count catches up; `turn_id` is generated client-side so a
  retry of the same send never duplicates a turn. Draft threads create a conversation on first
  send.
- Streaming errors are shown in the assistant bubble (marked failed) rather than swallowed; the
  composer stays usable because the server always terminates with a `done` frame.
- `src/mocks/data.ts` now only backs the admin customer directory and the analytics charts; those
  screens show a visible **Demo data** badge.
- Actions with no backend support (e.g. customer ticket replies, notifications, session management)
  are disabled or show an honest note rather than pretending to persist.

## Verifying the chat

Start the backend with a Gemini key, sign in as the seeded customer
(`john.doe@email.com` / `ResolveAI#2026`), open `/support`, and ask
“Where is my order ORD-1024?”. Tokens should stream in and the order card should appear. Without
`GOOGLE_API_KEY` the stream fails with a visible 503 error and nothing is persisted.

## Conventions

- Function components and hooks; `import type` for type-only imports (`verbatimModuleSyntax`).
- Tokens come from `src/index.css` (`@theme inline`); compose classes with `cn()`.
- Keep pages dense: `text-[13px]` body, `rounded-xl` cards, `shadow-card`; no oversized padding.
- Route modules are lazily loaded in `src/App.tsx`; keep chart-heavy imports inside those pages.
