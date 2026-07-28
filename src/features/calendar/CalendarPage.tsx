import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
  addMonths,
  subWeeks,
} from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { getCalendarEvents } from '@/lib/api/calendar'
import { qk } from '@/lib/queryKeys'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/Feedback'
import { MonthYearPicker } from './MonthYearPicker'
import { MonthView } from './MonthView'
import { WeekView } from './WeekView'
import { AgendaView } from './AgendaView'
import { EventCard } from './EventCard'
import { CalendarFilters, type CalendarCategory } from './CalendarFilters'
import { getHolidaysInRange, type IndianHoliday } from './indianHolidays'
import type { CalendarEvent } from '@/types'

type ViewMode = 'month' | 'week' | 'agenda'

const ALL_CATEGORIES: CalendarCategory[] = ['hearing', 'deadlines', 'payments', 'holidays']

/** Maps a raw event type onto the filter-chip taxonomy: a bill's due_date is a
 * "Deadline" (money owed by a date), a PaymentMilestone is a "Payment" (a
 * scheduled fee installment) - the same split EVENT_LABEL/TYPE_TONE use. */
function categoryFor(type: CalendarEvent['type']): CalendarCategory {
  if (type === 'hearing') return 'hearing'
  if (type === 'bill_due') return 'deadlines'
  return 'payments'
}

export default function CalendarPage() {
  const [view, setView] = useState<ViewMode>('month')
  const [anchorDate, setAnchorDate] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [activeCategories, setActiveCategories] = useState<Set<CalendarCategory>>(
    () => new Set(ALL_CATEGORIES),
  )

  const monthGridStart = startOfWeek(startOfMonth(anchorDate), { weekStartsOn: 1 })
  const monthGridEnd = endOfWeek(endOfMonth(anchorDate), { weekStartsOn: 1 })
  const weekStart = startOfWeek(anchorDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(anchorDate, { weekStartsOn: 1 })

  const rangeStart = view === 'month' ? monthGridStart : weekStart
  const rangeEnd = view === 'month' ? monthGridEnd : weekEnd
  const rangeStartIso = format(rangeStart, 'yyyy-MM-dd')
  const rangeEndIso = format(rangeEnd, 'yyyy-MM-dd')

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: qk.calendarEvents(rangeStartIso, rangeEndIso),
    queryFn: () => getCalendarEvents(rangeStartIso, rangeEndIso),
  })

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const event of data ?? []) {
      if (!activeCategories.has(categoryFor(event.type))) continue
      const list = map.get(event.date)
      if (list) list.push(event)
      else map.set(event.date, [event])
    }
    return map
  }, [data, activeCategories])

  const holidaysByDate = useMemo(() => {
    if (!activeCategories.has('holidays')) return new Map<string, IndianHoliday>()
    const holidays = getHolidaysInRange(rangeStartIso, rangeEndIso)
    return new Map(holidays.map((h) => [h.date, h]))
  }, [rangeStartIso, rangeEndIso, activeCategories])

  const days = useMemo(
    () => eachDayOfInterval({ start: rangeStart, end: rangeEnd }),
    [rangeStart, rangeEnd],
  )

  const todayIso = format(new Date(), 'yyyy-MM-dd')
  const selectedEvents = eventsByDate.get(selectedDate) ?? []
  const selectedHoliday = holidaysByDate.get(selectedDate)

  function goPrev() {
    setAnchorDate((d) => (view === 'month' ? subMonths(d, 1) : subWeeks(d, 1)))
  }
  function goNext() {
    setAnchorDate((d) => (view === 'month' ? addMonths(d, 1) : addWeeks(d, 1)))
  }
  function goToday() {
    setAnchorDate(new Date())
    setSelectedDate(todayIso)
  }
  function toggleCategory(category: CalendarCategory) {
    setActiveCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next.size === 0 ? new Set(ALL_CATEGORIES) : next
    })
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Calendar"
        description="Court dates, deadlines, and financial milestones."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <CalendarFilters
          active={activeCategories}
          onToggle={toggleCategory}
          onReset={() => setActiveCategories(new Set(ALL_CATEGORIES))}
        />
        <Tabs
          tabs={[
            { value: 'month', label: 'Month' },
            { value: 'week', label: 'Week' },
            { value: 'agenda', label: 'Agenda' },
          ]}
          value={view}
          onChange={(v) => setView(v as ViewMode)}
        />
      </div>

      <div className="flex flex-col gap-5 lg:flex-row">
        <Card className="flex-1">
          <CardHeader
            title={<MonthYearPicker month={startOfMonth(anchorDate)} onChange={setAnchorDate} />}
            action={
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={goPrev} aria-label="Previous">
                  <ChevronLeft className="size-4" />
                </Button>
                <Button size="sm" variant="secondary" onClick={goToday}>
                  Today
                </Button>
                <Button size="sm" variant="ghost" onClick={goNext} aria-label="Next">
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            }
          />
          <CardBody>
            {isLoading ? (
              <LoadingState />
            ) : isError ? (
              <ErrorState error={error} onRetry={refetch} />
            ) : view === 'month' ? (
              <MonthView
                month={anchorDate}
                days={days}
                eventsByDate={eventsByDate}
                holidaysByDate={holidaysByDate}
                todayIso={todayIso}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />
            ) : view === 'week' ? (
              <WeekView
                days={days}
                eventsByDate={eventsByDate}
                holidaysByDate={holidaysByDate}
                todayIso={todayIso}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />
            ) : (
              <AgendaView
                days={days}
                eventsByDate={eventsByDate}
                holidaysByDate={holidaysByDate}
                todayIso={todayIso}
              />
            )}
          </CardBody>
        </Card>

        {view !== 'agenda' && (
          <Card className="w-full lg:w-96 lg:shrink-0">
            <CardHeader
              title={selectedDate === todayIso ? "Today's Schedule" : 'Schedule'}
              description={format(parseISO(selectedDate), 'd MMMM yyyy')}
            />
            <CardBody className="space-y-2">
              {selectedHoliday && (
                <div className="flex items-center gap-2 rounded-control border border-border bg-surface-muted px-3 py-2 text-xs font-medium text-ink-muted">
                  <span aria-hidden>&#127470;&#127475;</span>
                  {selectedHoliday.name}
                  {selectedHoliday.approx && '*'}
                  <span className="rounded-control bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-ink-faint">
                    Court Holiday
                  </span>
                </div>
              )}
              {selectedEvents.length === 0 ? (
                <EmptyState icon={CalendarDays} title="Nothing scheduled" />
              ) : (
                selectedEvents.map((event) => <EventCard key={event.id} event={event} />)
              )}
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  )
}
