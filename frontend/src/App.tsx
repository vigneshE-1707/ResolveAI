import { lazy, Suspense, type ReactNode } from "react"
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom"

import { useAuth } from "@/app/auth-context"
import { homePath } from "@/app/navigation"
import { RequireAuth, RequireRole } from "@/app/route-guards"
import { AppShell } from "@/components/layout/app-shell"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Route-level code splitting: the shell and shared UI stay in the entry chunk,
 * while each portal page (and its charts) is fetched on first visit.
 */
function RouteFallback() {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading page…</span>
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-4 w-80" />
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
}

const CustomerSupportPage = lazy(() =>
  import("@/features/customer/customer-support-page").then((m) => ({ default: m.CustomerSupportPage }))
)
const CustomerOrdersPage = lazy(() =>
  import("@/features/customer/customer-orders-page").then((m) => ({ default: m.CustomerOrdersPage }))
)
const CustomerOrderDetailPage = lazy(() =>
  import("@/features/customer/customer-order-detail-page").then((m) => ({
    default: m.CustomerOrderDetailPage,
  }))
)
const CustomerTicketsPage = lazy(() =>
  import("@/features/customer/customer-tickets-page").then((m) => ({ default: m.CustomerTicketsPage }))
)
const CustomerTicketDetailPage = lazy(() =>
  import("@/features/customer/customer-ticket-detail-page").then((m) => ({
    default: m.CustomerTicketDetailPage,
  }))
)

const AgentDashboardPage = lazy(() =>
  import("@/features/agent/agent-dashboard").then((m) => ({ default: m.AgentDashboardPage }))
)
const AgentTicketsPage = lazy(() =>
  import("@/features/agent/agent-dashboard").then((m) => ({ default: m.AgentTicketsPage }))
)
const AgentWorkspacePage = lazy(() =>
  import("@/features/agent/agent-workspace").then((m) => ({ default: m.AgentWorkspacePage }))
)

const AdminOverviewPage = lazy(() =>
  import("@/features/admin/admin-overview-page").then((m) => ({ default: m.AdminOverviewPage }))
)
const AdminCustomersPage = lazy(() =>
  import("@/features/admin/admin-customers-page").then((m) => ({ default: m.AdminCustomersPage }))
)
const AdminOrdersPage = lazy(() =>
  import("@/features/admin/admin-orders-page").then((m) => ({ default: m.AdminOrdersPage }))
)
const AdminTicketsPage = lazy(() =>
  import("@/features/admin/admin-tickets-page").then((m) => ({ default: m.AdminTicketsPage }))
)
const AdminAgentsPage = lazy(() =>
  import("@/features/admin/admin-agents-page").then((m) => ({ default: m.AdminAgentsPage }))
)
const AdminKnowledgePage = lazy(() =>
  import("@/features/admin/admin-knowledge-page").then((m) => ({ default: m.AdminKnowledgePage }))
)
const AdminAnalyticsPage = lazy(() =>
  import("@/features/admin/admin-analytics-page").then((m) => ({ default: m.AdminAnalyticsPage }))
)
const AdminMonitoringPage = lazy(() =>
  import("@/features/admin/admin-monitoring-page").then((m) => ({ default: m.AdminMonitoringPage }))
)

const ProfilePage = lazy(() =>
  import("@/features/shared/profile-page").then((m) => ({ default: m.ProfilePage }))
)
const SettingsPage = lazy(() =>
  import("@/features/shared/settings-page").then((m) => ({ default: m.SettingsPage }))
)

const LoginPage = lazy(() =>
  import("@/features/auth/login-page").then((m) => ({ default: m.LoginPage }))
)
const RegisterPage = lazy(() =>
  import("@/features/auth/register-page").then((m) => ({ default: m.RegisterPage }))
)
const NotFoundPage = lazy(() =>
  import("@/features/shared/not-found-page").then((m) => ({ default: m.NotFoundPage }))
)

const withFallback = (node: ReactNode) => <Suspense fallback={<RouteFallback />}>{node}</Suspense>

const customerOnly = (node: ReactNode) =>
  withFallback(<RequireRole roles={["CUSTOMER"]}>{node}</RequireRole>)

const staffOnly = (node: ReactNode) =>
  withFallback(<RequireRole roles={["SUPPORT_AGENT", "ADMIN"]}>{node}</RequireRole>)

const adminOnly = (node: ReactNode) =>
  withFallback(<RequireRole roles={["ADMIN"]}>{node}</RequireRole>)

function HomeRedirect() {
  const { role } = useAuth()
  return <Navigate to={role ? homePath[role] : "/login"} replace />
}

/** Signed-in users should not sit on the sign-in screens. */
function GuestOnly({ children }: { children: ReactNode }) {
  const { status, role } = useAuth()
  if (status === "authenticated" && role) return <Navigate to={homePath[role]} replace />
  return <>{children}</>
}

const router = createBrowserRouter([
  { path: "/login", element: withFallback(<GuestOnly><LoginPage /></GuestOnly>) },
  { path: "/register", element: withFallback(<GuestOnly><RegisterPage /></GuestOnly>) },
  {
    path: "/",
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <HomeRedirect /> },

      // Customer portal
      { path: "support", element: customerOnly(<CustomerSupportPage />) },
      { path: "orders", element: customerOnly(<CustomerOrdersPage />) },
      { path: "orders/:orderNumber", element: customerOnly(<CustomerOrderDetailPage />) },
      { path: "tickets", element: customerOnly(<CustomerTicketsPage />) },
      { path: "tickets/:ticketNumber", element: customerOnly(<CustomerTicketDetailPage />) },

      // Agent workspace
      { path: "agent", element: staffOnly(<AgentDashboardPage />) },
      { path: "agent/conversations", element: staffOnly(<AgentWorkspacePage />) },
      { path: "agent/conversations/:conversationId", element: staffOnly(<AgentWorkspacePage />) },
      { path: "agent/tickets", element: staffOnly(<AgentTicketsPage />) },

      // Admin
      { path: "admin", element: adminOnly(<AdminOverviewPage />) },
      { path: "admin/customers", element: adminOnly(<AdminCustomersPage />) },
      { path: "admin/orders", element: adminOnly(<AdminOrdersPage />) },
      { path: "admin/tickets", element: adminOnly(<AdminTicketsPage />) },
      { path: "admin/agents", element: adminOnly(<AdminAgentsPage />) },
      { path: "admin/knowledge", element: adminOnly(<AdminKnowledgePage />) },
      { path: "admin/analytics", element: adminOnly(<AdminAnalyticsPage />) },
      { path: "admin/monitoring", element: adminOnly(<AdminMonitoringPage />) },

      // Shared
      { path: "profile", element: withFallback(<ProfilePage />) },
      { path: "settings", element: withFallback(<SettingsPage />) },
    ],
  },
  { path: "*", element: withFallback(<NotFoundPage />) },
])

export function App() {
  return <RouterProvider router={router} />
}
