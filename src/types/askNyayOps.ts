/** 'auto' is the routed single-chat surface (the backend's intent router picks
 * the specialist per turn - redesign doc §F.5's invisible seam); the explicit
 * values only appear on conversations persisted before the unified surface. */
export type AskNyayOpsAgent = 'auto' | 'case_billing' | 'org_access'

export interface AskNyayOpsMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AskNyayOpsSource {
  type: 'case' | 'bill' | 'user' | 'document'
  id: string
  label: string
  /** Disambiguator for same-titled results (F-03) - only ever set on
   * type="case" entries, and only when the backend resolved more than one
   * candidate for a query. */
  case_number?: string | null
  status?: string | null
  /** Only ever set on type="document" entries - lets the chat panel open
   * DocumentPreviewDialog in place instead of navigating to /documents.
   * Absent on messages persisted before this field existed. */
  storage_key?: string | null
  mime_type?: string | null
  doc_type?: string | null
  uploaded_by_name?: string | null
  /** "primary" only on a document source that came from an explicit
   * document-retrieval tool call (get_case_documents) - the document-
   * retrieval UX redesign's signal to render it as the requested result with
   * the rest of this turn's sources as linked context, instead of a flat "N
   * matching results" list. Absent (not false) on every other source. */
  rank?: 'primary'
  /** Only ever set on type="document" entries - the case THIS document was
   * resolved under, from the same get_case_documents call that produced it.
   * Deliberately explicit rather than inferred from other sources in the
   * same turn: a turn can touch a second, unrelated same-named case while
   * resolving the user's reference, and that other case is not what this
   * document is linked to. */
  linked_case_id?: string | null
  linked_case_label?: string | null
}

/** Legacy - draft_case_comment used to return this exclusively (implementation
 * plan Phase 4). Since Phase 10 it returns pending_action instead, so this
 * stays null on every new turn; kept only so old, already-persisted messages
 * still render. */
export interface AskNyayOpsPendingComment {
  case_id: string
  draft_text: string
}

/** The generalized dry-run/confirm contract every state-changing assistant
 * tool returns (mirrors backend v1's PendingAction schema verbatim, Ask
 * NyayOps v2 implementation plan §4.2). Never executed by the assistant -
 * PendingActionCard's Confirm button calls the real, existing REST endpoint
 * directly, entirely outside the chat loop. */
export interface PendingAction {
  action_type: string
  tier: 'T1' | 'T2' | 'T3'
  summary: string
  before_state: Record<string, unknown> | null
  after_state: Record<string, unknown>
  would_affect: string[]
  requires_role: string
  idempotency_key: string
  notify_on_approval: string[]
}

/** A T3 PendingAction whose action_type needed a second approver (implementation
 * plan §7.1/§7.5) - server-persisted so it survives past the proposing user's
 * own session, unlike a plain PendingAction which only ever lives in one
 * chat turn. */
export interface PendingApproval {
  id: string
  action_type: string
  tier: 'T3'
  summary: string
  before_state: Record<string, unknown> | null
  after_state: Record<string, unknown>
  would_affect: string[]
  requires_role: string
  idempotency_key: string
  proposed_by_user_id: string
  proposed_by_name: string
  status: 'pending' | 'approved' | 'rejected' | 'executed'
  created_at: string
}

export interface AskNyayOpsResponse {
  conversation_id: string
  reply: string
  sources: AskNyayOpsSource[]
  pending_comment: AskNyayOpsPendingComment | null
  pending_action: PendingAction | null
  usage_warning?: string | null
}

export interface AskNyayOpsConversationSummary {
  id: string
  title: string | null
  agent: AskNyayOpsAgent
  updated_at: string
}

export interface AskNyayOpsMessageRead extends AskNyayOpsMessage {
  sources: AskNyayOpsSource[]
  pending_comment: AskNyayOpsPendingComment | null
  pending_action: PendingAction | null
  created_at: string
}

export interface AskNyayOpsConversationDetail {
  id: string
  title: string | null
  messages: AskNyayOpsMessageRead[]
}

/** The unauthenticated Bootstrap agent - helps set up a brand-new org before
 * any account exists (redesign doc Part F.1). Stateless, unlike the other two
 * agents: no conversation_id, no server-side persistence - the caller resends
 * recent turns as `history` each request. Never asks for or accepts a
 * password; draft_org_registration's pending_action (action_type
 * "org.register") is the one and only thing it can produce. */
export interface BootstrapMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface BootstrapAskResponse {
  reply: string
  pending_action: PendingAction | null
}
