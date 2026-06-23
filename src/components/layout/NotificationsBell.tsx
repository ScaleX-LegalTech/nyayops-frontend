import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, Check } from 'lucide-react'
import { listNotifications, markNotificationRead } from '@/lib/api/notifications'
import { qk } from '@/lib/queryKeys'
import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/cn'

export function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  const { data: notifications = [] } = useQuery({
    queryKey: qk.notifications,
    queryFn: listNotifications,
    refetchInterval: 60_000,
  })

  const markRead = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.notifications }),
  })

  const unread = notifications.filter((n) => !n.read_at)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative grid size-9 place-items-center rounded-control text-ink-muted hover:bg-surface-muted hover:text-ink"
        aria-label="Notifications"
      >
        <Bell className="size-5" />
        {unread.length > 0 && (
          <span className="absolute right-1.5 top-1.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[0.6rem] font-semibold text-white tabular">
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-[min(90vw,22rem)] overflow-hidden rounded-card border border-border bg-surface shadow-pop animate-rise"
          style={{ zIndex: 'var(--z-dropdown)' }}
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-ink">Notifications</p>
            <span className="text-xs text-ink-muted">{unread.length} unread</span>
          </div>
          <div className="max-h-96 overflow-y-auto scrollbar-thin">
            {notifications.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-ink-muted">You're all caught up.</p>
            ) : (
              notifications.slice(0, 20).map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    'flex items-start gap-3 border-b border-border px-4 py-3 last:border-0',
                    !n.read_at && 'bg-brand-soft/40',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{n.subject}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">{formatRelative(n.created_at)}</p>
                  </div>
                  {!n.read_at && (
                    <button
                      onClick={() => markRead.mutate(n.id)}
                      className="rounded-control p-1 text-ink-faint hover:bg-surface-muted hover:text-brand"
                      aria-label="Mark as read"
                    >
                      <Check className="size-4" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
