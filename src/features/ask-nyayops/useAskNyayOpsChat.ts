import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/ui/Toast'
import {
  askNyayOps,
  askOrgAccess,
  describeAskNyayOpsError,
  getAskNyayOpsConversation,
} from '@/lib/api/askNyayOps'
import { qk } from '@/lib/queryKeys'
import type {
  AskNyayOpsAgent,
  AskNyayOpsMessageRead,
  AskNyayOpsPendingComment,
  AskNyayOpsSource,
  PendingAction,
} from '@/types'

const SEND: Record<AskNyayOpsAgent, typeof askNyayOps> = {
  case_billing: askNyayOps,
  org_access: askOrgAccess,
}

export interface ChatEntry {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: AskNyayOpsSource[]
  /** Legacy - only ever set on messages persisted before Phase 10 (draft_case_comment
   * now returns pendingAction like every other draft_* tool). */
  pendingComment?: AskNyayOpsPendingComment
  pendingAction?: PendingAction
}

/** Only the LAST message of a loaded conversation ever renders its
 * pending_comment/pending_action as an actionable card - earlier ones are
 * inert history, since you can't re-confirm a stale draft from turns ago. */
function toEntries(messages: AskNyayOpsMessageRead[]): ChatEntry[] {
  return messages.map((m, i) => {
    const isLast = i === messages.length - 1
    return {
      id: crypto.randomUUID(),
      role: m.role,
      content: m.content,
      sources: m.sources,
      pendingComment: isLast ? (m.pending_comment ?? undefined) : undefined,
      pendingAction: isLast ? (m.pending_action ?? undefined) : undefined,
    }
  })
}

/** The one implementation of "send a message, render the reply, render a
 * pending_comment/pending_action card" (implementation plan §7.1) - both the
 * full AskNyayOpsPage and the compact AskNyayOpsLauncher call this, sharing
 * one conversation's state so "make it large" can hand off the same
 * conversation_id without losing or duplicating a turn. Conversation history
 * persists server-side (backend v1 owns it); this hook just resolves/creates
 * one via `conversation_id` and tracks whatever's active. No streaming
 * precedent exists in this codebase yet, so replies are still whole
 * request/response. */
export function useAskNyayOpsChat(agent: AskNyayOpsAgent = 'case_billing') {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [entries, setEntries] = useState<ChatEntry[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  // A conversation belongs to exactly one agent (backend-enforced - see
  // SqlAskNyayOpsConversationRepository.get_owned's agent check) - callers
  // that let the user switch `agent` (a mode toggle) must call this
  // themselves when doing so, so switching always starts fresh rather than
  // risk continuing the wrong one.
  function handleNew() {
    setActiveConversationId(null)
    setEntries([])
    setInput('')
  }

  async function handleSelect(id: string) {
    if (id === activeConversationId) return
    setLoading(true)
    try {
      const conversation = await getAskNyayOpsConversation(id)
      setActiveConversationId(conversation.id)
      setEntries(toEntries(conversation.messages))
    } catch (err) {
      toast(describeAskNyayOpsError(err), 'error')
    } finally {
      setLoading(false)
    }
  }

  /** Shared by handleSubmit (reads the textarea's `input` state) and any
   * caller that already has message text in hand - e.g. a suggested-question
   * chip - and would otherwise hit a stale-closure bug calling setInput()
   * then immediately handleSubmit() in the same handler (React state updates
   * aren't visible until the next render). */
  async function sendMessage(rawMessage: string) {
    const message = rawMessage.trim()
    if (!message || loading) return

    setEntries((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', content: message }])
    setInput('')
    setLoading(true)

    try {
      const response = await SEND[agent](message, activeConversationId ?? undefined)
      setActiveConversationId(response.conversation_id)
      setEntries((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: response.reply,
          sources: response.sources,
          pendingComment: response.pending_comment ?? undefined,
          pendingAction: response.pending_action ?? undefined,
        },
      ])
      await queryClient.invalidateQueries({ queryKey: qk.askNyayOpsConversations })
      if (response.usage_warning) toast(response.usage_warning, 'info')
    } catch (err) {
      toast(describeAskNyayOpsError(err), 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault()
    await sendMessage(input)
  }

  function resolvePending(entryId: string) {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entryId ? { ...e, pendingComment: undefined, pendingAction: undefined } : e,
      ),
    )
  }

  return {
    activeConversationId,
    entries,
    input,
    setInput,
    loading,
    handleNew,
    handleSelect,
    handleSubmit,
    sendMessage,
    resolvePending,
  }
}
