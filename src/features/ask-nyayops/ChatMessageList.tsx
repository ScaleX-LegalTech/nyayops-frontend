import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { User } from 'lucide-react'
import { NyayOpsMark } from '@/components/ui/NyayOpsMark'
import { cn } from '@/lib/cn'
import { MarkdownLite } from '@/lib/markdownLite'
import { PendingCommentCard } from './PendingCommentCard'
import { PendingActionCard } from './PendingActionCard'
import type { ChatEntry } from './useAskNyayOpsChat'
import type { AskNyayOpsSource } from '@/types'

const SOURCE_HREF: Record<AskNyayOpsSource['type'], (id: string) => string> = {
  case: (id) => `/cases/${id}`,
  bill: () => '/bills',
  document: () => '/documents',
  user: () => '/admin/users',
}

interface ChatMessageListProps {
  entries: ChatEntry[]
  loading: boolean
  onResolvePending: (entryId: string) => void
  emptyState: ReactNode
}

function AssistantAvatar({ thinking = false }: { thinking?: boolean }) {
  return (
    <div className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
      <NyayOpsMark size={15} animate={thinking} />
    </div>
  )
}

/** The one implementation of rendering a conversation's turns - message
 * bubbles, source links, and the pending_comment/pending_action confirm card
 * on the last assistant turn (implementation plan §7.1). Shared by the full
 * AskNyayOpsPage and the compact AskNyayOpsLauncher panel so they can never
 * visually drift apart.
 *
 * Assistant turns render as plain flowing text (no bubble fill) with the
 * NyayOpsMark avatar carrying the brand identity - user turns keep a filled
 * pill. That asymmetry is deliberate, matching how Gemini/most AI-answer
 * surfaces read: a bubble on both sides looks like SMS, not an answer. */
export function ChatMessageList({ entries, loading, onResolvePending, emptyState }: ChatMessageListProps) {
  if (entries.length === 0) return <>{emptyState}</>

  return (
    <div className="flex flex-col gap-5">
      {entries.map((entry, index) => (
        <div
          key={entry.id}
          className={cn(
            'animate-message-in flex gap-3',
            entry.role === 'user' && 'flex-row-reverse',
          )}
        >
          {entry.role === 'user' ? (
            <div className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-muted text-ink-muted">
              <User className="size-3.5" />
            </div>
          ) : (
            <AssistantAvatar />
          )}
          <div className={cn('max-w-[85%] min-w-0', entry.role === 'user' && 'items-end')}>
            {entry.role === 'user' ? (
              <div className="rounded-card bg-brand px-4 py-2.5 text-sm whitespace-pre-wrap text-white">
                {entry.content}
              </div>
            ) : (
              <div className="space-y-1.5 py-0.5 text-[0.9375rem] leading-relaxed text-ink">
                <MarkdownLite text={entry.content} />
              </div>
            )}
            {entry.sources && entry.sources.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-2">
                {entry.sources.map((source) => (
                  <Link
                    key={`${source.type}-${source.id}`}
                    to={SOURCE_HREF[source.type](source.id)}
                    className="text-xs font-medium text-brand hover:text-brand-strong hover:underline"
                  >
                    {source.label}
                  </Link>
                ))}
              </div>
            )}
            {entry.pendingAction ? (
              <PendingActionCard
                pendingAction={entry.pendingAction}
                onResolved={() => onResolvePending(entry.id)}
              />
            ) : (
              entry.pendingComment && (
                <PendingCommentCard
                  pendingComment={entry.pendingComment}
                  queryText={entries[index - 1]?.content ?? ''}
                  onResolved={() => onResolvePending(entry.id)}
                />
              )
            )}
          </div>
        </div>
      ))}
      {loading && (
        <div className="animate-message-in flex items-center gap-3">
          <AssistantAvatar thinking />
          <span className="text-sm text-ink-muted">Thinking…</span>
        </div>
      )}
    </div>
  )
}
