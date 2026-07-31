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
import { AUTH_LOGOUT_EVENT, refreshTokens } from '@/lib/api/client'
import { clearTokens, getAccessToken, getRefreshToken, setDeviceToken, setTokens } from '@/lib/api/tokens'
import { decodeToken, isTokenExpired } from '@/lib/jwt'
import type { DecodedToken } from '@/types'

/** What setSession actually needs - satisfied by both LoginResponse (post-MFA/OTP
 * login) and TenantRegistrationResponse (auto-login right after registering). */
interface SessionTokens {
  access_token: string | null
  refresh_token: string | null
  device_token?: string | null
}

interface AuthContextValue {
  user: DecodedToken | null
  isAuthenticated: boolean
  /** True until the mount-time silent-refresh attempt (see AuthProvider) has
   * resolved - ProtectedRoute waits for this instead of bouncing to /login
   * on a merely-expired access token that a still-valid refresh token could
   * have renewed. */
  isInitializing: boolean
  /** Today's is_org_admin - sees and manages every branch. */
  isManagingDirector: boolean
  /** Admin scoped to their own branch only. */
  isBranchAdmin: boolean
  branchId: string | null
  /** Persist tokens from a successful login or registration response. */
  setSession: (response: SessionTokens) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [token, setToken] = useState<string | null>(() => getAccessToken())
  const [isInitializing, setIsInitializing] = useState(true)

  const user = useMemo(() => {
    const decoded = decodeToken(token)
    return decoded && !isTokenExpired(decoded) ? decoded : null
  }, [token])

  // The access token is short-lived by design; the refresh token is the one
  // meant to survive the browser being closed for days. Deciding "logged out"
  // straight off a merely-expired access token (as `user` above does, since
  // apiFetch's refresh-on-401 never gets a chance to run before ProtectedRoute
  // has already redirected) was throwing away a perfectly good week-long
  // session every time the access token's own short TTL had lapsed between
  // visits. Try one silent refresh first; only fall through to "logged out"
  // if that refresh is actually rejected (not just unreachable).
  useEffect(() => {
    let cancelled = false
    async function hydrate() {
      const decoded = decodeToken(getAccessToken())
      if (decoded && !isTokenExpired(decoded)) {
        setIsInitializing(false)
        return
      }
      if (!getRefreshToken()) {
        setIsInitializing(false)
        return
      }
      const outcome = await refreshTokens()
      if (cancelled) return
      if (outcome === 'success') setToken(getAccessToken())
      else if (outcome === 'invalidToken') clearTokens()
      // 'transientError' (offline/5xx): leave the stored refresh token alone -
      // the user sees the login screen for now, but the next launch (or the
      // next successful apiFetch call) gets to try refreshing again.
      setIsInitializing(false)
    }
    void hydrate()
    return () => {
      cancelled = true
    }
    // Runs once on mount only - a token change afterwards (login/logout) is
    // handled by setSession/logout/the forced-logout listener below, not this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const logout = useCallback(() => {
    clearTokens()
    setToken(null)
    queryClient.clear()
  }, [queryClient])

  const setSession = useCallback((response: SessionTokens) => {
    setTokens(response.access_token, response.refresh_token)
    if (response.device_token) setDeviceToken(response.device_token)
    setToken(response.access_token)
  }, [])

  useEffect(() => {
    const onForcedLogout = () => {
      setToken(null)
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
