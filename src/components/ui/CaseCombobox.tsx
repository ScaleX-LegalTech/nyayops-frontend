import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Loader2, X } from 'lucide-react'
import { getCase, listCaseOptions } from '@/lib/api/cases'
import { qk } from '@/lib/queryKeys'
import { useFloatingPanel, useOutsideClose } from '@/components/ui/useFloatingPanel'
import { cn } from '@/lib/cn'
import type { CaseOption } from '@/types'

interface CaseComboboxProps {
  value: string
  onChange: (option: CaseOption | null) => void
  excludeClosed?: boolean
  disabled?: boolean
  placeholder?: string
  /** Shown as a "clear selection" row at the top of results when set (e.g. "All
   * cases") - omit for pickers where a case must always be chosen. */
  clearLabel?: string
}

/** Search-as-you-type case picker - replaces a plain <select> that would otherwise
 * need every case in the tenant loaded up front just to populate its options. */
export function CaseCombobox({
  value,
  onChange,
  excludeClosed,
  disabled,
  placeholder = 'Search cases…',
  clearLabel,
}: CaseComboboxProps) {
  const [raw, setRaw] = useState('')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const { triggerRef, panelRef, pos } = useFloatingPanel<HTMLDivElement>(open)
  useOutsideClose(open, [triggerRef, panelRef], () => setOpen(false))

  // Debounce keystrokes 300ms before hitting the API.
  useEffect(() => {
    const id = setTimeout(() => setQuery(raw.trim()), 300)
    return () => clearTimeout(id)
  }, [raw])

  const search = useQuery({
    queryKey: qk.caseOptions({ query: query || undefined, limit: 8 }),
    queryFn: () => listCaseOptions({ query: query || undefined, limit: 8 }),
    enabled: open,
  })

  // The selected case won't generally be among the current search results (it
  // isn't re-fetched by id), so the input's display value is resolved separately
  // - this also means it's free once the case detail page has already cached it.
  const selected = useQuery({
    queryKey: qk.caseDetail(value),
    queryFn: () => getCase(value),
    enabled: !!value,
    staleTime: 60_000,
  })

  const results = useMemo(
    () => (search.data ?? []).filter((c) => !excludeClosed || c.status !== 'closed'),
    [search.data, excludeClosed],
  )
  const clampedActiveIndex = results.length === 0 ? 0 : Math.min(activeIndex, results.length - 1)

  function pick(option: CaseOption | null) {
    onChange(option)
    setOpen(false)
    setRaw('')
    setQuery('')
    setActiveIndex(0)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((clampedActiveIndex + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((clampedActiveIndex - 1 + results.length) % results.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const option = results[clampedActiveIndex]
      if (option) pick(option)
    }
  }

  const displayValue = open ? raw : (selected.data?.title ?? '')

  return (
    <div ref={triggerRef} className="relative">
      <input
        value={displayValue}
        onChange={(e) => {
          setRaw(e.target.value)
          setOpen(true)
        }}
        onFocus={() => {
          setOpen(true)
          setRaw('')
        }}
        onKeyDown={onKeyDown}
        disabled={disabled}
        placeholder={value && !open ? undefined : placeholder}
        aria-label="Search cases"
        className="h-10 w-full rounded-control border border-border-strong bg-surface px-3 pr-9 text-sm text-ink placeholder:text-ink-faint focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand focus-visible:border-brand disabled:cursor-not-allowed disabled:opacity-60"
      />
      {search.isFetching && open ? (
        <Loader2 className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-ink-faint" />
      ) : (
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
      )}

      {open &&
        createPortal(
          <div
            ref={panelRef}
            className="scrollbar-thin fixed max-h-72 w-[min(24rem,calc(100vw-2rem))] overflow-y-auto rounded-card border border-border bg-surface p-1.5 shadow-pop animate-rise"
            style={{ top: pos.top, left: pos.left, zIndex: 'var(--z-popover)' }}
          >
            {clearLabel && (
              <button
                type="button"
                onClick={() => pick(null)}
                className="flex w-full items-center gap-2 rounded-control px-3 py-2 text-left text-sm text-ink-muted hover:bg-surface-muted"
              >
                <X className="size-3.5" /> {clearLabel}
              </button>
            )}
            {!search.isFetching && results.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-ink-muted">
                {query ? `No cases match "${query}".` : 'No cases found.'}
              </p>
            ) : (
              results.map((option, index) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => pick(option)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    'block w-full truncate rounded-control px-3 py-2 text-left text-sm text-ink',
                    index === clampedActiveIndex ? 'bg-surface-muted' : 'hover:bg-surface-muted',
                  )}
                >
                  {option.title}
                </button>
              ))
            )}
          </div>,
          document.body,
        )}
    </div>
  )
}
