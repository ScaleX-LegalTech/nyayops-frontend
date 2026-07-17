import { useEffect, useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Menu, ShieldAlert, X } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { enablePushNotifications, ensureFreshPushSubscription, isPushSupported } from '@/lib/push'
import { playNotificationSound } from '@/lib/notificationSound'
import { getOrganizationName } from '@/lib/api/organization'
import { qk } from '@/lib/queryKeys'
import { useToast } from '@/components/ui/Toast'
import { Sidebar, SidebarContent } from './Sidebar'
import { NotificationsBell } from './NotificationsBell'
import { UserMenu } from './UserMenu'

// How long to let the shell render before asking - a permission prompt on a blank
// screen reads as spam.
const PUSH_PROMPT_DELAY_MS = 2000

export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { isManagingDirector } = useAuth()
  // Same queryKey as Sidebar's own getOrganizationName call, so this shares that
  // cache entry instead of firing a second request - is_frozen/frozen_by ride along.
  const { data: org } = useQuery({
    queryKey: qk.organizationName,
    queryFn: getOrganizationName,
    refetchInterval: 60_000,
  })

  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [drawerOpen])

  useEffect(() => {
    if (!isPushSupported()) return
    if (Notification.permission === 'default') {
      // Only ask if the browser has never been asked before - 'granted'/'denied' are
      // permanent per-origin decisions the browser already remembers, and
      // re-prompting a user who denied it once is exactly the annoyance we're
      // avoiding.
      const timer = setTimeout(() => {
        enablePushNotifications().catch(() => {})
      }, PUSH_PROMPT_DELAY_MS)
      return () => clearTimeout(timer)
    }
    if (Notification.permission === 'granted') {
      // Silently repairs a subscription left pointing at a rotated/old VAPID key -
      // otherwise push just stops arriving with no visible error anywhere.
      ensureFreshPushSubscription().catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    function onMessage(event: MessageEvent) {
      if (event.data?.type !== 'push-notification') return
      queryClient.invalidateQueries({ queryKey: qk.notifications })
      playNotificationSound()
      toast(event.data.title || 'New notification', 'info')
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [queryClient, toast])

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />

      {drawerOpen &&
        createPortal(
          <div className="lg:hidden" style={{ zIndex: 'var(--z-drawer)', position: 'fixed', inset: 0 }}>
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setDrawerOpen(false)}
              aria-hidden
            />
            <div className="absolute inset-y-0 left-0 w-64 animate-rise">
              <SidebarContent onNavigate={() => setDrawerOpen(false)} />
              <button
                onClick={() => setDrawerOpen(false)}
                className="absolute right-1 top-1 grid size-11 place-items-center text-ink-muted hover:text-ink"
                aria-label="Close menu"
              >
                <X className="size-5" />
              </button>
            </div>
          </div>,
          document.body,
        )}

      <div className="flex min-w-0 flex-1 flex-col">
        {org?.is_frozen && (
          <div
            className="flex items-center justify-center gap-2 bg-danger px-4 py-2 text-center text-sm font-medium text-white"
            role="alert"
          >
            <ShieldAlert className="size-4 shrink-0" />
            {isManagingDirector && org.frozen_by === 'platform_admin' && (
              <>
                Your organization has been paused by NyayOps staff — everyone is
                read-only. Resolve the issue that caused this (e.g. an outstanding
                payment) and contact support to have it lifted.
              </>
            )}
            {isManagingDirector && org.frozen_by !== 'platform_admin' && (
              <>
                Your organization is paused — everyone is read-only until you unfreeze
                it.{' '}
                <Link to="/settings" className="underline underline-offset-2 hover:no-underline">
                  Unfreeze in Settings
                </Link>
                .
              </>
            )}
            {!isManagingDirector &&
              'This organization has been paused. Please contact your administrator.'}
          </div>
        )}

        <header
          className="sticky top-0 flex h-16 items-center gap-3 border-b border-border bg-bg/90 px-4 backdrop-blur sm:px-6"
          style={{ zIndex: 'var(--z-sticky)' }}
        >
          <button
            onClick={() => setDrawerOpen(true)}
            className="grid size-11 place-items-center rounded-control text-ink-muted hover:bg-surface-muted lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>
          <div className="flex-1" />
          <NotificationsBell />
          <UserMenu />
        </header>

        <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-6 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
