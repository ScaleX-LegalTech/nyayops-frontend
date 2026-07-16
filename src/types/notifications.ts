export interface Notification {
  id: string
  user_id: string
  channel: string
  subject: string
  payload: Record<string, unknown>
  event_type: string | null
  read_at: string | null
  created_at: string
}
