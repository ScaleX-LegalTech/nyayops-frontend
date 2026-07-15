// TS models mirroring the NyayOps backend Pydantic schemas.

export const CASE_STATUSES = [
  'draft',
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

export type CaseSource = 'manual' | 'cnr'

export type CaseStage = 'filed' | 'pending' | 'reserved' | 'disposed'

export const CASE_LIFECYCLE_STAGES = [
  'collection',
  'scrutiny',
  'filed',
  'cnr_linked',
  'research_draft',
  'hearing',
  'disposed',
] as const

export type CaseLifecycleStage = (typeof CASE_LIFECYCLE_STAGES)[number]

/** Groups the 7 stages into the 4 parts the case-detail lifecycle tracker renders -
 * mirrors how the firm actually thinks about the SOP (Collection & Scrutiny happen
 * together, Suit & CNR happen together, ...). Purely a display grouping - the backend
 * has no notion of "parts", only the 7 CaseLifecycleStage values. */
export const CASE_LIFECYCLE_PARTS: { name: string; stages: CaseLifecycleStage[] }[] = [
  { name: 'Collection & Scrutiny', stages: ['collection', 'scrutiny'] },
  { name: 'Suit & CNR', stages: ['filed', 'cnr_linked'] },
  { name: 'Research, Draft & Hearing', stages: ['research_draft', 'hearing'] },
  { name: 'Disposed', stages: ['disposed'] },
]

/** Mirrors FORWARD_TRANSITIONS/BACKWARD_TRANSITIONS in domain/case_fsm.py - the backend
 * is the source of truth for enforcement, this just avoids a round-trip 400 for
 * obviously-invalid clicks in CaseLifecycleTracker. Forward moves may be gated (see
 * GATED_LIFECYCLE_STAGES/REQUIRED_DOC_TYPE_FOR below); backward moves never are. */
export const FORWARD_TRANSITIONS: Record<CaseLifecycleStage, CaseLifecycleStage[]> = {
  collection: ['scrutiny'],
  scrutiny: ['filed'],
  filed: ['cnr_linked', 'research_draft'],
  cnr_linked: ['research_draft'],
  research_draft: ['hearing'],
  hearing: ['disposed'],
  disposed: [],
}

export const BACKWARD_TRANSITIONS: Record<CaseLifecycleStage, CaseLifecycleStage[]> = {
  collection: [],
  scrutiny: ['collection'],
  filed: ['scrutiny'],
  cnr_linked: ['filed'],
  research_draft: ['filed'],
  hearing: ['research_draft'],
  disposed: ['hearing', 'research_draft'],
}

/** filed/cnr_linked are only ever entered via the File suit / Link CNR dialogs (they
 * collect data a bare stage click can't) - mirrors GATED_STAGES in domain/case_fsm.py. */
export const GATED_LIFECYCLE_STAGES: CaseLifecycleStage[] = ['filed', 'cnr_linked']

/** Mirrors REQUIRED_DOC_TYPE_FOR in domain/case_fsm.py - the one curated document type
 * that must be on file before leaving each stage going forward. Backward moves are
 * never gated by this. */
export const REQUIRED_DOC_TYPE_FOR: Partial<Record<CaseLifecycleStage, string>> = {
  collection: 'collection_document',
  scrutiny: 'scrutiny_report',
  filed: 'filing_document',
  cnr_linked: 'filing_document',
  research_draft: 'research_draft_document',
  hearing: 'hearing_report',
}

/** Curated suggestions per stage for the document-upload form - not a closed set, the
 * upload form always keeps a free-text "Other" option alongside these. */
export const DOC_TYPE_OPTIONS: Record<CaseLifecycleStage, { value: string; label: string }[]> = {
  collection: [{ value: 'collection_document', label: 'Collection document' }],
  scrutiny: [{ value: 'scrutiny_report', label: 'Scrutiny report' }],
  filed: [{ value: 'filing_document', label: 'Filing document' }],
  cnr_linked: [{ value: 'filing_document', label: 'Filing document' }],
  research_draft: [{ value: 'research_draft_document', label: 'Research / draft document' }],
  hearing: [{ value: 'hearing_report', label: 'Hearing report' }],
  disposed: [{ value: 'final_order', label: 'Final order' }],
}

export interface CaseCommentAttachment {
  id: string
  title: string
  mime_type: string
  storage_key: string
}

export interface CaseComment {
  id: string
  author_id: string
  comment: string
  created_at: string
  attachments: CaseCommentAttachment[]
}

export interface CaseParty {
  id: string
  role: string
  name: string
  advocate_name: string | null
  created_at: string
}

export interface CaseHistoryEntry {
  id: string
  hearing_date: string | null
  purpose: string | null
  business_detail: string | null
  judge: string | null
  next_hearing_date: string | null
  is_disposal: boolean
  source: string
  created_at: string
}

export interface CaseLifecycleHistoryEntry {
  stage: CaseLifecycleStage
  entered_at: string
}

export interface Case {
  id: string
  tenant_id: string
  branch_id: string | null
  case_code: string
  title: string
  case_type: string | null
  client_name: string
  court_jurisdiction: string | null
  region: string | null
  filing_date: string | null
  hearing_date: string | null
  priority: string
  status: CaseStatus
  description: string | null
  source: CaseSource | null
  cnr: string | null
  court_type: string | null
  case_stage: CaseStage | null
  lifecycle_stage: CaseLifecycleStage | null
  assigned_user_ids: string[]
  assignee_names: string[]
  created_by: string
  reviewed_by: string | null
  reviewed_at: string | null
  approved_by: string | null
  approved_at: string | null
  rejected_by: string | null
  rejected_at: string | null
  comments: CaseComment[]
  parties: CaseParty[]
  history: CaseHistoryEntry[]
  lifecycle_history: CaseLifecycleHistoryEntry[]
  created_at: string
}

export interface CaseCreateRequest {
  title: string
  client_name: string
  description?: string | null
  priority?: string
  assigned_user_ids?: string[]
}

export interface CaseDetailsRequest {
  case_type: string
  court_jurisdiction: string
  region: string
  court_type?: string | null
  filing_date?: string | null
  hearing_date?: string | null
}

export interface CaseCnrLinkRequest {
  cnr: string
  court_type?: string | null
}

export interface CaseDetailsResponse {
  status: 'ready' | 'pending'
  case: Case | null
  job_id: string | null
}

export interface ManualActRow {
  act: string
  section: string | null
}

export interface ManualSubMatterRow {
  case_number: string
}

export interface ManualOrderRow {
  order_date: string | null
  title: string
  document_id: string | null
  document_title: string | null
  document_mime_type: string | null
  document_storage_key: string | null
}

/** The verbose CNR-style detail (Case Details/Case Status/Acts/Sub Matters/Final
 * Orders) a manually-entered case can optionally carry as a fallback when the CNR
 * portal can't be scraped. Stored server-side as a JSON blob (not columns on the
 * case), same pattern as the CNR raw document. */
export interface ManualCaseDocument {
  filing_number: string | null
  registration_number: string | null
  registration_date: string | null
  first_hearing_date: string | null
  decision_date: string | null
  nature_of_disposal: string | null
  court_number_and_judge: string | null
  acts: ManualActRow[]
  sub_matters: ManualSubMatterRow[]
  final_orders: ManualOrderRow[]
}

export interface ManualCaseDetails {
  case_type: string | null
  client_name: string
  court_jurisdiction: string | null
  region: string | null
  court_type: string | null
  case_stage: CaseStage | null
  filing_date: string | null
  hearing_date: string | null
  parties: CaseParty[]
  history: CaseHistoryEntry[]
  document: ManualCaseDocument | null
  document_sections: Record<string, unknown>[]
}

export interface CaseFullDetailsResponse {
  source: CaseSource | null
  raw: Record<string, unknown> | null
  manual: ManualCaseDetails | null
}

export interface CnrOrderDownloadResponse {
  status: 'ready' | 'queued'
  download_url?: string
  expires_in_seconds?: number
  job_id?: string
}

export interface CnrBusinessDetailResponse {
  status: 'ready' | 'queued' | 'failed'
  section: string
  row: number
  hearing_date: string | null
  business_date: string | null
  business_detail?: Record<string, unknown> | null
  job_id?: string
  error?: { code: string; message: string; retryable: boolean; retry_after_seconds?: number }
}

export interface CasePartyCreate {
  role: string
  name: string
  advocate_name?: string | null
}

export interface CaseHistoryCreate {
  hearing_date?: string | null
  purpose?: string | null
  business_detail?: string | null
  judge?: string | null
  next_hearing_date?: string | null
  is_disposal?: boolean
}

export interface CaseUpdateRequest {
  title?: string
  case_type?: string | null
  client_name?: string | null
  court_jurisdiction?: string | null
  region?: string | null
  court_type?: string | null
  filing_date?: string | null
  hearing_date?: string | null
  priority?: string
  description?: string | null
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
  bio: string | null
  is_org_admin: boolean
  is_branch_admin: boolean
  is_active: boolean
  is_restricted: boolean
  email_notifications_enabled: boolean
  role_ids: string[]
}

export interface MyProfileUpdateRequest {
  full_name?: string | null
  phone?: string | null
  bio?: string | null
  email_notifications_enabled?: boolean
}

/** Lightweight person record for case-scoped pickers (e.g. @mentions) - only
 * includes people who can actually see a given case, unlike `User`. */
export interface CasePerson {
  id: string
  full_name: string
  email: string
}

export interface Branch {
  id: string
  tenant_id: string
  name: string
  is_frozen: boolean
  created_at: string
}

export interface Organization {
  id: string
  name: string
  is_frozen: boolean
}

export interface BranchAdminPermissions {
  user_id: string
  full_name: string
  email: string
  branch_id: string | null
  branch_name: string | null
  case_reassignment: boolean
  fee_milestone_setting: boolean
  precedent_sharing: boolean
  invite_team_members: boolean
  document_access_full: boolean
}

export interface BranchAdminPermissionsUpdate {
  branch_id: string
  case_reassignment: boolean
  fee_milestone_setting: boolean
  precedent_sharing: boolean
  invite_team_members: boolean
  document_access_full: boolean
}

export interface Permission {
  resource: string
  action: string
  scope: string
  condition: Record<string, unknown> | null
  description: string | null
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
  event_type: string | null
  read_at: string | null
  created_at: string
}
