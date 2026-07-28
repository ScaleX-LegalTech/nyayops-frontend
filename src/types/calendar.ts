export type CalendarEventType = 'hearing' | 'bill_due' | 'payment_milestone'

export interface CalendarEvent {
  id: string
  type: CalendarEventType
  date: string
  title: string
  case_id: string
  case_title: string
  case_code: string
  source_id: string
  status: string | null
  amount: number | null
  court: string | null
  responsible_name: string | null
}
