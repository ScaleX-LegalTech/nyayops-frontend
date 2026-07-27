import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { StatusBadge } from '@/components/ui/Badge'
import type { AskNyayOpsSource, CaseStatus } from '@/types'

/** One disambiguation result from a multi-match assistant reply ("Raise a
 * bill for Mahesh" -> 2 matching cases). Two distinct actions, never a
 * whole-card link: Select keeps the user in the chat workflow (sends the
 * entity's own label back as the next turn, letting the model's existing
 * resolve_case_id/title matching continue whatever was pending - see
 * ChatMessageList.tsx's onSelectSource wiring); Open navigates away to the
 * entity's own page for exploration. Reused for every source type (case,
 * bill, document, user) so a new entity type never needs its own card. */
export function EntityResultCard({
  source,
  icon: Icon,
  typeLabel,
  href,
  onSelect,
  onOpen,
  disabled = false,
}: {
  source: AskNyayOpsSource
  icon: typeof ArrowRight
  typeLabel: string
  href: string
  onSelect: () => void
  /** When set, Open renders as a button calling this instead of navigating to
   * `href` - used for type="document" sources that can open
   * DocumentPreviewDialog in place. */
  onOpen?: () => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-col gap-2 rounded-control border border-border bg-surface px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
          <Icon className="size-3.5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{source.label}</p>
          {(source.case_number || source.status) && (
            <p className="flex items-center gap-1.5 text-xs text-ink-muted">
              {source.case_number && <span className="truncate">{source.case_number}</span>}
              {source.status && <StatusBadge status={source.status as CaseStatus} />}
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={onSelect}
          disabled={disabled}
          className="rounded-control bg-brand px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-strong disabled:opacity-50"
        >
          Select
        </button>
        {onOpen ? (
          <button
            type="button"
            onClick={onOpen}
            aria-label={`Open ${typeLabel}: ${source.label}`}
            className="flex items-center gap-1 rounded-control border border-border px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-brand hover:text-brand-strong"
          >
            Open <ArrowRight className="size-3" />
          </button>
        ) : (
          <Link
            to={href}
            aria-label={`Open ${typeLabel}: ${source.label}`}
            className="flex items-center gap-1 rounded-control border border-border px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-brand hover:text-brand-strong"
          >
            Open <ArrowRight className="size-3" />
          </Link>
        )}
      </div>
    </div>
  )
}
