import { format } from 'date-fns'
import { EmptyState } from '@/components/ui/Feedback'
import { CalendarDays } from 'lucide-react'
import { EventCard } from './EventCard'
import type { IndianHoliday } from './indianHolidays'
import type { CalendarEvent } from '@/types'

/** Flat, chronological day-by-day agenda across the visible range - the view for
 * "what's actually on today/this week", as opposed to the Month grid's overview. */
export function AgendaView({
  days,
  eventsByDate,
  holidaysByDate,
  todayIso,
}: {
  days: Date[]
  eventsByDate: Map<string, CalendarEvent[]>
  holidaysByDate: Map<string, IndianHoliday>
  todayIso: string
}) {
  const sections = days
    .map((day) => {
      const dayIso = format(day, 'yyyy-MM-dd')
      return { day, dayIso, events: eventsByDate.get(dayIso) ?? [], holiday: holidaysByDate.get(dayIso) }
    })
    .filter((s) => s.events.length > 0 || s.holiday)

  if (sections.length === 0) {
    return <EmptyState icon={CalendarDays} title="Nothing scheduled in this range" />
  }

  return (
    <div className="space-y-5">
      {sections.map(({ day, dayIso, events, holiday }) => (
        <div key={dayIso}>
          <div className="mb-2 flex items-center gap-2">
            <p className="text-sm font-semibold text-ink">{format(day, 'd MMMM yyyy')}</p>
            {dayIso === todayIso && (
              <span className="rounded-control bg-brand px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white">
                TODAY
              </span>
            )}
          </div>
          {holiday && (
            <div className="mb-2 flex items-center gap-2 rounded-control border border-border bg-surface-muted px-3 py-2 text-xs font-medium text-ink-muted">
              <span aria-hidden>&#127470;&#127475;</span>
              {holiday.name}
              {holiday.approx && '*'}
              <span className="rounded-control bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-ink-faint">
                Court Holiday
              </span>
            </div>
          )}
          <div className="space-y-2">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
