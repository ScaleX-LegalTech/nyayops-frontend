import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listUsers } from '@/lib/api/admin'
import { displayName } from '@/lib/formatName'
import { qk } from '@/lib/queryKeys'
import type { User } from '@/types'

/**
 * Best-effort directory of tenant users for display/assignment.
 * Requires `users:read`; non-admins get an empty map (we never throw).
 *
 * `enabled` (default true): pass false to skip the fetch entirely when a caller has
 * a narrower, already-scoped source (e.g. useCasePeople) and only wants this as a
 * fallback for ids that source doesn't cover - fetching the full org directory on
 * every page that resolves *any* name is wasteful when most pages never need it.
 */
export function useUsers({ enabled = true }: { enabled?: boolean } = {}) {
  // 200 is the max page size the API allows - this is a directory for name lookups
  // and assignment pickers, not a paginated list, so it wants as many users as the
  // API will give in one shot.
  const query = useQuery({
    queryKey: qk.users,
    queryFn: () => listUsers({ limit: 200 }),
    retry: false,
    enabled,
    // The full directory changes rarely enough (invite/edit/remove, all admin-only
    // actions) that refetching it on every mount across every page that resolves a
    // name is pure waste - 5 minutes stale is fine, and any admin mutation already
    // invalidates qk.users directly (see UsersPage.tsx) so edits still show up
    // without waiting this out.
    staleTime: 5 * 60 * 1000,
  })
  const users = useMemo(() => query.data?.items ?? [], [query.data])
  const map = useMemo(() => new Map<string, User>(users.map((u) => [u.id, u])), [users])

  const nameOf = (id: string) => {
    const user = map.get(id)
    return user ? displayName(user) : `${id.slice(0, 8)}…`
  }
  return { users, map, nameOf, canList: query.isSuccess }
}
