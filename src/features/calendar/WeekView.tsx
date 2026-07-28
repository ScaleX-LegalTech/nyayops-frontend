import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { cn } from '@/lib/cn'
import { EVENT_ICON } from './calendarShared'
import type { IndianHoliday } from './indianHolidays'
import type { CalendarEvent, CalendarEventType } from '@/types'

const MAX_ROWS = 4

const TYPE_CHIP_CLASS: Record<CalendarEventType, string> = {
  hearing: 'bg-brand-soft text-brand-strong',
  bill_due: 'bg-danger-soft text-danger',
  payment_milestone: 'bg-warning-soft text-warning-strong',
}

export function WeekView({
  days,
  eventsByDate,
  holidaysByDate,
  todayIso,
  selectedDate,
  onSelectDate,
}: {
  days: Date[]
  eventsByDate: Map<string, CalendarEvent[]>
  holidaysByDate: Map<string, IndianHoliday>
  todayIso: string
  selectedDate: string
  onSelectDate: (dateIso: string) => void
}) {
  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((day) => {
        const dayIso = format(day, 'yyyy-MM-dd')
        const dayEvents = eventsByDate.get(dayIso) ?? []
        const holiday = holidaysByDate.get(dayIso)
        const isToday = dayIso === todayIso
        const isSelected = dayIso === selectedDate
        const shown = dayEvents.slice(0, MAX_ROWS)
        const overflow = dayEvents.length - shown.length

        return (
          <div
            key={dayIso}
            className={cn(
              'flex min-h-64 flex-col gap-1.5 rounded-control border p-2',
              isSelected ? 'border-brand bg-brand-soft/40' : 'border-border',
              !isSelected && holiday && 'bg-surface-muted',
            )}
          >
            <button
              onClick={() => onSelectDate(dayIso)}
              className="flex items-center justify-between rounded-control px-1 py-0.5 text-left hover:bg-surface-muted"
            >
              <span>
                <span className="type-label block text-ink-faint">{format(day, 'EEE')}</span>
                <span
                  className={cn(
                    'grid size-6 place-items-center rounded-full text-xs font-medium',
                    isToday ? 'bg-brand text-white' : 'text-ink',
                  )}
                >
                  {format(day, 'd')}
                </span>
              </span>
              {holiday && <span className="text-sm" aria-hidden>&#127470;&#127475;</span>}
            </button>

            {holiday && (
              <div className="space-y-0.5">
                <p className="truncate text-[11px] font-medium text-ink-muted">
                  {holiday.name}
                  {holiday.approx && '*'}
                </p>
                <span className="inline-block rounded-control bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-ink-faint">
                  Court Holiday
                </span>
              </div>
            )}

            <div className="space-y-1">
              {shown.map((event) => {
                const Icon = EVENT_ICON[event.type]
                return (
                  <Link
                    key={event.id}
                    to={`/cases/${event.case_id}`}
                    className={cn(
                      'flex items-center gap-1.5 truncate rounded-control px-1.5 py-1 text-[11px] font-medium',
                      TYPE_CHIP_CLASS[event.type],
                    )}
                  >
                    <Icon className="size-3 shrink-0" aria-hidden />
                    <span className="truncate">{event.case_title}</span>
                  </Link>
                )
              })}
              {overflow > 0 && (
                <button
                  onClick={() => onSelectDate(dayIso)}
                  className="w-full rounded-control px-1.5 py-1 text-left text-[11px] font-medium text-ink-faint hover:bg-surface-muted"
                >
                  +{overflow} more
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
