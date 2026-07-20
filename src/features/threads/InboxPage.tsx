import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { IndianRupee, Lock, MessageSquare } from 'lucide-react'
import { listThreadInbox, markThreadRead } from '@/lib/api/threads'
import { qk } from '@/lib/queryKeys'
import { formatRelative } from '@/lib/format'
import { useUsers } from '@/lib/useUsers'
import { cn } from '@/lib/cn'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/Feedback'
import type { ThreadInboxItem } from '@/types/threads'

/** Unified chat inbox - every case/bill thread the caller is part of, newest
 * activity first. Case/bill threads themselves already know how to go
 * read-only when their parent resource closes (ThreadPanel's lockedMessage);
 * this page just surfaces that as a lock icon so a dead thread doesn't look
 * actionable in the list. */
export default function InboxPage() {
  const navigate = useNavigate()
  const { nameOf } = useUsers()

  const { data: items = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: qk.threadInbox,
    queryFn: listThreadInbox,
    refetchInterval: 2 * 60_000,
    refetchOnWindowFocus: true,
  })

  function openThread(item: ThreadInboxItem) {
    markThreadRead(item.resource_type, item.resource_id).catch(() => {})
    navigate(
      item.resource_type === 'case'
        ? `/chats/cases/${item.resource_id}/thread`
        : `/chats/bills/${item.resource_id}/thread`,
    )
  }

  return (
    <div className="animate-rise">
      <PageHeader title="Chats" description="Every case and bill thread you're part of, newest first." />

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState icon={MessageSquare} title="No chats yet" description="Case and bill threads you're part of will show up here." />
        </Card>
      ) : (
        <Card>
          <div className="divide-y divide-border">
            {items.map((item) => (
              <button
                key={`${item.resource_type}:${item.resource_id}`}
                onClick={() => openThread(item)}
                className={cn(
                  'flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-surface-muted',
                  item.unread && 'bg-brand-soft/40',
                )}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-control bg-info-soft text-info-strong">
                  {item.resource_type === 'bill' ? (
                    <IndianRupee className="size-4" />
                  ) : (
                    <MessageSquare className="size-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className={cn('truncate text-sm text-ink', item.unread && 'font-semibold')}>
                      {item.title}
                    </p>
                    {item.locked && <Lock className="size-3 shrink-0 text-ink-faint" />}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-ink-muted">
                    <span className="font-medium text-ink-muted">{nameOf(item.last_author_id)}:</span>{' '}
                    {item.last_message_preview || '[deleted message]'}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-ink-faint">
                  {formatRelative(item.last_message_at)}
                </span>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
