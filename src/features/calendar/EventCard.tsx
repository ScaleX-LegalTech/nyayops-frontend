import { Link } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { Capsule } from '@/components/ui/Badge'
import { courtLabel, humanize } from '@/lib/format'
import { EVENT_ICON, EVENT_LABEL, TYPE_TONE, isOverdue } from './calendarShared'
import type { CalendarEvent } from '@/types'

/** One agenda-style row for a calendar event - shared by the day panel and the
 * Agenda/List view. Leads with event type + case (what a lawyer needs first), not
 * the amount - amount/status are a smaller secondary line. No time-of-day is shown:
 * hearing_date/due_date are date-only fields in the backend, there's no real time
 * to display. */
export function EventCard({ event }: { event: CalendarEvent }) {
  const Icon = EVENT_ICON[event.type]
  const tone = TYPE_TONE[event.type]
  const overdue = isOverdue(event.date)
  return (
    <Link
      to={`/cases/${event.case_id}`}
      className="flex items-start gap-3 rounded-control border border-border bg-surface px-3.5 py-3 transition-colors hover:border-brand/30 hover:bg-surface-muted"
    >
      <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-control bg-brand-soft text-brand">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Capsule tone={tone} icon={Icon}>
            {EVENT_LABEL[event.type]}
          </Capsule>
          {overdue && (
            <Capsule tone="danger" icon={AlertTriangle}>
              Overdue
            </Capsule>
          )}
          {event.court && (
            <span className="text-xs text-ink-faint">{courtLabel(event.court)}</span>
          )}
        </div>
        <p className="mt-1 truncate text-sm font-semibold text-ink">{event.case_title}</p>
        <p className="truncate text-xs text-ink-faint">
          {event.case_code} &middot; {event.title}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-muted">
          <span>{event.responsible_name ?? 'Unassigned'}</span>
          {event.status && <span>{humanize(event.status)}</span>}
          {event.amount != null && (
            <span className="tabular">&#8377;{event.amount.toLocaleString('en-IN')}</span>
          )}
        </div>
      </div>
    </Link>
  )
}
