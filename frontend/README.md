# ResolveAI — Frontend

React 19 + TypeScript + Vite 8 + Tailwind 4 + shadcn/ui (new-york) + TanStack Query + Recharts.

Milestone 2 delivers the complete UI on **demo data**. No backend calls are made; every fixture lives
in `src/mocks/data.ts` and the demo boundary is signalled by `VITE_MODE` (`src/lib/env.ts`).

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
  app/            # role context (demo), navigation config
  components/
    ui/           # shadcn primitives (new-york, Radix + cva)
    layout/       # AppShell, AppSidebar, TopNavbar, PageHeader, StatCard
    chat/         # HeroBanner, ChatPanel, ChatMessageBubble, stepper
    cards/        # OrderCard, TicketCard, CustomerProfileCard, timelines
    charts/       # Recharts wrappers
    feedback/     # EmptyState, ErrorState, skeletons
  features/
    customer/     # support console, orders, tickets, use-demo-chat (M4 replace)
    agent/        # dashboard, 3-pane workspace
    admin/        # overview, customers, orders, tickets, agents, KB, analytics, monitoring
    auth/         # login/register (RHF + Zod, demo submission)
    shared/       # profile, settings, 404
  lib/            # cn, formatters, status tone maps, env
  mocks/          # DEMO DATA ONLY — delete/replace per milestone
  test/           # vitest setup
```

## Demo boundaries (read before extending)

- `src/mocks/data.ts` is the only fixture source. Feature code imports it directly for now; M3 swaps
  those imports for TanStack Query calls.
- `RoleProvider` (`src/app/role-context.tsx`) fakes sign-in by storing a role in `localStorage`. It is
  **not** authentication and must be replaced by the JWT-backed provider in Milestone 3.
- `features/customer/use-demo-chat.ts` fabricates replies with `setTimeout`. The composer, topbar, and
  footers label this as demo mode. Delete it in Milestone 4 when the SSE endpoint exists.
- Buttons whose action requires the backend (claim, resolve, export, invite, upload, invoice) show an
  informational toast that names the milestone instead of pretending to persist.

## Conventions

- Function components and hooks; `import type` for type-only imports (`verbatimModuleSyntax`).
- Tokens come from `src/index.css` (`@theme inline`); compose classes with `cn()`.
- Keep pages dense: `text-[13px]` body, `rounded-xl` cards, `shadow-card`; no oversized padding.
- Route modules are lazily loaded in `src/App.tsx`; keep chart-heavy imports inside those pages.
