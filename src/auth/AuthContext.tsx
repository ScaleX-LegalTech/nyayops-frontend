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
import { AUTH_LOGOUT_EVENT } from '@/lib/api/client'
import { clearTokens, getAccessToken, setDeviceToken, setTokens } from '@/lib/api/tokens'
import { decodeToken, isTokenExpired } from '@/lib/jwt'
import type { DecodedToken, LoginResponse } from '@/types'

interface AuthContextValue {
  user: DecodedToken | null
  isAuthenticated: boolean
  /** Today's is_org_admin - sees and manages every branch. */
  isManagingDirector: boolean
  /** Admin scoped to their own branch only. */
  isBranchAdmin: boolean
  branchId: string | null
  /** Persist tokens from a successful (second-step) login response. */
  setSession: (response: LoginResponse) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [token, setToken] = useState<string | null>(() => getAccessToken())

  const user = useMemo(() => {
    const decoded = decodeToken(token)
    return decoded && !isTokenExpired(decoded) ? decoded : null
  }, [token])

  const logout = useCallback(() => {
    clearTokens()
    setToken(null)
    queryClient.clear()
  }, [queryClient])

  const setSession = useCallback((response: LoginResponse) => {
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
      isManagingDirector: !!user?.is_org_admin,
      isBranchAdmin: !!user?.is_branch_admin,
      branchId: user?.bid ?? null,
      setSession,
      logout,
    }),
    [user, setSession, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
