import type { ReactElement, ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

import { AuthProvider } from "@/app/auth-context"
import type { Role, User } from "@/types"

const ROLE_PROFILES: Record<Role, Pick<User, "id" | "fullName" | "email" | "initials">> = {
  CUSTOMER: {
    id: "user-customer",
    fullName: "John Doe",
    email: "john.doe@email.com",
    initials: "JD",
  },
  SUPPORT_AGENT: {
    id: "user-agent",
    fullName: "Maya Fernandez",
    email: "maya.fernandez@resolveai.app",
    initials: "MF",
  },
  ADMIN: {
    id: "user-admin",
    fullName: "Alex Morgan",
    email: "alex.morgan@resolveai.app",
    initials: "AM",
  },
}

export function makeUser(role: Role): User {
  return {
    ...ROLE_PROFILES[role],
    role,
    ...(role === "CUSTOMER" ? { customerId: "customer-1" } : {}),
    ...(role === "SUPPORT_AGENT" ? { agentId: "agent-1" } : {}),
  }
}

interface ProviderOptions {
  role?: Role
  /** Set false when the component mounts its own router (e.g. `App`). */
  router?: boolean
  route?: string
}

export function renderWithProviders(
  ui: ReactElement,
  { role = "CUSTOMER", router = true, route = "/" }: ProviderOptions = {}
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })

  const content: ReactNode = router ? (
    <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
  ) : (
    ui
  )

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider initialUser={makeUser(role)}>{content}</AuthProvider>
    </QueryClientProvider>
  )
}
