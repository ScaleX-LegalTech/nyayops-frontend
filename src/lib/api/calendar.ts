import type { CalendarEvent } from '@/types'
import { get, toQuery } from './client'

/** Unified calendar feed: Case.hearing_date, Bill.due_date, and
 * PaymentMilestone.due_date (only milestones with a real date - due_stage alone
 * never appears here) within [start, end], both inclusive, yyyy-MM-dd. */
export function getCalendarEvents(start: string, end: string): Promise<CalendarEvent[]> {
  return get<CalendarEvent[]>(`/calendar/events${toQuery({ start, end })}`)
}
