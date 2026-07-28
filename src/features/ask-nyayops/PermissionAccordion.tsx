import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Search } from 'lucide-react'
import { Input } from '@/components/ui/Field'
import { cn } from '@/lib/cn'
import { humanize } from '@/lib/format'
import { qk } from '@/lib/queryKeys'
import { listPermissions } from '@/lib/api/admin'
import { permissionKey } from './permissionKey'
import type { Permission } from '@/types'

interface PermissionAccordionProps {
  selected: Set<string>
  onToggle?: (p: Permission) => void
  editable?: boolean
}

/** Grouped, searchable permission review (redesign brief §6) - the chat-card
 * equivalent of RoleEditPage's checklist, condensed into per-resource
 * collapsible sections so a drafted role with a handful of permissions
 * doesn't dump the entire org catalog into the conversation at once.
 * Resources touched by the current selection start expanded; everything
 * else starts collapsed until searched or opened by hand. */
export function PermissionAccordion({ selected, onToggle, editable = false }: PermissionAccordionProps) {
  const { data } = useQuery({ queryKey: qk.permissions, queryFn: listPermissions })
  const allPerms = useMemo(() => data ?? [], [data])
  const [query, setQuery] = useState('')
  const [openResources, setOpenResources] = useState<Set<string> | null>(null)

  const grouped = useMemo(() => {
    const map = new Map<string, Permission[]>()
    for (const p of allPerms) {
      const list = map.get(p.resource) ?? []
      list.push(p)
      map.set(p.resource, list)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [allPerms])

  const effectiveOpen =
    openResources ??
    new Set(grouped.filter(([, perms]) => perms.some((p) => selected.has(permissionKey(p)))).map(([r]) => r))

  function toggleOpen(resource: string) {
    const next = new Set(effectiveOpen)
    if (next.has(resource)) next.delete(resource)
    else next.add(resource)
    setOpenResources(next)
  }

  const q = query.trim().toLowerCase()
  const filtered = q
    ? grouped
        .map(
          ([resource, perms]) =>
            [
              resource,
              perms.filter(
                (p) =>
                  humanize(p.resource).toLowerCase().includes(q) ||
                  humanize(p.action).toLowerCase().includes(q),
              ),
            ] as const,
        )
        .filter(([, perms]) => perms.length > 0)
    : grouped

  if (allPerms.length === 0) return <p className="text-xs text-ink-muted">Loading permissions&hellip;</p>

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-faint" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search permissions..."
          className="h-8 pl-8 text-xs"
        />
      </div>
      <div className="scrollbar-thin max-h-64 overflow-y-auto rounded-control border border-border">
        {filtered.map(([resource, perms]) => {
          const open = q ? true : effectiveOpen.has(resource)
          const activeCount = perms.filter((p) => selected.has(permissionKey(p))).length
          return (
            <div key={resource} className="border-b border-border last:border-b-0">
              <button
                type="button"
                onClick={() => toggleOpen(resource)}
                className="flex w-full items-center justify-between gap-2 bg-surface-muted px-3 py-2 text-left"
              >
                <span className="text-xs font-semibold text-ink">{humanize(resource)}</span>
                <span className="flex items-center gap-2">
                  {activeCount > 0 && (
                    <span className="rounded-full bg-brand-soft px-1.5 py-0.5 text-[0.625rem] font-medium text-brand-strong">
                      {activeCount}
                    </span>
                  )}
                  <ChevronDown
                    className={cn('size-3.5 text-ink-faint transition-transform', open && 'rotate-180')}
                  />
                </span>
              </button>
              {open && (
                <div className="divide-y divide-border">
                  {perms.map((p) => {
                    const k = permissionKey(p)
                    const active = selected.has(k)
                    return (
                      <label
                        key={k}
                        className={cn(
                          'flex items-center justify-between gap-2 px-3 py-1.5 text-xs',
                          editable && 'cursor-pointer hover:bg-surface-muted',
                        )}
                      >
                        <span className={active ? 'text-ink' : 'text-ink-muted'}>
                          {humanize(p.action)} <span className="text-ink-faint">&middot; {p.scope}</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={active}
                          disabled={!editable}
                          onChange={() => editable && onToggle?.(p)}
                          className="size-3.5 accent-brand disabled:opacity-40"
                        />
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
