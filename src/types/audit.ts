export interface AuditLog {
  id: string
  branch_id: string | null
  actor_id: string
  actor_name: string
  actor_access: string | null
  action_type: string
  resource_type: string
  resource_id: string
  resource_label: string | null
  comment: string | null
  previous_state: Record<string, unknown> | null
  new_state: Record<string, unknown> | null
  occurred_at: string
}

export interface AuditLogSearchFilters {
  resource_type?: string
  action_type?: string
  q?: string
  limit?: number
  offset?: number
}

export interface AuditLogPageResponse {
  items: AuditLog[]
  has_more: boolean
}
