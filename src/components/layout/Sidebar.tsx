import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { useAuth } from '@/auth/AuthContext'
import { usePermissions } from '@/lib/usePermissions'
import { NAV_GROUPS } from './nav'
import { Wordmark } from './Wordmark'

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { isManagingDirector, isBranchAdmin } = useAuth()
  const { hasPermission } = usePermissions()
  const isAdmin = isManagingDirector || isBranchAdmin

  return (
    <div className="flex h-full flex-col bg-shell text-ink-muted">
      <div className="px-5 py-5">
        <Wordmark />
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2 scrollbar-thin">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((item) => {
            if (item.mdOnly) return isManagingDirector
            if (item.adminOnly) return isAdmin
            if (item.permission) return hasPermission(item.permission.resource, item.permission.action)
            return true
          })
          if (items.length === 0) return null
          return (
            <div key={group.label}>
              <p className="type-label px-3 pb-1.5 text-ink-faint">{group.label}</p>
              <ul className="space-y-0.5">
                {items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 rounded-control px-3 py-2 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-brand-soft text-brand-strong'
                            : 'text-ink-muted hover:bg-shell-soft hover:text-ink',
                        )
                      }
                    >
                      <item.icon className="size-[1.125rem] shrink-0" />
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </nav>
      <div className="border-t border-border px-5 py-3 text-xs text-ink-faint">
        NyayOps · Legal Operations
      </div>
    </div>
  )
}

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 lg:block">
      <div className="fixed inset-y-0 left-0 w-64">
        <SidebarContent />
      </div>
    </aside>
  )
}
