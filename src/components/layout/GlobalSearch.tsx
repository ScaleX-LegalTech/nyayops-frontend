import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Briefcase,
  Building2,
  FileText,
  IndianRupee,
  Loader2,
  Receipt,
  Search,
  TriangleAlert,
  User,
  X,
} from 'lucide-react'
import { globalSearch, type SearchResultItem, type SearchResultType } from '@/lib/api/search'
import { qk } from '@/lib/queryKeys'
import { useFloatingPanel, useOutsideClose } from '@/components/ui/useFloatingPanel'
import { cn } from '@/lib/cn'

const TYPE_LABEL: Record<SearchResultType, string> = {
  case: 'Cases',
  document: 'Documents',
  user: 'People',
  issue: 'Issues',
  payment: 'Payments',
  bill: 'Bills',
  branch: 'Branches',
}

const TYPE_ICON: Record<SearchResultType, typeof Briefcase> = {
  case: Briefcase,
  document: FileText,
  user: User,
  issue: TriangleAlert,
  payment: IndianRupee,
  bill: Receipt,
  branch: Building2,
}

/** Where a result actually links to - documents/issues/payments/bills have no
 * standalone detail page, so they open the case they belong to. Branches open the
 * Users page (there's no dedicated branch detail page either). */
function resultHref(item: SearchResultItem): string | null {
  switch (item.type) {
    case 'case':
      return `/cases/${item.id}`
    case 'document':
    case 'issue':
    case 'payment':
    case 'bill':
      return item.case_id ? `/cases/${item.case_id}` : null
    case 'user':
    case 'branch':
      return '/admin/users'
  }
}

export interface GlobalSearchHandle {
  /** Focuses the input and opens the results panel - used by the Cmd/Ctrl+K shortcut. */
  focus: () => void
}

export const GlobalSearch = forwardRef<GlobalSearchHandle>(function GlobalSearch(_props, ref) {
  const navigate = useNavigate()
  const [raw, setRaw] = useState('')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const { triggerRef, panelRef, pos } = useFloatingPanel<HTMLDivElement>(open)
  useOutsideClose(open, [triggerRef, panelRef], () => setOpen(false))
  const inputRef = useRef<HTMLInputElement>(null)

  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus()
      setOpen(true)
    },
  }))

  // Debounce keystrokes 300ms before hitting the API.
  useEffect(() => {
    const id = setTimeout(() => setQuery(raw.trim()), 300)
    return () => clearTimeout(id)
  }, [raw])

  const search = useQuery({
    queryKey: qk.globalSearch(query),
    queryFn: () => globalSearch(query),
    enabled: query.length > 0,
    staleTime: 30_000,
  })

  const results = useMemo(() => search.data?.results ?? [], [search.data])
  const grouped = useMemo(() => {
    const groups = new Map<SearchResultType, SearchResultItem[]>()
    for (const item of results) {
      const list = groups.get(item.type) ?? []
      list.push(item)
      groups.set(item.type, list)
    }
    return groups
  }, [results])

  // Clamp instead of syncing via an effect - `results` changes out from under a
  // stale `activeIndex` (fewer results than before, or a fresh query) without a
  // dedicated reset step.
  const clampedActiveIndex = results.length === 0 ? 0 : Math.min(activeIndex, results.length - 1)

  function clear() {
    setRaw('')
    setQuery('')
    setActiveIndex(0)
  }

  function go(item: SearchResultItem) {
    const href = resultHref(item)
    if (href) navigate(href)
    setOpen(false)
    clear()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    // Escape is handled by useOutsideClose's document-level listener.
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((clampedActiveIndex + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((clampedActiveIndex - 1 + results.length) % results.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = results[clampedActiveIndex]
      if (item) go(item)
    }
  }

  return (
    <div ref={triggerRef} className="relative w-72 shrink-0 lg:w-96">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
      <input
        ref={inputRef}
        value={raw}
        onChange={(e) => {
          setRaw(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search cases, documents, people…"
        aria-label="Global search"
        className="h-10 w-full rounded-control border border-border-strong bg-surface pl-9 pr-14 text-sm text-ink placeholder:text-ink-faint focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand focus-visible:border-brand"
      />
      {!raw && !search.isFetching && (
        <kbd
          aria-hidden
          className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-border-strong bg-surface px-1.5 py-0.5 text-[10px] font-medium text-ink-muted sm:block"
        >
          {navigator.platform.includes('Mac') ? '⌘K' : 'Ctrl K'}
        </kbd>
      )}
      {search.isFetching ? (
        <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-ink-faint" />
      ) : (
        raw && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded-full text-ink-faint hover:bg-surface-muted hover:text-ink"
          >
            <X className="size-3.5" />
          </button>
        )
      )}

      {open &&
        query.length > 0 &&
        createPortal(
          <div
            ref={panelRef}
            className="scrollbar-thin fixed max-h-96 w-[min(28rem,calc(100vw-2rem))] overflow-y-auto rounded-card border border-border bg-surface p-2 shadow-pop animate-rise"
            style={{ top: pos.top, left: pos.left, zIndex: 'var(--z-popover)' }}
          >
            {!search.isFetching && results.length === 0 && (
              <p className="px-3 py-4 text-center text-sm text-ink-muted">
                No results for "{query}".
              </p>
            )}
            {Array.from(grouped.entries()).map(([type, items]) => {
              const Icon = TYPE_ICON[type]
              return (
                <div key={type} className="mb-1 last:mb-0">
                  <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                    {TYPE_LABEL[type]}
                  </p>
                  {items.map((item) => {
                    const index = results.indexOf(item)
                    return (
                      <button
                        key={`${item.type}-${item.id}`}
                        type="button"
                        onClick={() => go(item)}
                        onMouseEnter={() => setActiveIndex(index)}
                        className={cn(
                          'flex w-full items-start gap-2.5 rounded-control px-3 py-2 text-left',
                          index === clampedActiveIndex ? 'bg-surface-muted' : 'hover:bg-surface-muted',
                        )}
                      >
                        <Icon className="mt-0.5 size-4 shrink-0 text-ink-muted" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-ink">{item.title}</span>
                          {item.subtitle && (
                            <span className="block truncate text-xs text-ink-muted">
                              {item.subtitle}
                            </span>
                          )}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>,
          document.body,
        )}
    </div>
  )
})
