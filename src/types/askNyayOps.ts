export type AskNyayOpsAgent = 'case_billing' | 'org_access'

export interface AskNyayOpsMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AskNyayOpsSource {
  type: 'case' | 'bill' | 'user' | 'document'
  id: string
  label: string
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
