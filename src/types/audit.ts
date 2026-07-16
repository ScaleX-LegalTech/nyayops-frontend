export interface AuditLog {
  id: string
  branch_id: string | null
  actor_id: string
  action_type: string
  resource_type: string
  resource_id: string
  comment: string | null
  previous_state: Record<string, unknown> | null
  new_state: Record<string, unknown> | null
  occurred_at: string
}
