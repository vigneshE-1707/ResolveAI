import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { useQueryClient } from "@tanstack/react-query"

import {
  getAccessToken,
  setAccessToken,
  setRefreshHandler,
} from "@/lib/api/client"
import { authApi, customerApi, type AuthSession } from "@/lib/api/endpoints"
import type { Role, User } from "@/types"

export type AuthStatus = "loading" | "authenticated" | "anonymous"

interface AuthContextValue {
  status: AuthStatus
  user: User | null
  role: Role | null
  login: (email: string, password: string) => Promise<User>
  register: (fullName: string, email: string, password: string) => Promise<User>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  updateProfile: (input: { fullName?: string; phone?: string }) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

interface AuthProviderProps {
  children: ReactNode
  /**
   * Test seam: pass a user to start authenticated, or `null` to start
   * anonymous without hitting the network. Production leaves this undefined
   * and the provider restores the session from the refresh cookie.
   */
  initialUser?: User | null
}

export function AuthProvider({ children, initialUser }: AuthProviderProps) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<AuthStatus>(
    initialUser === undefined ? "loading" : initialUser ? "authenticated" : "anonymous"
  )
  const [user, setUser] = useState<User | null>(initialUser ?? null)
  const settledRef = useRef(initialUser !== undefined)

  const applySession = useCallback((session: AuthSession) => {
    setAccessToken(session.accessToken)
    setUser(session.user)
    setStatus("authenticated")
    settledRef.current = true
  }, [])

  // Restore a session from the HttpOnly refresh cookie on first load.
  useEffect(() => {
    if (settledRef.current) return
    let cancelled = false

    authApi
      .refresh()
      .then((session) => {
        if (!cancelled) applySession(session)
      })
      .catch(() => {
        if (cancelled) return
        setAccessToken(null)
        // A concurrent login may already have authenticated the session.
        setStatus((current) => (current === "authenticated" ? current : "anonymous"))
        settledRef.current = true
      })

    return () => {
      cancelled = true
    }
  }, [applySession])

  // Let the fetch client refresh a token transparently on a 401.
  useEffect(() => {
    setRefreshHandler(async () => {
      try {
        const session = await authApi.refresh()
        applySession(session)
        return session.accessToken
      } catch {
        setAccessToken(null)
        setUser(null)
        setStatus("anonymous")
        return null
      }
    })
    return () => setRefreshHandler(null)
  }, [applySession])

  const login = useCallback(
    async (email: string, password: string) => {
      const session = await authApi.login(email, password)
      applySession(session)
      return session.user
    },
    [applySession]
  )

  const register = useCallback(
    async (fullName: string, email: string, password: string) => {
      const session = await authApi.register(email, password, fullName)
      applySession(session)
      return session.user
    },
    [applySession]
  )

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // The cookie may already be expired; clear local state regardless.
    }
    setAccessToken(null)
    setUser(null)
    setStatus("anonymous")
    queryClient.clear()
  }, [queryClient])

  const refreshUser = useCallback(async () => {
    const me = await authApi.me()
    setUser(me)
  }, [])

  const updateProfile = useCallback(
    async (input: { fullName?: string; phone?: string }) => {
      await customerApi.updateProfile(input)
      const me = await authApi.me()
      setUser(me)
    },
    []
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      role: user?.role ?? null,
      login,
      register,
      logout,
      refreshUser,
      updateProfile,
    }),
    [status, user, login, register, logout, refreshUser, updateProfile]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within an AuthProvider")
  return context
}

/**
 * Compatibility hook for existing pages: they only need the signed-in role and
 * user. Throws if called outside an authenticated route so callers can keep
 * `user` non-nullable.
 */
export function useRole(): { role: Role; user: User } {
  const { status, role, user } = useAuth()
  if (status !== "authenticated" || !role || !user) {
    throw new Error("useRole requires an authenticated session")
  }
  return { role, user }
}

export function useAccessToken() {
  return getAccessToken()
}
