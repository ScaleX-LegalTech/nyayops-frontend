import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { Menu, X } from 'lucide-react'
import { Sidebar, SidebarContent } from './Sidebar'
import { NotificationsBell } from './NotificationsBell'
import { UserMenu } from './UserMenu'

export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />

      {drawerOpen &&
        createPortal(
          <div className="lg:hidden" style={{ zIndex: 'var(--z-drawer)', position: 'fixed', inset: 0 }}>
            <div
              className="absolute inset-0 bg-shell/50"
              onClick={() => setDrawerOpen(false)}
              aria-hidden
            />
            <div className="absolute inset-y-0 left-0 w-64 animate-rise">
              <SidebarContent onNavigate={() => setDrawerOpen(false)} />
              <button
                onClick={() => setDrawerOpen(false)}
                className="absolute right-3 top-4 text-white/60 hover:text-white"
                aria-label="Close menu"
              >
                <X className="size-5" />
              </button>
            </div>
          </div>,
          document.body,
        )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="sticky top-0 flex h-16 items-center gap-3 border-b border-border bg-bg/90 px-4 backdrop-blur sm:px-6"
          style={{ zIndex: 'var(--z-sticky)' }}
        >
          <button
            onClick={() => setDrawerOpen(true)}
            className="grid size-9 place-items-center rounded-control text-ink-muted hover:bg-surface-muted lg:hidden"
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
