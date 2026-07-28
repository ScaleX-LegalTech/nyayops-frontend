import { isBefore, parseISO, startOfDay } from 'date-fns'
import { AlarmClock, Gavel, IndianRupee, Landmark, type LucideIcon } from 'lucide-react'
import type { Tone } from '@/components/ui/Badge'
import type { CalendarEventType } from '@/types'

/** Icon per event type - a bill's due_date is framed as a "Deadline" (money owed by
 * a date is still a deadline), a PaymentMilestone as a "Payment" (a scheduled fee
 * installment) - matching how a lawyer, not an accountant, would read this
 * calendar. */
export const EVENT_ICON: Record<CalendarEventType, LucideIcon> = {
  hearing: Gavel,
  bill_due: AlarmClock,
  payment_milestone: IndianRupee,
}

export const EVENT_LABEL: Record<CalendarEventType, string> = {
  hearing: 'Hearing',
  bill_due: 'Deadline',
  payment_milestone: 'Payment',
}

export const HOLIDAY_ICON: LucideIcon = Landmark

/** Fixed color per event type - blue (hearing) / red (deadline) / orange (payment)
 * / gray (holiday, handled separately) - so type reads instantly across the whole
 * calendar without needing a legend. Overdue items still get a small text "Overdue"
 * tag (see EventCard) rather than a second competing color. */
export const TYPE_TONE: Record<CalendarEventType, Tone> = {
  hearing: 'brand',
  bill_due: 'danger',
  payment_milestone: 'warning',
}

export function isOverdue(dateIso: string): boolean {
  return isBefore(parseISO(dateIso), startOfDay(new Date()))
}

/** Groups a day's events by type for a density-safe summary line - e.g. "3
 * hearings, 1 payment" instead of a wall of individual dots. */
export function summarizeByType(
  events: { type: CalendarEventType }[],
): { type: CalendarEventType; count: number }[] {
  const counts = new Map<CalendarEventType, number>()
  for (const event of events) {
    counts.set(event.type, (counts.get(event.type) ?? 0) + 1)
  }
  return Array.from(counts.entries()).map(([type, count]) => ({ type, count }))
}

/** Drops the leading count when it's 1 - the icon + singular label already says
 * "one of these", a "1" in front of it is noise. A real count (2+) still shows,
 * since folding that away would misreport how many there actually are. */
export function typeSummaryLabel(type: CalendarEventType, count: number): string {
  const prefix = count === 1 ? '' : `${count} `
  if (type === 'hearing') return `${prefix}Hearing${count === 1 ? '' : 's'}`
  if (type === 'bill_due') return `${prefix}Deadline${count === 1 ? '' : 's'}`
  return `${prefix}Payment${count === 1 ? '' : 's'}`
}
