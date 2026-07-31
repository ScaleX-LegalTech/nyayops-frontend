import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowDown, ShieldCheck } from 'lucide-react'
import { NyayOpsMark } from '@/components/ui/NyayOpsMark'
import { useAuth } from '@/auth/AuthContext'
import { getOrganizationName } from '@/lib/api/organization'
import { getMe } from '@/lib/api/profile'
import { qk } from '@/lib/queryKeys'
import { AskNyayOpsEmptyState } from './AskNyayOpsEmptyState'
import { CaseContextPanel } from './CaseContextPanel'
import { ChatAttachDropZone } from './ChatAttachDropZone'
import { ChatInputBar } from './ChatInputBar'
import { ChatMessageList } from './ChatMessageList'
import { ConversationList } from './ConversationList'
import { ConversationTypeIndicator } from './ConversationTypeIndicator'
import { inferModuleFromEntries, latestCaseSourceId } from './filterHelpers'
import { useAskNyayOpsChat } from './useAskNyayOpsChat'
import { useScrollToBottom } from './useScrollToBottom'

/** One chat surface for everything - cases, bills, documents, hearings,
 * branches, roles, people. The backend's per-turn intent router picks the
 * right specialist agent invisibly (redesign doc §F.5), so there is no mode
 * toggle here anymore; ask about a case and pivot to inviting a colleague in
 * the same thread. Conversation history persists server-side; this page just
 * resolves/creates one via `conversation_id` and renders whatever's active.
 * `?conversation=` picks up an existing conversation - the handoff
 * AskNyayOpsLauncher's "make it large" control uses (implementation plan
 * §7.1), so expanding never loses or duplicates a turn. */
export default function AskNyayOpsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const { data: profile } = useQuery({ queryKey: qk.myProfile, queryFn: getMe })
  const { data: org } = useQuery({ queryKey: qk.organizationName, queryFn: getOrganizationName })
  const {
    activeConversationId,
    entries,
    input,
    setInput,
    loading,
    loadingStage,
    handleNew,
    handleSelect,
    handleSubmit,
    sendMessage,
    retryMessage,
    resolvePending,
    speechSupported,
    speakReplies,
    toggleSpeakReplies,
    voice,
    inputFromVoice,
    receiveVoiceTranscript,
  } = useAskNyayOpsChat()

  const pickedUpFrom = useRef<string | null>(null)
  useEffect(() => {
    const conversationId = searchParams.get('conversation')
    if (!conversationId || pickedUpFrom.current === conversationId) return
    pickedUpFrom.current = conversationId
    void handleSelect(conversationId)
    // handleSelect is stable across renders (defined fresh per useAskNyayOpsChat
    // call, but its identity churn doesn't matter here - pickedUpFrom guards
    // against ever re-running this for the same conversation).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // Keep `?conversation=` in lockstep with whichever thread is actually
  // active (switching in the sidebar, or a first message minting a new one) -
  // previously only the initial handoff param was ever read, never written
  // back, so navigating away (e.g. following a case link) and hitting the
  // browser's Back button returned to a stale/blank conversation instead of
  // the one you were just reading.
  useEffect(() => {
    if (searchParams.get('conversation') === activeConversationId) return
    const next = new URLSearchParams(searchParams)
    if (activeConversationId) next.set('conversation', activeConversationId)
    else next.delete('conversation')
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId])

  const scrollRef = useRef<HTMLDivElement>(null)
  const { atBottom, handleScroll, scrollToBottom } = useScrollToBottom(
    scrollRef,
    entries.length,
    activeConversationId,
  )
  const activeModule = inferModuleFromEntries(entries)
  const activeCaseId = latestCaseSourceId(entries)

  return (
    <div className="animate-rise flex h-[calc(100vh-8rem)] flex-col">
      <div className="mb-4 flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
          <NyayOpsMark size={20} />
        </div>
        <div>
          <h1 className="type-page-title text-lg text-ink">Ask NyayOps</h1>
          <p className="text-xs text-ink-muted">Legal Operations Assistant</p>
        </div>
        {org?.name && (
          <p className="ml-auto flex items-center gap-1 text-xs text-ink-muted">
            {org.name}
            <span aria-hidden>·</span>
            {user?.is_org_admin ? (
              <span className="flex items-center gap-1">
                <ShieldCheck className="size-3.5 text-brand" /> Organization admin
              </span>
            ) : (
              'Team member'
            )}
          </p>
        )}
      </div>

      <ChatAttachDropZone className="flex flex-1 overflow-hidden rounded-card border border-border bg-surface">
        <ConversationList
          activeId={activeConversationId}
          onSelect={handleSelect}
          onNew={handleNew}
        />

        <div className="flex flex-1 flex-col overflow-hidden">
          {activeModule && (
            <div className="border-b border-border px-6 py-2.5">
              <div className="mx-auto max-w-3xl">
                <ConversationTypeIndicator entries={entries} />
              </div>
            </div>
          )}
          <div className="relative flex-1 overflow-hidden">
            <div ref={scrollRef} onScroll={handleScroll} className="h-full overflow-y-auto p-6">
              <div className="mx-auto max-w-3xl">
                <ChatMessageList
                  entries={entries}
                  loading={loading}
                  loadingStage={loadingStage}
                  onResolvePending={resolvePending}
                  onSelectSource={(source) => void sendMessage(source.label)}
                  onRetry={(entryId) => void retryMessage(entryId)}
                  hideCaseFactCard={!!activeCaseId}
                  emptyState={
                    <AskNyayOpsEmptyState
                      size="full"
                      name={profile?.full_name?.split(' ')[0]}
                      onPrompt={(prompt) => void sendMessage(prompt)}
                    />
                  }
                />
              </div>
            </div>

            {!atBottom && entries.length > 0 && (
              <button
                type="button"
                onClick={() => scrollToBottom()}
                aria-label="Scroll to latest message"
                title="Scroll to latest message"
                className="animate-fade-scale-in absolute bottom-4 left-1/2 grid size-9 -translate-x-1/2 place-items-center rounded-full bg-brand text-white shadow-pop transition-colors hover:bg-brand-strong"
              >
                <ArrowDown className="size-4" />
              </button>
            )}
          </div>

          <div className="border-t border-border p-3">
            <div className="mx-auto max-w-3xl">
              <ChatInputBar
                value={input}
                onChange={setInput}
                onSubmit={handleSubmit}
                onTranscript={receiveVoiceTranscript}
                loading={loading}
                placeholder="Ask NyayOps anything about cases, hearings, billing..."
                speechSupported={speechSupported}
                speakReplies={speakReplies}
                onToggleSpeakReplies={toggleSpeakReplies}
                voice={voice}
                voiceDraft={inputFromVoice}
              />
            </div>
          </div>
        </div>

        {activeCaseId && <CaseContextPanel caseId={activeCaseId} />}
      </ChatAttachDropZone>
    </div>
  )
}
