import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"

import { portalUsers } from "@/mocks/data"
import type { Role, User } from "@/types"

const STORAGE_KEY = "resolveai.demo.role"
const ROLES: Role[] = ["CUSTOMER", "SUPPORT_AGENT", "ADMIN"]

interface RoleContextValue {
  role: Role
  user: User
  setRole: (role: Role) => void
}

const RoleContext = createContext<RoleContextValue | null>(null)

function readStoredRole(): Role {
  if (typeof window === "undefined") return "CUSTOMER"
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return ROLES.includes(stored as Role) ? (stored as Role) : "CUSTOMER"
}

/**
 * Demo-only role switcher. In production the role comes from the verified JWT
 * (Milestone 3); this context is replaced by the auth provider then.
 */
export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(readStoredRole)

  const setRole = useCallback((next: Role) => {
    setRoleState(next)
    window.localStorage.setItem(STORAGE_KEY, next)
  }, [])

  const value = useMemo(
    () => ({ role, user: portalUsers[role], setRole }),
    [role, setRole]
  )

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
}

export function useRole() {
  const ctx = useContext(RoleContext)
  if (!ctx) throw new Error("useRole must be used inside <RoleProvider>")
  return ctx
}

export const roleLabel: Record<Role, string> = {
  CUSTOMER: "Customer",
  SUPPORT_AGENT: "Support agent",
  ADMIN: "Administrator",
}
