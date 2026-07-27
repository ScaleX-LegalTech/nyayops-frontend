import type {
  AskNyayOpsConversationDetail,
  AskNyayOpsConversationSummary,
  AskNyayOpsResponse,
  BootstrapAskResponse,
  BootstrapMessage,
} from '@/types'
import { ApiError, del, get, patch, post, toQuery } from './client'

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
 * One endpoint for every domain: the backend's per-turn intent router picks
 * the right specialist agent (cases/billing vs org/access), so there is no
 * mode for the caller to choose. Omit conversationId to start a new
 * conversation - the AI service owns history server-side, so the caller never
 * sends its own copy of the transcript. */
export function askNyayOps(
  message: string,
  conversationId?: string,
  turnId?: string,
): Promise<AskNyayOpsResponse> {
  return post<AskNyayOpsResponse>('/ask-nyayops/ask', {
    message,
    conversation_id: conversationId ?? null,
    turn_id: turnId ?? null,
  })
}

/** Polled while a turn started with the same turnId is in flight (Improvements
 * v1 doc §3.4/§8.2 item 6) - returns whatever stage label the agent's tool-
 * calling loop last reported, or null before the first one lands (or once the
 * turn has already finished and the key's expired). Never throws on a 404-ish
 * "nothing yet" case - there isn't one, the backend always returns 200 with a
 * possibly-null stage. */
export function getAskNyayOpsTurnStage(turnId: string): Promise<{ stage: string | null }> {
  return get<{ stage: string | null }>(`/ask-nyayops/turn-stage/${turnId}`)
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

export function listAskNyayOpsConversations(q?: string): Promise<AskNyayOpsConversationSummary[]> {
  return get<AskNyayOpsConversationSummary[]>(`/ask-nyayops/conversations${toQuery({ q })}`)
}

export function getAskNyayOpsConversation(id: string): Promise<AskNyayOpsConversationDetail> {
  return get<AskNyayOpsConversationDetail>(`/ask-nyayops/conversations/${id}`)
}

export function renameAskNyayOpsConversation(
  id: string,
  title: string,
): Promise<AskNyayOpsConversationSummary> {
  return patch<AskNyayOpsConversationSummary>(`/ask-nyayops/conversations/${id}`, { title })
}

export function deleteAskNyayOpsConversation(id: string): Promise<void> {
  return del<void>(`/ask-nyayops/conversations/${id}`)
}

export function listArchivedAskNyayOpsConversations(): Promise<AskNyayOpsConversationSummary[]> {
  return get<AskNyayOpsConversationSummary[]>('/ask-nyayops/conversations/archived')
}

export function restoreAskNyayOpsConversation(id: string): Promise<AskNyayOpsConversationSummary> {
  return post<AskNyayOpsConversationSummary>(`/ask-nyayops/conversations/${id}/restore`, {})
}

export function hardDeleteAskNyayOpsConversation(id: string): Promise<void> {
  return del<void>(`/ask-nyayops/conversations/${id}/permanent`)
}

/** Push-to-talk clip in (base64, whatever container MediaRecorder produced -
 * see useSpeech.ts), transcript out. Sarvam's own STT call lives entirely in
 * ask-nyayops-service; this is a plain proxy hop like every other route here. */
export function speechToText(
  audioBase64: string,
  audioFormat: string,
): Promise<{ transcript: string; language_code: string | null }> {
  return post('/ask-nyayops/speech-to-text', {
    audio_base64: audioBase64,
    audio_format: audioFormat,
  })
}

/** Text in, base64-encoded audio out (see useSpeech.ts's useSpeakReplies for
 * decode + playback). */
export function textToSpeech(text: string): Promise<{ audio_base64: string; audio_format: string }> {
  return post('/ask-nyayops/text-to-speech', { text })
}

/** Unauthenticated mirrors of speechToText/textToSpeech for BootstrapChat -
 * same no-bearer-token reasoning as askBootstrap above. Rate-limited by
 * caller IP on the backend, not a user id. */
export function bootstrapSpeechToText(
  audioBase64: string,
  audioFormat: string,
): Promise<{ transcript: string; language_code: string | null }> {
  return post('/ask-nyayops/bootstrap/speech-to-text', {
    audio_base64: audioBase64,
    audio_format: audioFormat,
  })
}

export function bootstrapTextToSpeech(
  text: string,
): Promise<{ audio_base64: string; audio_format: string }> {
  return post('/ask-nyayops/bootstrap/text-to-speech', { text })
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
