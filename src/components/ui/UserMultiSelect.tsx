import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAssignablePeople, getCasePeople } from '@/lib/api/cases'
import { qk } from '@/lib/queryKeys'
import { cn } from '@/lib/cn'
import { displayName } from '@/lib/formatName'
import { useAuth } from '@/auth/AuthContext'
import { PersonAvatar } from '@/components/ui/Avatar'
import { Input } from '@/components/ui/Field'

interface UserMultiSelectProps {
  caseIds: string[]
  selected: string[]
  onChange: (ids: string[]) => void
  emptyHint?: string
  /** 'assignable' (default) - every branch-mate of the given case(s), for
   * picking someone *new* to put on the case (Assign/Reassign/Review/Wizard).
   * 'case-people' - only people already on the case (assignees/creator/org
   * admin/branch admin, via GET /cases/{id}/people) - use this wherever the
   * selection itself grants visibility into the case (e.g. a bill's
   * associate_id is the only access gate BillService checks for non-admins,
   * see services/bills.py - naming a branch-mate who isn't on the case would
   * hand them that case's title/client name through their bill queue).
   * Only supports a single case id. */
  source?: 'assignable' | 'case-people'
}

/** Searchable checkbox list of a case's assignable users. Selected rows float to
 * the top so a growing selection stays visible without scrolling back up.
 * Degrades when not permitted or the case has no branch-mates yet. */
export function UserMultiSelect({
  caseIds,
  selected,
  onChange,
  emptyHint,
  source = 'assignable',
}: UserMultiSelectProps) {
  const { user } = useAuth()
  const [query, setQuery] = useState('')

  const peopleQuery = useQuery({
    queryKey: source === 'case-people' ? qk.casePeople(caseIds[0]) : qk.assignablePeople(caseIds),
    queryFn: () =>
      source === 'case-people' ? getCasePeople(caseIds[0]) : getAssignablePeople(caseIds),
    enabled: caseIds.length > 0,
    retry: false,
  })
  const people = useMemo(() => peopleQuery.data ?? [], [peopleQuery.data])

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matches = q
      ? people.filter(
          (u) => u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
        )
      : people
    return [...matches].sort((a, b) => {
      const aSelected = selected.includes(a.id)
      const bSelected = selected.includes(b.id)
      if (aSelected !== bSelected) return aSelected ? -1 : 1
      return a.full_name.localeCompare(b.full_name)
    })
  }, [people, query, selected])

  if (!peopleQuery.isSuccess || people.length === 0) {
    return (
      <p className="rounded-control border border-dashed border-border bg-surface-muted px-3 py-3 text-sm text-ink-muted">
        {emptyHint ?? 'No assignable users available.'}
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name or email…"
        aria-label="Search assignable users"
      />
      <div className="max-h-52 space-y-1 overflow-y-auto rounded-control border border-border p-1.5 scrollbar-thin">
        {visible.length === 0 ? (
          <p className="px-2.5 py-2 text-sm text-ink-muted">No matches.</p>
        ) : (
          visible.map((u) => {
            const checked = selected.includes(u.id)
            return (
              <button
                type="button"
                key={u.id}
                onClick={() => toggle(u.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-control px-2.5 py-2 text-left transition-colors',
                  checked ? 'bg-brand-soft' : 'hover:bg-surface-muted',
                )}
              >
                <PersonAvatar label={u.full_name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">
                    {displayName(u)}
                    {u.id === user?.sub && <span className="text-ink-muted"> (Me)</span>}
                  </span>
                  <span className="block truncate text-xs text-ink-muted">{u.email}</span>
                </span>
                <span
                  className={cn(
                    'grid size-[1.125rem] place-items-center rounded border text-xs',
                    checked ? 'border-brand bg-brand text-white' : 'border-border-strong',
                  )}
                >
                  {checked && '✓'}
                </span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
