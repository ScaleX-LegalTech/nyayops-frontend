import { useQuery } from '@tanstack/react-query'
import { getMyPermissions } from '@/lib/api/admin'
import { qk } from '@/lib/queryKeys'
import { useAuth } from '@/auth/AuthContext'

export function usePermissions() {
  const { isManagingDirector, isBranchAdmin } = useAuth()
  const { data, isLoading } = useQuery({
    queryKey: qk.myPermissions,
    queryFn: getMyPermissions,
    staleTime: 5 * 60_000,
  })
  const grants = data ?? []

  function hasPermission(resource: string, action: string): boolean {
    if (isManagingDirector || isBranchAdmin) return true
    return grants.some((g) => g.resource === resource && g.action === action)
  }

  return { hasPermission, isLoading }
}

/** Whether the current user can manage roles/permissions: org admin, or an
 * explicit `roles:manage` grant from an assigned role. Deliberately bypasses
 * usePermissions().hasPermission's Branch Admin default-full-access rule -
 * managing the org's roles stays MD-or-explicit-grant only regardless of the
 * branch-admin permission matrix (mirrors require_manage_roles on the backend). */
export function useCanManageRoles(): { canManageRoles: boolean; isLoading: boolean } {
  const { isManagingDirector } = useAuth()
  const { data, isLoading } = useQuery({
    queryKey: qk.myPermissions,
    queryFn: getMyPermissions,
    staleTime: 5 * 60_000,
  })
  const grants = data ?? []
  const canManageRoles =
    isManagingDirector || grants.some((g) => g.resource === 'roles' && g.action === 'manage')
  return { canManageRoles, isLoading }
}
