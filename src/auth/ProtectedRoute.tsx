import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { useCanManageRoles } from '@/lib/usePermissions'
import { LoadingState } from '@/components/ui/Feedback'

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

/** Creating/editing roles is MD-or-explicit-roles:manage-grant only - the server
 * enforces the same check via require_manage_roles (dependencies.py). Waits for
 * the permissions fetch before deciding, so a legitimate holder isn't bounced by
 * a still-loading grant list. */
export function RequireManageRoles() {
  const { canManageRoles, isLoading } = useCanManageRoles()

  if (isLoading) return <LoadingState />
  if (!canManageRoles) {
    return <Navigate to="/dashboard" replace />
  }
  return <Outlet />
}
