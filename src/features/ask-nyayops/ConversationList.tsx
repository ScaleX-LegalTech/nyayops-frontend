import type { MouseEvent as ReactMouseEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageSquarePlus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Feedback'
import { cn } from '@/lib/cn'
import { formatRelative } from '@/lib/format'
import { qk } from '@/lib/queryKeys'
import { deleteAskNyayOpsConversation, listAskNyayOpsConversations } from '@/lib/api/askNyayOps'
import type { AskNyayOpsAgent } from '@/types'

interface ConversationListProps {
  agent: AskNyayOpsAgent
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  /** 'sidebar' (default): fixed-width, right-bordered, for sitting next to
   * the chat panel (AskNyayOpsPage). 'panel': fills its container - the
   * compact launcher swaps its whole body for this view instead of running
   * it side-by-side, there's no room for a fixed 16rem column in a 24rem
   * popover. */
  variant?: 'sidebar' | 'panel'
}

/** Strictly own-scope by design - the backend never returns anyone else's
 * conversations, so there's no per-user filtering to do here. Filtered to the
 * current agent client-side - a conversation belongs to exactly one agent
 * (backend-enforced), so mixing both into one list would let you click into
 * one you can't actually continue in this mode. */
export function ConversationList({
  agent,
  activeId,
  onSelect,
  onNew,
  variant = 'sidebar',
}: ConversationListProps) {
  const queryClient = useQueryClient()
  const { data: allConversations, isLoading } = useQuery({
    queryKey: qk.askNyayOpsConversations,
    queryFn: listAskNyayOpsConversations,
  })
  const conversations = allConversations?.filter((c) => c.agent === agent)

  async function handleDelete(e: ReactMouseEvent, id: string) {
    e.stopPropagation()
    await deleteAskNyayOpsConversation(id)
    await queryClient.invalidateQueries({ queryKey: qk.askNyayOpsConversations })
    if (id === activeId) onNew()
  }

  return (
    <div
      className={cn(
        'flex h-full flex-col',
        variant === 'sidebar' ? 'w-64 shrink-0 border-r border-border' : 'w-full',
      )}
    >
      <div className="p-3">
        <Button variant="secondary" size="sm" className="w-full" onClick={onNew}>
          <MessageSquarePlus className="size-4" /> New conversation
        </Button>
      </div>
      <div className="scrollbar-thin flex-1 overflow-y-auto px-2 pb-3">
        {isLoading ? (
          <div className="py-8">
            <Spinner />
          </div>
        ) : conversations && conversations.length > 0 ? (
          <div className="flex flex-col gap-0.5">
            {conversations.map((c) => (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(c.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelect(c.id)
                  }
                }}
                className={cn(
                  'group flex cursor-pointer items-center gap-2 rounded-control px-3 py-2 text-left text-sm',
                  c.id === activeId
                    ? 'bg-brand-soft text-brand-strong'
                    : 'text-ink hover:bg-surface-muted',
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.title ?? 'New conversation'}</p>
                  <p className="text-xs text-ink-muted">{formatRelative(c.updated_at)}</p>
                </div>
                <button
                  type="button"
                  aria-label="Delete conversation"
                  onClick={(e) => handleDelete(e, c.id)}
                  className="shrink-0 rounded-control p-1 text-ink-faint opacity-0 hover:bg-surface hover:text-danger group-hover:opacity-100"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-3 py-8 text-center text-xs text-ink-muted">No conversations yet.</p>
        )}
      </div>
    </div>
  )
}
