import { lazy, Suspense, type ReactNode } from "react"
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom"

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

const router = createBrowserRouter([
  { path: "/login", element: withFallback(<LoginPage />) },
  { path: "/register", element: withFallback(<RegisterPage />) },
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/support" replace /> },

      // Customer portal
      { path: "support", element: withFallback(<CustomerSupportPage />) },
      { path: "orders", element: withFallback(<CustomerOrdersPage />) },
      { path: "orders/:orderNumber", element: withFallback(<CustomerOrderDetailPage />) },
      { path: "tickets", element: withFallback(<CustomerTicketsPage />) },
      { path: "tickets/:ticketNumber", element: withFallback(<CustomerTicketDetailPage />) },

      // Agent workspace
      { path: "agent", element: withFallback(<AgentDashboardPage />) },
      { path: "agent/conversations", element: withFallback(<AgentWorkspacePage />) },
      { path: "agent/conversations/:conversationId", element: withFallback(<AgentWorkspacePage />) },
      { path: "agent/tickets", element: withFallback(<AgentTicketsPage />) },

      // Admin
      { path: "admin", element: withFallback(<AdminOverviewPage />) },
      { path: "admin/customers", element: withFallback(<AdminCustomersPage />) },
      { path: "admin/orders", element: withFallback(<AdminOrdersPage />) },
      { path: "admin/tickets", element: withFallback(<AdminTicketsPage />) },
      { path: "admin/agents", element: withFallback(<AdminAgentsPage />) },
      { path: "admin/knowledge", element: withFallback(<AdminKnowledgePage />) },
      { path: "admin/analytics", element: withFallback(<AdminAnalyticsPage />) },
      { path: "admin/monitoring", element: withFallback(<AdminMonitoringPage />) },

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
