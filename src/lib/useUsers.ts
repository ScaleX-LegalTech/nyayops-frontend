import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listUsers } from '@/lib/api/admin'
import { qk } from '@/lib/queryKeys'
import type { User } from '@/types'

/**
 * Best-effort directory of tenant users for display/assignment.
 * Requires `users:read`; non-admins get an empty map (we never throw).
 */
export function useUsers() {
  // 200 is the max page size the API allows - this is a directory for name lookups
  // and assignment pickers, not a paginated list, so it wants as many users as the
  // API will give in one shot.
  const query = useQuery({
    queryKey: qk.users,
    queryFn: () => listUsers({ limit: 200 }),
    retry: false,
  })
  const users = useMemo(() => query.data?.items ?? [], [query.data])
  const map = useMemo(() => new Map<string, User>(users.map((u) => [u.id, u])), [users])

  const nameOf = (id: string) => map.get(id)?.full_name ?? `${id.slice(0, 8)}…`
  return { users, map, nameOf, canList: query.isSuccess }
}
