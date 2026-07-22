import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Bell, Check, Trash2 } from 'lucide-react'
import {
  clearAllNotifications,
  deleteNotification,
  listNotifications,
  markNotificationRead,
} from '@/lib/api/notifications'
import { notificationLink } from '@/lib/notificationLink'
import { qk } from '@/lib/queryKeys'
import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/cn'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/Feedback'
import type { Notification } from '@/types'

export default function NotificationsPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const { data: notifications = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: qk.notifications,
    queryFn: listNotifications,
    // AppShell's SSE connection (see its useEffect) is the primary low-latency
    // channel - this interval is just a correctness backstop for whatever the
    // stream might miss, matching NotificationsBell rather than this page's old
    // dedicated 15s poll.
    refetchInterval: 2 * 60_000,
    refetchOnWindowFocus: true,
  })

  const markRead = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.notifications }),
  })

  const remove = useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.notifications }),
  })

  const clearAll = useMutation({
    mutationFn: clearAllNotifications,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.notifications }),
  })

  function openNotification(n: Notification) {
    if (!n.read_at) markRead.mutate(n.id)
    const link = notificationLink(n)
    if (link) navigate(link)
  }

  return (
    <div className="animate-rise">
      <PageHeader
        title="Notifications"
        description="Everything routed to you, newest first."
        actions={
          notifications.length > 0 ? (
            <Button variant="secondary" loading={clearAll.isPending} onClick={() => clearAll.mutate()}>
              Clear all
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : notifications.length === 0 ? (
        <Card>
          <EmptyState icon={Bell} title="You're all caught up" description="No notifications yet." />
        </Card>
      ) : (
        <Card>
          <div className="divide-y divide-border">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={cn('group flex items-start gap-3 px-4 py-3.5', !n.read_at && 'bg-brand-soft/40')}
              >
                <button onClick={() => openNotification(n)} className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-medium text-ink">{n.subject}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">{formatRelative(n.created_at)}</p>
                </button>
                <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100">
                  {!n.read_at && (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Mark as read"
                      onClick={() => markRead.mutate(n.id)}
                    >
                      <Check className="size-4" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Delete notification"
                    onClick={() => remove.mutate(n.id)}
                  >
                    <Trash2 className="size-4 text-danger" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
