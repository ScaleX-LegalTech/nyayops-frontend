import type { BillFlowDirection } from './bills'

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
 * never gated by this. Collection, Scrutiny, and Research & Draft are gated - a missing
 * key here just means that stage isn't enforced. */
export const REQUIRED_DOC_TYPE_FOR: Partial<Record<CaseLifecycleStage, string>> = {
  collection: 'collection_document',
  scrutiny: 'scrutiny_report',
  research_draft: 'research_draft_document',
}

/** The curated document type each of these stages used to hard-require (now backend-
 * ungated - see REQUIRED_DOC_TYPE_FOR above/domain/case_fsm.py) but is still worth a
 * gentle "you sure?" nudge for before moving on, since it's not been enforced yet in
 * practice. Purely a frontend UX prompt - not mirrored by anything backend-side. */
export const OPTIONAL_DOC_TYPE_FOR: Partial<Record<CaseLifecycleStage, string>> = {
  filed: 'filing_document',
  cnr_linked: 'filing_document',
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

export interface CaseCommentQuotePreview {
  id: string
  author_id: string
  comment_preview: string
}

export interface CaseComment {
  id: string
  author_id: string
  /** Null when deleted_at is set - the tombstone blanks content server-side. */
  comment: string | null
  created_at: string
  attachments: CaseCommentAttachment[]
  reply_to: CaseCommentQuotePreview | null
  deleted_at: string | null
  /** Only set when someone other than the author deleted it (admin moderation). */
  deleted_by_name: string | null
  deleted_by_access: string | null
  /** Precomputed server-side (author: 15 min; org/branch admin: 1 day). */
  can_delete_for_everyone: boolean
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
  // Scrutiny-stage approval - distinct from the reviewed/approved/rejected trail
  // above (the overall case-status review flow). null until someone with
  // cases:approve_scrutiny acts on it; cleared back to null whenever a fresh
  // scrutiny_report is uploaded (a corrected document needs a fresh look).
  scrutiny_review_status: 'approved' | 'rejected' | null
  scrutiny_reviewed_by: string | null
  scrutiny_reviewed_at: string | null
  scrutiny_rejection_reason: string | null
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
  // Required unless the creator has their own branch (the backend rejects a
  // branch-less create otherwise) - only a Managing Director needs to supply this.
  branch_id?: string | null
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
  limit?: number
  offset?: number
}

// Slim case shape for list views (GET /cases) - matches CaseDashboardCard on the
// backend. Only what's actually rendered anywhere a case shows up as a row/card.
export interface CaseDashboardCard {
  id: string
  branch_name: string | null
  case_code: string
  title: string
  client_name: string
  court_jurisdiction: string | null
  region: string | null
  hearing_date: string | null
  priority: string
  status: CaseStatus
  lifecycle_stage: CaseLifecycleStage | null
  scrutiny_review_status: 'approved' | 'rejected' | null
  assignee_names: string[]
  created_at: string
  billing_stage: BillFlowDirection | null
  billing_type: string | null
}

export interface CasePage {
  items: CaseDashboardCard[]
  has_more: boolean
}

// Case-picker dropdown shape (GET /cases/options) - matches CaseOption on the
// backend. Not even assignee_names; CaseDashboardCard is the right shape for
// anything that renders a case as a row.
export interface CaseOption {
  id: string
  title: string
  status: CaseStatus
  lifecycle_stage: CaseLifecycleStage | null
}

/** Lightweight person record for case-scoped pickers (e.g. @mentions) - only
 * includes people who can actually see a given case, unlike `User`. */
export interface CasePerson {
  id: string
  full_name: string
  email: string
  name_prefix: string | null
  name_suffix: string | null
}
