import { format, isSameMonth } from 'date-fns'
import { cn } from '@/lib/cn'
import { EVENT_ICON, summarizeByType, typeSummaryLabel } from './calendarShared'
import type { IndianHoliday } from './indianHolidays'
import type { CalendarEvent, CalendarEventType } from '@/types'

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
/** Cap how many type-summary lines a cell shows before folding the rest into
 * "+N more" - a packed cause-list day (dozens of hearings) would otherwise blow out
 * the grid row height. */
const MAX_SUMMARY_LINES = 2

const TYPE_BADGE_CLASS: Record<CalendarEventType, string> = {
  hearing: 'bg-brand-soft text-brand-strong',
  bill_due: 'bg-danger-soft text-danger',
  payment_milestone: 'bg-warning-soft text-warning-strong',
}

export function MonthView({
  month,
  days,
  eventsByDate,
  holidaysByDate,
  todayIso,
  selectedDate,
  onSelectDate,
}: {
  month: Date
  days: Date[]
  eventsByDate: Map<string, CalendarEvent[]>
  holidaysByDate: Map<string, IndianHoliday>
  todayIso: string
  selectedDate: string
  onSelectDate: (dateIso: string) => void
}) {
  return (
    <>
      <div className="grid grid-cols-7 gap-1 pb-1.5">
        {WEEKDAY_LABELS.map((label) => (
          <p key={label} className="type-label text-center text-ink-faint">
            {label}
          </p>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dayIso = format(day, 'yyyy-MM-dd')
          const dayEvents = eventsByDate.get(dayIso) ?? []
          const holiday = holidaysByDate.get(dayIso)
          const inMonth = isSameMonth(day, month)
          const isToday = dayIso === todayIso
          const isSelected = dayIso === selectedDate
          const summary = summarizeByType(dayEvents)
          const shown = summary.slice(0, MAX_SUMMARY_LINES)
          const overflowCount = summary
            .slice(MAX_SUMMARY_LINES)
            .reduce((sum, s) => sum + s.count, 0)

          return (
            <button
              key={dayIso}
              onClick={() => onSelectDate(dayIso)}
              className={cn(
                'flex min-h-[4.25rem] flex-col items-start gap-1 rounded-control border p-1.5 text-left transition-colors',
                isSelected ? 'border-brand bg-brand-soft' : 'border-border hover:bg-surface-muted',
                !isSelected && holiday && 'bg-surface-muted',
                !inMonth && 'opacity-40',
              )}
            >
              <div className="flex w-full items-center justify-between">
                <span
                  className={cn(
                    'grid size-6 place-items-center rounded-full text-xs font-medium',
                    isToday ? 'bg-brand text-white' : 'text-ink',
                  )}
                >
                  {format(day, 'd')}
                </span>
                {holiday && <span className="text-sm" aria-hidden>&#127470;&#127475;</span>}
              </div>
              {holiday ? (
                <div className="space-y-0.5">
                  <p className="truncate text-[11px] font-medium text-ink-muted">
                    {holiday.name}
                    {holiday.approx && '*'}
                  </p>
                  <span className="inline-block rounded-control bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-ink-faint">
                    Court Holiday
                  </span>
                </div>
              ) : (
                <div className="w-full space-y-0.5">
                  {shown.map(({ type, count }) => {
                    const Icon = EVENT_ICON[type]
                    return (
                      <div
                        key={type}
                        className={cn(
                          'flex items-center gap-1 truncate rounded-control px-1.5 py-0.5 text-[11px] font-semibold',
                          TYPE_BADGE_CLASS[type],
                        )}
                      >
                        <Icon className="size-3 shrink-0" aria-hidden />
                        {typeSummaryLabel(type, count)}
                      </div>
                    )
                  })}
                  {overflowCount > 0 && (
                    <p className="text-[11px] font-medium text-ink-faint">+{overflowCount} more</p>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </>
  )
}
