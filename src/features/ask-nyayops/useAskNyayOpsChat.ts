import { useRef, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/ui/Toast'
import {
  askNyayOps,
  describeAskNyayOpsError,
  getAskNyayOpsConversation,
  streamAskNyayOpsTurnStage,
} from '@/lib/api/askNyayOps'
import { qk } from '@/lib/queryKeys'
import type {
  AskNyayOpsMessageRead,
  AskNyayOpsPendingComment,
  AskNyayOpsSource,
  PendingAction,
} from '@/types'
import type { VoiceInputAdapter } from './ChatInputBar'
import { useSpeakReplies } from './useSpeech'
import { useStreamingTTSPlayback } from './useStreamingTTSPlayback'
import { useStreamingVoice } from './useStreamingVoice'

export interface ChatEntry {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt?: string
  /** Set on a user entry whose turn failed to get a reply - no assistant
   * entry gets appended for it, so the inline retry row is anchored here
   * instead of leaving the transcript looking like nothing happened. */
  status?: 'failed'
  sources?: AskNyayOpsSource[]
  /** Legacy - only ever set on messages persisted before Phase 10 (draft_case_comment
   * now returns pendingAction like every other draft_* tool). */
  pendingComment?: AskNyayOpsPendingComment
  pendingAction?: PendingAction
  /** True for a user entry whose content came from voice input this session
   * (Improvements v1 doc §3.5/§8.2 item 7) - not persisted server-side, so a
   * reloaded conversation's carried-over pending action never shows the "you
   * said" transcript banner, only a live just-sent voice turn does. */
  viaVoice?: boolean
}

// How long a turn waits before playing a filler phrase (useSpeakReplies.playFiller) -
// short enough to mask real latency, long enough that a fast reply never overlaps it.
const FILLER_DELAY_MS = 900


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
      createdAt: m.created_at,
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
 * conversation_id without losing or duplicating a turn.
 *
 * One chat for everything: the backend's per-turn intent router decides which
 * specialist agent (cases/billing vs org/access) handles each message
 * (redesign doc §F.5's invisible seam), so there is no agent mode here
 * anymore. Voice out (Part H.2) also lives here so both surfaces behave
 * identically: when enabled, replies are read aloud - including a pending
 * action's summary - but the confirm card always still renders; a spoken
 * "yes" never resolves an action. */
export function useAskNyayOpsChat() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const speech = useSpeakReplies()
  // Both directions stream over Sarvam's WebSocket bridge - the only voice
  // path now (the batch record-whole-clip-then-upload flow was removed from
  // every authenticated surface; useSpeech.ts/useSpeechInput remains only for
  // BootstrapChat's separate, unauthenticated pre-signup surface).
  const streamingTts = useStreamingTTSPlayback()
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [entries, setEntries] = useState<ChatEntry[]>([])
  const [input, setInput] = useState('')
  // True while `input` holds a not-yet-sent voice transcript (Q47 fix - a
  // finished recording used to submit itself immediately with no chance to
  // spot a mis-transcribed case code etc; now it lands in the text box like
  // a typed draft and only sends on the user's own Send/Enter). Cleared on
  // send, on manual edit, and on starting a new conversation.
  const [inputFromVoice, setInputFromVoice] = useState(false)
  const [loading, setLoading] = useState(false)
  // Real stage label polled from the backend while a turn is in flight
  // (Improvements v1 doc §3.4/§8.2 item 6) - null until the first poll lands,
  // which ChatMessageList's ThinkingStatus falls back to its own elapsed-time
  // guess for.
  const [loadingStage, setLoadingStage] = useState<string | null>(null)

  /** Wired to both voice input paths (streaming WS and the batch fallback) -
   * a finished transcript fills the input like typed text instead of sending
   * itself, so the user gets the same look-before-you-send chance a typed
   * message always had. */
  function receiveVoiceTranscript(text: string) {
    setInput(text)
    setInputFromVoice(true)
  }

  const streamingVoice = useStreamingVoice(receiveVoiceTranscript)
  // Synchronous re-entrancy guard for sendMessage - `loading` state has the
  // same problem finalizingRef solves in useStreamingVoice.ts: it doesn't
  // update until the next render, so two calls arriving close together
  // (whatever the trigger) can both see it as false and both go through.
  // This was the actual cause of a real duplicate-send bug live-tested
  // against the streaming mic - a state-only guard here wasn't enough.
  const sendingRef = useRef(false)

  const voice: VoiceInputAdapter = {
    supported: streamingVoice.supported,
    status: streamingVoice.status,
    start: () => {
      // Starting a new recording is an explicit user action, not
      // VAD-driven barge-in - stop any reply still playing first so the
      // two don't talk over each other.
      if (streamingTts.speaking) streamingTts.stopAndFlush()
      void streamingVoice.start()
    },
    stop: streamingVoice.stop,
    cancel: streamingVoice.cancel,
    audioLevel: streamingVoice.audioLevel,
  }

  function speakIfEnabled(text: string) {
    if (!speech.enabled) return
    if (streamingTts.supported) streamingTts.speak(text)
    else speech.speak(text)
  }

  function handleNew() {
    setActiveConversationId(null)
    setEntries([])
    setInput('')
    setInputFromVoice(false)
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
  async function sendMessage(rawMessage: string, viaVoice = false) {
    const message = rawMessage.trim()
    if (!message || sendingRef.current) return
    const entryId = crypto.randomUUID()
    setEntries((prev) => [
      ...prev,
      {
        id: entryId,
        role: 'user',
        content: message,
        createdAt: new Date().toISOString(),
        viaVoice,
      },
    ])
    setInput('')
    await deliverMessage(entryId, message)
  }

  /** Re-sends a user turn that previously failed (F-05) - reuses the same
   * entry instead of pushing a duplicate user bubble, and clears its
   * `status: 'failed'` marker before retrying. */
  async function retryMessage(entryId: string) {
    const entry = entries.find((e) => e.id === entryId)
    if (!entry) return
    setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, status: undefined } : e)))
    await deliverMessage(entryId, entry.content)
  }

  async function deliverMessage(entryId: string, message: string) {
    if (sendingRef.current) return
    sendingRef.current = true
    setLoading(true)
    setLoadingStage(null)

    // Filler audio (Improvements v1 doc §3.4/§8.2 item 6) - only fires if the
    // turn is still in flight after the delay; cleared below either way.
    const fillerTimer = speech.enabled ? setTimeout(() => speech.playFiller(), FILLER_DELAY_MS) : null

    // Stage-labelled status text (same doc item, the other half) - a held-
    // open SSE connection instead of polling: the old fixed-interval poller
    // sent one request every 600ms for the ENTIRE turn (hundreds of requests
    // on a turn that hangs a minute or more, which does happen - Gemini-side
    // rate limiting/retries). Best-effort like the old poller - a stream
    // error just means the UI keeps whatever stage it last had.
    const turnId = crypto.randomUUID()
    const closeStagePoller = streamAskNyayOpsTurnStage(turnId, setLoadingStage)

    try {
      const response = await askNyayOps(message, activeConversationId ?? undefined, turnId)
      setActiveConversationId(response.conversation_id)
      setEntries((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: response.reply,
          createdAt: new Date().toISOString(),
          sources: response.sources,
          pendingComment: response.pending_comment ?? undefined,
          pendingAction: response.pending_action ?? undefined,
        },
      ])
      speakIfEnabled(response.reply)
      await queryClient.invalidateQueries({ queryKey: qk.askNyayOpsConversationsAll })
      if (response.usage_warning) toast(response.usage_warning, 'info')
    } catch (err) {
      toast(describeAskNyayOpsError(err), 'error')
      setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, status: 'failed' } : e)))
    } finally {
      if (fillerTimer) clearTimeout(fillerTimer)
      closeStagePoller()
      sendingRef.current = false
      setLoading(false)
      setLoadingStage(null)
    }
  }

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault()
    const viaVoice = inputFromVoice
    setInputFromVoice(false)
    await sendMessage(input, viaVoice)
  }

  /** Confirming/discarding a pending action never goes back through the
   * model - the card calls the real REST endpoint directly, entirely outside
   * the chat loop (PendingActionCard's own doc comment) - so there was
   * previously no reply in the thread at all once a card resolved, just a
   * toast easy to miss. `message`, when given, is appended as a synthetic
   * assistant turn straight from the client (not sent to or echoed by the
   * backend, so it won't survive a reload of this conversation) - a hard
   * rewire, not a second model call, for something this mechanical. */
  function resolvePending(entryId: string, message?: string) {
    setEntries((prev) => {
      const cleared = prev.map((e) =>
        e.id === entryId ? { ...e, pendingComment: undefined, pendingAction: undefined } : e,
      )
      if (!message) return cleared
      return [...cleared, { id: crypto.randomUUID(), role: 'assistant' as const, content: message }]
    })
    if (message) speakIfEnabled(message)
  }

  return {
    activeConversationId,
    entries,
    input,
    setInput,
    inputFromVoice,
    receiveVoiceTranscript,
    loading,
    loadingStage,
    handleNew,
    handleSelect,
    handleSubmit,
    sendMessage,
    retryMessage,
    resolvePending,
    speechSupported: speech.supported,
    speakReplies: speech.enabled,
    toggleSpeakReplies: speech.toggle,
    voice,
  }
}
