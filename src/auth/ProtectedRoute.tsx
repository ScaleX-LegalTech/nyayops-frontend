import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function ProtectedRoute() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}

/** Branches are Managing-Director-only; the server enforces this too. */
export function RequireManagingDirector() {
  const { isManagingDirector } = useAuth()

  if (!isManagingDirector) {
    return <Navigate to="/dashboard" replace />
  }
  return <Outlet />
}
