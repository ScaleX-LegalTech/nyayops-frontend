import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ApiError, AUTH_LOGOUT_EVENT, logout as logoutRequest } from '@/lib/api/client'
import { getMe } from '@/lib/api/profile'
import { setDeviceToken } from '@/lib/api/tokens'
import type { User } from '@/types'

/** What setSession actually needs - satisfied by both LoginResponse (post-MFA/OTP
 * login) and TenantRegistrationResponse (auto-login right after registering).
 * access_token/refresh_token are no longer read here at all (both already
 * landed in httpOnly cookies via this same response's Set-Cookie headers,
 * before this JSON body was even parsed) - kept in the type only so callers
 * can keep passing the raw API response object unchanged. */
interface SessionTokens {
  access_token: string | null
  refresh_token: string | null
  device_token?: string | null
}

/** Mirrors the old JWT-decoded claim shape exactly (same field names,
 * including `sub`) so the ~11 call sites elsewhere reading `useAuth().user`
 * don't need to change at all - only how this gets populated changed. */
interface AuthUser {
  sub: string
  email?: string
  is_org_admin?: boolean
  is_branch_admin?: boolean
  bid?: string | null
}

function toAuthUser(u: User): AuthUser {
  return {
    sub: u.id,
    email: u.email,
    is_org_admin: u.is_org_admin,
    is_branch_admin: u.is_branch_admin,
    bid: u.branch_id,
  }
}

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  /** True until the mount-time identity fetch (see AuthProvider) has
   * resolved - ProtectedRoute waits for this instead of bouncing to /login
   * while a still-valid session cookie is still being checked. */
  isInitializing: boolean
  /** Today's is_org_admin - sees and manages every branch. */
  isManagingDirector: boolean
  /** Admin scoped to their own branch only. */
  isBranchAdmin: boolean
  branchId: string | null
  /** Called after a successful login/registration response. */
  setSession: (response: SessionTokens) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)

  // Both tokens are httpOnly cookies now - there's nothing left to decode
  // client-side, so identity comes from asking the server. getMe() goes
  // through apiFetch, whose existing 401-refresh-retry logic already covers
  // "access cookie expired but refresh cookie still valid" transparently
  // underneath this one call - no bespoke refresh-then-fetch dance needed.
  useEffect(() => {
    let cancelled = false
    getMe()
      .then((u) => {
        if (!cancelled) setUser(toAuthUser(u))
      })
      .catch((err) => {
        // A 401 here (or ApiError(0, ...) if the server was unreachable)
        // just means no valid session - stay logged out, nothing to surface.
        // Anything else is unexpected (not an auth outcome) - worth a console
        // log for visibility, but still shouldn't crash the app.
        if (!(err instanceof ApiError)) console.error('Failed to load session', err)
      })
      .finally(() => {
        if (!cancelled) setIsInitializing(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const logout = useCallback(async () => {
    await logoutRequest()
    setUser(null)
    queryClient.clear()
  }, [queryClient])

  const setSession = useCallback(async (response: SessionTokens) => {
    if (response.device_token) setDeviceToken(response.device_token)
    const me = await getMe()
    setUser(toAuthUser(me))
  }, [])

  useEffect(() => {
    const onForcedLogout = () => {
      setUser(null)
      queryClient.clear()
    }
    window.addEventListener(AUTH_LOGOUT_EVENT, onForcedLogout)
    return () => window.removeEventListener(AUTH_LOGOUT_EVENT, onForcedLogout)
  }, [queryClient])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isInitializing,
      isManagingDirector: !!user?.is_org_admin,
      isBranchAdmin: !!user?.is_branch_admin,
      branchId: user?.bid ?? null,
      setSession,
      logout,
    }),
    [user, isInitializing, setSession, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
