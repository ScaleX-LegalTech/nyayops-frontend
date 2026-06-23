// TS models mirroring the NyayOps backend Pydantic schemas.

export const CASE_STATUSES = [
  'new',
  'assigned',
  'in_progress',
  'ready_for_review',
  'under_review',
  'approved',
  'rejected',
  'reassigned',
  'closed',
] as const

export type CaseStatus = (typeof CASE_STATUSES)[number]

export type CasePriority = 'low' | 'medium' | 'high' | 'urgent'

export interface Case {
  id: string
  tenant_id: string
  branch_id: string | null
  title: string
  case_type: string
  client_name: string
  court_jurisdiction: string
  region: string
  filing_date: string | null
  hearing_date: string | null
  priority: string
  status: CaseStatus
  description: string | null
  assigned_user_ids: string[]
  comments: string[]
  created_at: string
}

export interface CaseCreateRequest {
  title: string
  case_type: string
  client_name: string
  court_jurisdiction: string
  region: string
  filing_date?: string | null
  hearing_date?: string | null
  priority?: string
  description?: string | null
  assigned_user_ids?: string[]
}

export interface CaseSearchFilters {
  query?: string
  status?: CaseStatus
  client_name?: string
  assigned_user_id?: string
}

// Auth -----------------------------------------------------------------------

export interface LoginResponse {
  access_token: string | null
  refresh_token: string | null
  token_type: string
  mfa_required: boolean
  mfa_token: string | null
  otp_required: boolean
  otp_token: string | null
  device_token: string | null
}

export interface MfaEnrollResponse {
  secret: string
  otp_uri: string
}

export interface TenantRegistrationResponse {
  tenant_id: string
  tenant_slug: string
  admin_user_id: string
}

export interface DecodedToken {
  sub: string
  tid: string
  is_org_admin?: boolean
  bid?: string | null
  is_branch_admin?: boolean
  email?: string
  exp: number
  iat: number
}

// Dashboard ------------------------------------------------------------------

export interface DashboardKpis {
  cases_today: number
  associate_activity: number
  overdue_cases: number
  pending_reviews: number
}

export interface CasesByStatus {
  status: string
  count: number
}

export interface TopCourtMetric {
  court_jurisdiction: string
  count: number
}

export interface ActivityMetrics {
  active_users_today: number
  cases_in_progress: number
  notifications_sent: number
}

// Documents ------------------------------------------------------------------

export interface DocumentVersion {
  id: string
  version_number: number
  storage_key: string
  mime_type: string
  file_size_bytes: number
  change_note: string | null
  uploaded_by: string
  uploaded_at: string
  virus_scan_status: string
  metadata: Record<string, unknown>
}

export interface DocumentRecord {
  id: string
  tenant_id: string
  branch_id: string | null
  case_id: string
  title: string
  doc_type: string
  uploaded_by: string
  is_quarantined: boolean
  metadata: Record<string, unknown>
  versions: DocumentVersion[]
}

export interface DocumentUploadResponse {
  document_id: string
  version_id: string
  upload_url: string
}

export interface DocumentSearchFilters {
  case_id?: string
  doc_type?: string
  title?: string
  uploaded_by?: string
}

// Users / Roles / Permissions ------------------------------------------------

export interface User {
  id: string
  tenant_id: string
  branch_id: string | null
  email: string
  full_name: string
  phone: string | null
  is_org_admin: boolean
  is_branch_admin: boolean
  is_active: boolean
  is_restricted: boolean
  role_ids: string[]
}

export interface Branch {
  id: string
  tenant_id: string
  name: string
  created_at: string
}

export interface Permission {
  resource: string
  action: string
  scope: string
  condition: Record<string, unknown> | null
}

export interface Role {
  id: string
  tenant_id: string
  name: string
  description: string | null
  permissions: Permission[]
}

export interface RolePreviewResponse {
  effective_permissions: Permission[]
  can_manage_documents: boolean
}

// Audit / Notifications ------------------------------------------------------

export interface AuditLog {
  id: string
  tenant_id: string
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

export interface Notification {
  id: string
  tenant_id: string
  user_id: string
  channel: string
  subject: string
  payload: Record<string, unknown>
  read_at: string | null
  created_at: string
}
