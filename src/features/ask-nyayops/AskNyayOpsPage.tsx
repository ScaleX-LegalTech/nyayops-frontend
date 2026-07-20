import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Send } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Field'
import { NyayOpsMark } from '@/components/ui/NyayOpsMark'
import { cn } from '@/lib/cn'
import { getMe } from '@/lib/api/profile'
import { qk } from '@/lib/queryKeys'
import { ChatMessageList } from './ChatMessageList'
import { ConversationList } from './ConversationList'
import { SUGGESTED_PROMPTS } from './suggestedPrompts'
import { useAskNyayOpsChat } from './useAskNyayOpsChat'
import type { AskNyayOpsAgent } from '@/types'

const MODES: { value: AskNyayOpsAgent; label: string; empty: string }[] = [
  {
    value: 'case_billing',
    label: 'Cases & billing',
    empty: 'Try "what\'s the status of the Sharma case?" or "who\'s assigned to CS-0041?"',
  },
  {
    value: 'org_access',
    label: 'Organization & access',
    empty: 'Try "create a role for reviewers" or "who\'s a branch admin at the Pune office?"',
  },
]

/** Conversation history persists server-side (backend v1 owns it); this page
 * just resolves/creates one via `conversation_id` and renders whatever's
 * active. `?conversation=`/`?agent=` query params pick up an existing
 * conversation in the right mode instead of starting a new one - the handoff
 * AskNyayOpsLauncher's "make it large" control uses (implementation plan
 * §7.1), so expanding never loses or duplicates a turn. */
export default function AskNyayOpsPage() {
  const [searchParams] = useSearchParams()
  const [mode, setMode] = useState<AskNyayOpsAgent>(
    (searchParams.get('agent') as AskNyayOpsAgent) === 'org_access' ? 'org_access' : 'case_billing',
  )
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

  const activeMode = MODES.find((m) => m.value === mode)!

  return (
    <div className="animate-rise flex h-[calc(100vh-8rem)] flex-col">
      <PageHeader
        title="Ask NyayOps"
        description="Ask about case status, hearings, bills, or documents - answers only ever cover what you already have access to."
        actions={
          <div className="flex gap-1 rounded-control border border-border bg-surface-muted p-1">
            {MODES.map((m) => (
              <button
                key={m.value}
                onClick={() => {
                  if (m.value === mode) return
                  handleNew()
                  setMode(m.value)
                }}
                className={cn(
                  'rounded-control px-3 py-1.5 text-sm font-medium transition-colors',
                  m.value === mode ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="flex flex-1 overflow-hidden rounded-card border border-border bg-surface">
        <ConversationList
          agent={mode}
          activeId={activeConversationId}
          onSelect={handleSelect}
          onNew={handleNew}
        />

        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4">
            <ChatMessageList
              entries={entries}
              loading={loading}
              onResolvePending={resolvePending}
              emptyState={
                <div className="flex flex-col items-center gap-4 py-16 text-center">
                  <div className="grid size-14 place-items-center rounded-full bg-brand-soft text-brand">
                    <NyayOpsMark size={26} />
                  </div>
                  <div>
                    <p className="type-greeting text-lg text-ink">
                      {profile?.full_name ? `Hi ${profile.full_name}, I'm here to help` : "I'm here to help"}
                    </p>
                    <p className="mt-1 text-sm text-ink-muted">{activeMode.empty}</p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    {SUGGESTED_PROMPTS[mode].map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => void sendMessage(prompt)}
                        className="rounded-control border border-border px-3.5 py-2 text-left text-sm font-medium text-ink transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand-strong"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              }
            />
          </div>

          <form onSubmit={handleSubmit} className="flex gap-2 border-t border-border p-3">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
              placeholder="Ask about a case, bill, or hearing..."
              rows={2}
              className="min-h-0 flex-1"
            />
            <Button type="submit" disabled={loading || !input.trim()}>
              <Send className="size-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
