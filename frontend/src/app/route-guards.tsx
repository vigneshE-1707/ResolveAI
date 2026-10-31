import type { ReactNode } from "react"
import { Navigate, useLocation } from "react-router-dom"

import { useAuth } from "@/app/auth-context"
import { homePath } from "@/app/navigation"
import { Skeleton } from "@/components/ui/skeleton"
import type { Role } from "@/types"

function AuthLoading() {
  return (
    <div
      className="flex min-h-svh items-center justify-center bg-background"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Restoring your session…</span>
      <div className="w-full max-w-sm space-y-3">
        <Skeleton className="mx-auto size-11 rounded-xl" />
        <Skeleton className="mx-auto h-5 w-40" />
        <Skeleton className="h-3 w-56 mx-auto" />
      </div>
    </div>
  )
}

/** Blocks anonymous visitors and sends them to sign-in with a return path. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const location = useLocation()

  if (status === "loading") return <AuthLoading />
  if (status === "anonymous") {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    )
  }
  return <>{children}</>
}

/**
 * Restricts a route to specific roles. A signed-in user with another role is
 * sent to their own portal home instead of seeing a forbidden screen.
 */
export function RequireRole({
  roles,
  children,
}: {
  roles: Role[]
  children: ReactNode
}) {
  const { status, role } = useAuth()

  if (status === "loading") return <AuthLoading />
  if (status === "anonymous" || !role) return <Navigate to="/login" replace />
  if (!roles.includes(role)) return <Navigate to={homePath[role]} replace />
  return <>{children}</>
}
