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
    <div className="flex h-full flex-col bg-shell text-white/70">
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
              <p className="px-3 pb-1.5 text-[0.68rem] font-semibold uppercase tracking-wider text-white/50">
                {group.label}
              </p>
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
                            ? 'bg-white/10 text-white'
                            : 'text-white/65 hover:bg-white/5 hover:text-white',
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
      <div className="border-t border-white/10 px-5 py-3 text-xs text-white/55">
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
