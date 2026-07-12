import { useQuery } from '@tanstack/react-query'
import { getMyPermissions } from '@/lib/api/admin'
import { qk } from '@/lib/queryKeys'
import { useAuth } from '@/auth/AuthContext'

export function usePermissions() {
  const { isManagingDirector, isBranchAdmin } = useAuth()
  const { data } = useQuery({
    queryKey: qk.myPermissions,
    queryFn: getMyPermissions,
    staleTime: 5 * 60_000,
  })
  const grants = data ?? []

  function hasPermission(resource: string, action: string): boolean {
    if (isManagingDirector || isBranchAdmin) return true
    return grants.some((g) => g.resource === resource && g.action === action)
  }

  return { hasPermission }
}
