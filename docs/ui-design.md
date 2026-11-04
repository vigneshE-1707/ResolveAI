# UI/UX Design — ResolveAI

**Note:** the working directory and drives contain **no `design-reference.png`**. This design is
derived from the written design brief (palette, style, component list). Please supply the reference
image before Milestone 2 so visuals can be matched closely.

## 1. Design direction

Premium SaaS look: dark navy sidebar + light content, indigo–violet accents, white cards on a soft
`#F8FAFC` canvas, compact information-dense layouts. Typography Inter (or system fallback); numeric
data in tabular-nums.

### Palette (final tokens, Tailwind 4 `@theme`)

```css
--color-primary:    #4F46E5;   /* indigo-600 — primary actions, focus */
--color-primary-600:#4338CA;
--color-accent:     #7C3AED;   /* violet — gradients, secondary highlights */
--color-sidebar:    #111827;   /* gray-900 — sidebar base */
--color-sidebar-hover:#1F2937;
--color-bg:         #F8FAFC;   /* slate-50 */
--color-surface:    #FFFFFF;
--color-border:     #E2E8F0;   /* slate-200 */
--color-text:       #0F172A;   /* slate-900 */
--color-text-muted: #64748B;   /* slate-500 */
--color-success:    #10B981;   --color-warning: #F59E0B;   --color-error: #EF4444;   --color-info:  #3B82F6;
```

Supporting shades generated from Tailwind scales (indigo/violet 50–900, slate 50–900, semantic
50/100/600/700). Gradients: `linear-gradient(135deg, #4F46E5, #7C3AED)` for hero stats/brand marks.

### Typography scale (Inter)

- Display 28/36 semibold (page titles) · h1 22/30 semibold · h2 18/26 semibold
- h3 15/22 medium · body 14/20 regular · small 13/18 · micro 12/16
- Chart labels 12; monospace (JetBrains Mono fallback) for IDs/tracking numbers.

### Shape & motion

Radius: cards 12px (rounded-xl), buttons/inputs 8px, badges 6px, avatars full.
Shadows: `sm 0 1px 2px rgba(15,23,42,.06)` cards, `md` dropdowns, focus ring
`0 0 0 3px rgba(79,70,229,.15)`.
Motion: 150–200ms ease-out for hover/focus; skeleton pulse; no gratuitous animation.

## 2. Layout system

**Shell (all three portals):**

```
┌──────────┬─────────────────────────────────────────────┐
│ Sidebar  │ TopNavbar (breadcrumb / search / bell / us) │
│ 256px    ├─────────────────────────────────────────────┤
│ fixed    │ Content (pad 24, max-w 1440 centered)       │
│ dark     │                                             │
└──────────┴─────────────────────────────────────────────┘
```

- Sidebar collapses to icon rail < 1024px, drawer < 768px.
- Spacing rhythm: 4/8/12/16/24; cards use stack of 12–16px between elements — dense but readable.
- Responsive: chat becomes full-screen with list drawer; 3-pane agent view stacks to 2 panes.

## 3. Screens & IA

### Portal A — Customer (`/`)
| Route | Purpose |
|---|---|
| `/login`, `/register` | Split hero panel w/ gradient art + form card |
| `/` | Home: recent orders strip, open tickets, quick “Ask ResolveAI” launcher, recent conversations |
| `/orders` | Grid/list of order cards w/ status badge, thumbnail, total, delivery ETA; filter by status |
| `/orders/:number` | Detail: status stepper, shipment timeline, items, totals, “Get help with this order” |
| `/support` | Chat UI (below) |
| `/support/:id` | Full conversation view (same component, scroll to bottom) |
| `/tickets`, `/tickets/:number` | List + detail with status/priority, timeline, reply box |
| `/profile` | Profile, addresses, password change |

**Chat layout:** left rail (conversation list, collapsible) | center chat | right rail context
(order/ticket cards when present). Center: message list + composer with suggestions chips when
empty. Right rail hidden on mobile.

### Portal B — Agent (`/agent`)
| Route | Purpose |
|---|---|
| `/agent` | Dashboard: stat row (open, pending, resolved today, AI-handled, escalated, CSAT), escalation feed, my assigned |
| `/agent/conversations` | Queue + filters |
| `/agent/conversations/:id` | **3-pane workspace**: queue | transcript with tool-call/system events collapses | customer profile + related orders + activity timeline |
| `/agent/tickets`, `/agent/tickets/:number` | Ticket management |
| `/agent/analytics` | Same charts as admin but scoped to “my” data (uses same AnalyticsChart components) |

### Portal C — Admin (`/admin`, admin + some pages for agent-lead)
| Route | Purpose |
|---|---|
| `/admin` | Overview: KPI row + volume trend, category breakdown (donut), escalation rate (area), latency p50/p95 (combo) |
| `/admin/users` | Table + drawer detail + role change dialog |
| `/admin/orders` | Table + detail drawer |
| `/admin/products` | Table CRUD |
| `/admin/agents` | List + workload |
| `/admin/knowledge` | Upload (drag&drop, category) + document table w/ status badges (processing/ready/failed) + regenerate |
| `/admin/analytics` | Full reporting |
| `/admin/monitoring` | ai_runs table + trace_id links, recent errors |
| `/admin/settings` | Read-only env/feature info |

## 4. Component inventory (`frontend/src/components`)

| Component | Notes |
|---|---|
| `layout/AppSidebar` | dark; sections per role; active state accent bar; badges on counters |
| `layout/TopNavbar` | breadcrumbs, global search (agent/admin), notification bell, avatar menu |
| `layout/PageHeader` | title + actions + subtitle |
| `layout/StatCard` | label, value (+/- 24h delta), icon tone; gradient variant for KPIs |
| `layout/DataToolbar` | search, filters, sort |
| `layout/DataStatusTabs`? | n/a — status filter chips |
| `layout/DataTable` | tanstack table, loading skeleton, empty state, pagination |
| `chat/ChatWindow` | list + composer + scroll anchoring + SSE hook wiring |
| `chat/ChatMessage` | role styles (user emerald/sky tint, assistant white card w/ avatar, agent violet) |
| `chat/MessageComposer` | textarea autosize, send button, disabled state while streaming |
| `chat/TypingIndicator` | animated dots |
| `chat/SuggestedQuestions` | chips |
| `cards/CustomerProfileCard` | avatar, name, tier, since, quick actions |
| `cards/OrderStatusCard` | status badge, eta, tracking monospace, mini timeline |
| `cards/TicketCard` | number, status/priority badge, category, age |
| `cards/ApprovalRequestCard` | action summary + **Confirm / Cancel** (emits POST /approvals) |
| `cards/ShipmentTimeline` | vertical event feed |
| `lists/ConversationList` | grouped preview items, unread dot, timestamp |
| `lists/ActivityTimeline` | events w/ icons + actor labels |
| `badges` | `AgentStatusBadge`, generic `StatusBadge` (color map), `PriorityBadge` |
| `charts/AnalyticsChart` | Recharts wrappers: LineChartCard, AreaChartCard, BarChartCard, DonutChartCard |
| `feedback/EmptyState` / `ErrorState` / `LoadingSkeleton` / `ConfirmationDialog` | shared |

## 5. Demo-data boundary (Milestone 2)

```
frontend/src/mocks/    # ONLY place mock data lives
  data.ts, handlers.ts, README.md
```

- Pages under M2 consume `mocks/` exclusively; imports of `mocks` in feature code must be replaced
  by real API calls in M3/M8 — lint rule `no-restricted-imports` added in M3 to enforce this.
- A `Demo` badge chip renders in the top navbar when `VITE_MODE=demo`, clearly signaling preview data.
- No mock data ever simulates “AI intelligence”, MCP tool output, or analytics beyond simple shapes.

## 6. Accessibility & UX details

- Focus-visible ring on all interactives; skip-link; semantic headings per page.
- Forms: React Hook Form + Zod; inline error text tied to control; disabled submit on invalid.
- Color never sole signal (badges pair color + text/icon).
- Chat: message list keyboard-navigable, focus transfer on assistant reply, `aria-live=polite`.
- Density mode toggle (comfortable / compact) for agent dashboard later — infrastructure reserved,
  not built in MVP.

## 7. Implementation status after Milestone 2

Delivered under `frontend/`; `npm run build`, `npm run test` (7 files / 27 tests), and `npm run lint`
(0 warnings) pass. Covered by tests: routing smoke (lazy chunks + 404), currency/percent/latency
formatters, StatCard/TicketCard rendering, order filtering, admin KPI derivation from the demo series,
and the demo-chat hook (reply delay, blank input, per-conversation transcript isolation).

**Toolchain actually installed:** Vite 8.3.5 (Rolldown), React 19.3.1, TypeScript 7.0.2, Tailwind 4.3.3,
React Router 7.18, TanStack Query 5.105, Recharts 3.10, RHF 7.91 + Zod 4.6, Vitest 5.0.5 + jsdom,
shadcn `new-york` primitives (Radix) written locally, `oxlint`.

**Component names as built** (mapping to §4):

| §4 name | As built |
|---|---|
| ChatWindow | `chat/chat-panel.tsx` → `ChatPanel` (chat / tickets / order-lookup tabs) + `ConversationList` |
| ChatMessage + Composer + TypingIndicator | `chat/chat-message.tsx` → `ChatMessageBubble`, `MessageComposer`, `TypingIndicator` |
| OrderStatusCard | `chat/order-tracking-stepper.tsx` → `InlineOrderCard` + `OrderTrackingStepper` |
| OrderCard (customer/admin lists) | `cards/order-card.tsx` |
| AnalyticsChart | `charts/chart-cards.tsx` → `ChartCard` + area/bar/donut/line wrappers |
| Lists (ConversationList / ActivityTimeline) | `ConversationList` in `chat/chat-panel.tsx`; `cards/activity-timeline.tsx` → `ActivityTimeline` |
| badges | `shared/status-badge.tsx` + `lib/status.ts` tone maps |
| feedback | `feedback/states.tsx` → `EmptyState`, `ErrorState`, `TableSkeleton`, `CardGridSkeleton` |
| Demo hero | `chat/hero-banner.tsx` (reference-matching gradient hero with SVG assistant mark) |

**Deviations from this document, with reasons:**

1. **No TanStack Table / DataTable abstraction.** Admin tables are plain semantic `<table>` via the
   shadcn `Table` primitive. Sorting/pagination/column pinning is not needed until real paginated
   APIs exist (M3/M9); adding the abstraction now would be speculative.
2. **No separate `mocks/handlers.ts`.** All fixtures live in `mocks/data.ts`; there is no MSW layer
   because no component performs HTTP in M2. `frontend/src/mocks/README.md` is not present — the
   boundary is documented in the file header and in `lib/env.ts` (`isDemoMode`).
3. **Routing is one shell + role-based nav** instead of three duplicated shells. The role comes from
   a local demo `RoleProvider` (`localStorage: resolveai.demo.role`); M3 replaces it with the auth
   provider. This avoids maintaining three nav trees and makes the role preview trivial.
4. **Chat replies are a local simulator** (`features/customer/use-demo-chat.ts`) that pattern-matches
   canned text against fixtures. It is explicitly labelled "Demo mode" in the composer footer, in the
   topbar badge, and in code comments; it is deleted in M4 when SSE lands.
5. **`/agent/conversations/:conversationId` is a client route** (no API), and Claim/Resolve/Reassign
   buttons raise informational toasts rather than mutating state — deliberately, so no screen implies
   persistence that does not exist.
6. **Skip-link and `aria-live` on the transcript are not implemented yet.** Focus-visible rings,
   labelled controls, `aria-busy` route fallback, and icon+text status badges are in place. The
   remaining a11y items are scheduled with the M4 chat rewrite, when the message list gains a
   streaming region worth announcing.
7. **Dark mode is not built** (light-only, as scoped); the settings page shows it as a future option.
8. **Route names differ from §3 for two planned pages.** `/admin/users` ships as `/admin/customers`
   (the entity is a customer, not a system user) and there is no `/admin/products` yet — product
   management belongs to the Milestone 3 catalogue work. `/admin/settings` folded into the shared
   `/settings` page, and the customer portal keeps one `/support` console instead of `/support/:id`
   (the conversation list switches the transcript client-side, as the reference does).

**Known limitations at this milestone:** bundle has no vendor splitting (entry ≈ 502 kB / 158 kB gzip,
route chunks are split); charts render from fixtures only; no offline/error states wired to a network
because there is no network yet.
