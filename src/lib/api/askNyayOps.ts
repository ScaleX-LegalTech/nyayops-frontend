import type {
  AskNyayOpsConversationDetail,
  AskNyayOpsConversationSummary,
  AskNyayOpsResponse,
  BootstrapAskResponse,
  BootstrapMessage,
} from '@/types'
import { ApiError, del, get, post } from './client'

/** Maps an Ask NyayOps failure to copy a non-technical user can act on. Known,
 * user-caused conditions (rate limit, message too long, no access) get their
 * specific message; anything else - a 500, a network failure, an ask-nyayops-
 * service outage - isn't something the user can fix themselves, so point them
 * at support instead of a bare "try again". */
export function describeAskNyayOpsError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'rate_limited' || error.code === 'message_too_long') return error.message
    if (error.status === 403) return "You don't have access to Ask NyayOps."
    if (error.status < 500) return error.message
  }
  return 'Something went wrong on our end. If this keeps happening, please contact the NyayOps team.'
}

/** Talks only to backend v1's own proxy route - the frontend never calls the
 * separate ask-nyayops-service directly (same pattern as Court Data Service).
 * Omit conversationId to start a new conversation - backend v1 owns history
 * now (it loads prior turns itself and forwards them to ask-nyayops-service),
 * so the caller no longer sends its own copy of the transcript. */
export function askNyayOps(message: string, conversationId?: string): Promise<AskNyayOpsResponse> {
  return post<AskNyayOpsResponse>('/ask-nyayops/ask', {
    message,
    conversation_id: conversationId ?? null,
  })
}

/** The Org & Access agent - branches, roles, permissions, branch-admin
 * matrices, user invites/roles, org freeze, bill types. A separate agent
 * from askNyayOps (structurally disjoint tool list, its own conversation
 * history tagged agent="org_access" server-side) - never case/bill data. */
export function askOrgAccess(message: string, conversationId?: string): Promise<AskNyayOpsResponse> {
  return post<AskNyayOpsResponse>('/ask-nyayops/org-access/ask', {
    message,
    conversation_id: conversationId ?? null,
  })
}

/** The unauthenticated Bootstrap agent (POST /ask-nyayops/bootstrap, no bearer
 * token attached - apiFetch only adds one when getAccessToken() has a value,
 * which it never does pre-signup). Stateless: the caller resends the running
 * `history` every turn since there's no user yet to own a persisted
 * conversation against. */
export function askBootstrap(
  message: string,
  history: BootstrapMessage[],
): Promise<BootstrapAskResponse> {
  return post<BootstrapAskResponse>('/ask-nyayops/bootstrap', { message, history })
}

export function listAskNyayOpsConversations(): Promise<AskNyayOpsConversationSummary[]> {
  return get<AskNyayOpsConversationSummary[]>('/ask-nyayops/conversations')
}

export function getAskNyayOpsConversation(id: string): Promise<AskNyayOpsConversationDetail> {
  return get<AskNyayOpsConversationDetail>(`/ask-nyayops/conversations/${id}`)
}

export function deleteAskNyayOpsConversation(id: string): Promise<void> {
  return del<void>(`/ask-nyayops/conversations/${id}`)
}

export interface AssistantAuditEventPayload {
  action_type: string
  resource_id: string
  comment?: string
  new_state?: Record<string, unknown>
}

/** Records ASSISTANT_QUERY/ASSISTANT_COMMENT_DRAFTED/ASSISTANT_HITL_APPROVED
 * events into the existing audit trail - see PendingCommentCard for the
 * HITL-approval call site (the "who approved this" record). */
export function recordAssistantAuditEvent(payload: AssistantAuditEventPayload): Promise<void> {
  return post<void>('/ask-nyayops/audit-event', payload)
}
