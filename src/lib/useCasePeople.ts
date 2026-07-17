import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCasePeople } from '@/lib/api/cases'
import { displayName } from '@/lib/formatName'
import { qk } from '@/lib/queryKeys'
import type { CasePerson } from '@/types'

/**
 * Directory of people who can actually see a given case (creator, assignees,
 * admins, anyone with broad case-read access) - used to scope the @mention
 * picker and resolve names without requiring the org-wide `users:read` grant.
 */
export function useCasePeople(caseId: string) {
  const query = useQuery({
    queryKey: qk.casePeople(caseId),
    queryFn: () => getCasePeople(caseId),
    enabled: !!caseId,
    staleTime: 60_000,
  })
  const people = useMemo(() => query.data ?? [], [query.data])
  const map = useMemo(() => new Map<string, CasePerson>(people.map((p) => [p.id, p])), [people])

  const nameOf = (id: string) => {
    const person = map.get(id)
    return person ? displayName(person) : undefined
  }

  return { people, map, nameOf }
}
