import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowDown, History, Maximize2, Plus, X } from 'lucide-react'
import { NyayOpsMark } from '@/components/ui/NyayOpsMark'
import { cn } from '@/lib/cn'
import { getMe } from '@/lib/api/profile'
import { qk } from '@/lib/queryKeys'
import { usePermissions } from '@/lib/usePermissions'
import { AskNyayOpsEmptyState } from './AskNyayOpsEmptyState'
import { ChatAttachDropZone } from './ChatAttachDropZone'
import { ChatInputBar } from './ChatInputBar'
import { ChatMessageList } from './ChatMessageList'
import { ConversationList } from './ConversationList'
import { ConversationTypeIndicator } from './ConversationTypeIndicator'
import { inferModuleFromEntries } from './filterHelpers'
import { useAskNyayOpsChat } from './useAskNyayOpsChat'
import { useScrollToBottom } from './useScrollToBottom'

/** Persistent, always-visible floating launcher (implementation plan §7.1,
 * redesign doc Part K) - a second instance of the pattern NotificationsBell
 * already uses in this codebase (click-to-open, click-outside-to-close), just
 * fixed-position instead of header-anchored so it's reachable from any page,
 * not only when the header is in view. Shares useAskNyayOpsChat/
 * ChatMessageList with the full AskNyayOpsPage - there is exactly one
 * implementation of "send a message, render the reply, render a pending
 * card," not two that can drift apart. One chat for every domain: the
 * backend's intent router picks the specialist per turn, so there is no
 * agent mode strip here anymore. */
export function AskNyayOpsLauncher() {
  const { hasPermission } = usePermissions()
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'chat' | 'history'>('chat')
  const ref = useRef<HTMLDivElement>(null)
  const { data: profile } = useQuery({ queryKey: qk.myProfile, queryFn: getMe })
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

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const scrollRef = useRef<HTMLDivElement>(null)
  const { atBottom, handleScroll, scrollToBottom } = useScrollToBottom(
    scrollRef,
    entries.length,
    activeConversationId,
  )
  const activeModule = inferModuleFromEntries(entries)

  // Never show the launcher on the full page itself - it would just duplicate
  // the same conversation UI already open.
  if (!hasPermission('assistant', 'use') || location.pathname === '/ask-nyayops') return null

  function handleMaximize() {
    setOpen(false)
    const params = new URLSearchParams()
    if (activeConversationId) params.set('conversation', activeConversationId)
    const query = params.toString()
    navigate(query ? `/ask-nyayops?${query}` : '/ask-nyayops')
  }

  const firstName = profile?.full_name?.split(' ')[0]

  return (
    <div ref={ref} style={{ zIndex: 'var(--z-popover)' }} className="fixed right-6 bottom-10">
      {open && (
        <ChatAttachDropZone className="animate-rise flex h-[min(28rem,70vh)] w-[min(92vw,24rem)] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-card border border-border bg-surface shadow-pop">
          <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
            <div className="flex items-center gap-2.5">
              <div className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                <NyayOpsMark size={16} />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">Ask NyayOps</p>
                <p className="text-[0.6875rem] text-ink-muted">Legal Operations Assistant</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  handleNew()
                  setView('chat')
                }}
                className="rounded-control p-1.5 text-ink-faint transition-colors hover:bg-surface-muted hover:text-ink"
                aria-label="New conversation"
                title="New conversation"
              >
                <Plus className="size-4" />
              </button>
              <button
                onClick={() => setView((v) => (v === 'history' ? 'chat' : 'history'))}
                className={cn(
                  'rounded-control p-1.5 hover:bg-surface-muted',
                  view === 'history' ? 'text-brand' : 'text-ink-faint hover:text-ink',
                )}
                aria-label="Request history"
                title="Request history"
              >
                <History className="size-4" />
              </button>
              <button
                onClick={handleMaximize}
                className="rounded-control p-1.5 text-ink-faint hover:bg-surface-muted hover:text-ink"
                aria-label="Open full page"
                title="Open full page"
              >
                <Maximize2 className="size-4" />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="rounded-control p-1.5 text-ink-faint hover:bg-surface-muted hover:text-ink"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {view === 'history' ? (
            <ConversationList
              activeId={activeConversationId}
              variant="panel"
              onSelect={(id) => {
                void handleSelect(id)
                setView('chat')
              }}
              onNew={() => {
                handleNew()
                setView('chat')
              }}
            />
          ) : (
            <>
              {activeModule && (
                <div className="border-b border-border px-3 py-2">
                  <ConversationTypeIndicator entries={entries} />
                </div>
              )}
              <div className="relative flex-1 overflow-hidden">
                <div
                  ref={scrollRef}
                  onScroll={handleScroll}
                  className="scrollbar-thin h-full overflow-y-auto p-2.5"
                >
                  <ChatMessageList
                    entries={entries}
                    loading={loading}
                    loadingStage={loadingStage}
                    onResolvePending={resolvePending}
                    onSelectSource={(source) => void sendMessage(source.label)}
                    onRetry={(entryId) => void retryMessage(entryId)}
                    emptyState={
                      <AskNyayOpsEmptyState
                        size="compact"
                        name={firstName}
                        onPrompt={(prompt) => void sendMessage(prompt)}
                      />
                    }
                  />
                </div>

                {!atBottom && entries.length > 0 && (
                  <button
                    type="button"
                    onClick={() => scrollToBottom()}
                    aria-label="Scroll to latest message"
                    title="Scroll to latest message"
                    className="animate-fade-scale-in absolute bottom-3 left-1/2 grid size-8 -translate-x-1/2 place-items-center rounded-full bg-brand text-white shadow-pop transition-colors hover:bg-brand-strong"
                  >
                    <ArrowDown className="size-3.5" />
                  </button>
                )}
              </div>

              <div className="min-w-0 border-t border-border p-2">
                <ChatInputBar
                  value={input}
                  onChange={setInput}
                  onSubmit={handleSubmit}
                  onTranscript={receiveVoiceTranscript}
                  loading={loading}
                  placeholder="Ask a quick question..."
                  speechSupported={speechSupported}
                  speakReplies={speakReplies}
                  onToggleSpeakReplies={toggleSpeakReplies}
                  voice={voice}
                  voiceDraft={inputFromVoice}
                />
              </div>
            </>
          )}
        </ChatAttachDropZone>
      )}

      {/* Only rendered when closed - the header's own X (above) is the single
       * close action once open, so there is never a second/duplicate close
       * control floating outside the widget. */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Ask NyayOps"
          title="Ask NyayOps"
          className="animate-fab-breathe grid size-12 place-items-center rounded-full bg-brand text-white shadow-pop transition-colors hover:bg-brand-strong"
        >
          <NyayOpsMark size={28} />
        </button>
      )}
    </div>
  )
}
