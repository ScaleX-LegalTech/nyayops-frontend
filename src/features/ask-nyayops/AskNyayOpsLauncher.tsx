import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { History, Maximize2, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Field'
import { NyayOpsMark } from '@/components/ui/NyayOpsMark'
import { cn } from '@/lib/cn'
import { getMe } from '@/lib/api/profile'
import { qk } from '@/lib/queryKeys'
import { usePermissions } from '@/lib/usePermissions'
import { ChatMessageList } from './ChatMessageList'
import { ConversationList } from './ConversationList'
import { SUGGESTED_PROMPTS } from './suggestedPrompts'
import { useAskNyayOpsChat } from './useAskNyayOpsChat'
import type { AskNyayOpsAgent } from '@/types'

const MODES: { value: AskNyayOpsAgent; label: string }[] = [
  { value: 'case_billing', label: 'Cases & billing' },
  { value: 'org_access', label: 'Org & access' },
]

/** Persistent, always-visible floating launcher (implementation plan §7.1,
 * redesign doc Part K) - a second instance of the pattern NotificationsBell
 * already uses in this codebase (click-to-open, click-outside-to-close), just
 * fixed-position instead of header-anchored so it's reachable from any page,
 * not only when the header is in view. Shares useAskNyayOpsChat/
 * ChatMessageList with the full AskNyayOpsPage - there is exactly one
 * implementation of "send a message, render the reply, render a pending
 * card," not two that can drift apart. */
export function AskNyayOpsLauncher() {
  const { hasPermission } = usePermissions()
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'chat' | 'history'>('chat')
  const [mode, setMode] = useState<AskNyayOpsAgent>('case_billing')
  const ref = useRef<HTMLDivElement>(null)
  const { data: profile } = useQuery({ queryKey: qk.myProfile, queryFn: getMe })
  const {
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
  } = useAskNyayOpsChat(mode)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // Never show the launcher on the full page itself - it would just duplicate
  // the same conversation UI already open.
  if (!hasPermission('assistant', 'use') || location.pathname === '/ask-nyayops') return null

  function handleMaximize() {
    setOpen(false)
    const params = new URLSearchParams({ agent: mode })
    if (activeConversationId) params.set('conversation', activeConversationId)
    navigate(`/ask-nyayops?${params.toString()}`)
  }

  const firstName = profile?.full_name?.split(' ')[0]

  return (
    <div ref={ref} style={{ zIndex: 'var(--z-popover)' }} className="fixed right-5 bottom-5">
      {open && (
        <div className="animate-rise mb-3 flex h-[32rem] w-[min(92vw,24rem)] flex-col overflow-hidden rounded-card border border-border bg-surface shadow-pop">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              <NyayOpsMark size={16} className="text-brand" /> Ask NyayOps
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setView((v) => (v === 'history' ? 'chat' : 'history'))}
                className={cn(
                  'rounded-control p-1.5 hover:bg-surface-muted',
                  view === 'history' ? 'text-brand' : 'text-ink-faint hover:text-ink',
                )}
                aria-label="Conversation history"
                title="Conversation history"
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

          <div className="flex gap-1 border-b border-border bg-surface-muted p-1.5">
            {MODES.map((m) => (
              <button
                key={m.value}
                onClick={() => {
                  if (m.value === mode) return
                  handleNew()
                  setMode(m.value)
                }}
                className={cn(
                  'flex-1 rounded-control px-2 py-1 text-xs font-medium transition-colors',
                  m.value === mode ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
                )}
              >
                {m.label}
              </button>
            ))}
          </div>

          {view === 'history' ? (
            <ConversationList
              agent={mode}
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
              <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
                <ChatMessageList
                  entries={entries}
                  loading={loading}
                  onResolvePending={resolvePending}
                  emptyState={
                    <div className="flex flex-col items-center gap-4 py-8 text-center">
                      <div className="grid size-11 place-items-center rounded-full bg-brand-soft text-brand">
                        <NyayOpsMark size={22} />
                      </div>
                      <div>
                        <p className="type-greeting text-base text-ink">
                          {firstName ? `Hi ${firstName}, I'm here to help` : "I'm here to help"}
                        </p>
                        <p className="mt-1 text-sm text-ink-muted">
                          {mode === 'case_billing'
                            ? 'Ask about a case, bill, or hearing.'
                            : 'Ask about branches, roles, permissions, or people.'}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1.5 self-stretch">
                        {SUGGESTED_PROMPTS[mode].map((prompt) => (
                          <button
                            key={prompt}
                            type="button"
                            onClick={() => void sendMessage(prompt)}
                            className="rounded-control border border-border px-3 py-2 text-left text-xs font-medium text-ink transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand-strong"
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    </div>
                  }
                />
              </div>

              <form onSubmit={handleSubmit} className="flex gap-2 border-t border-border p-2.5">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSubmit()
                    }
                  }}
                  placeholder="Ask a quick question..."
                  rows={1}
                  className="min-h-0 flex-1"
                />
                <Button type="submit" size="icon" disabled={loading || !input.trim()}>
                  <Send className="size-4" />
                </Button>
              </form>
            </>
          )}
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Ask NyayOps"
        className={cn(
          'grid size-12 place-items-center rounded-full bg-brand text-white shadow-pop transition-colors hover:bg-brand-strong',
          !open && 'animate-fab-breathe',
        )}
      >
        {open ? <X className="size-5" /> : <NyayOpsMark size={22} />}
      </button>
    </div>
  )
}
