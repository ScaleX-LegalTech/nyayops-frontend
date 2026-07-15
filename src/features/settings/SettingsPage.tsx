import { NavLink, Outlet } from 'react-router-dom'
import { PageHeader } from '@/components/ui/PageHeader'
import { cn } from '@/lib/cn'
import { useAuth } from '@/auth/AuthContext'

interface SettingsTab {
  to: string
  label: string
  end?: boolean
  show: (auth: { isManagingDirector: boolean; isBranchAdmin: boolean }) => boolean
}

const TABS: SettingsTab[] = [
  { to: '/settings', label: 'Profile & Security', end: true, show: () => true },
  {
    to: '/settings/roles',
    label: 'Roles & Permissions',
    show: (auth) => auth.isManagingDirector || auth.isBranchAdmin,
  },
  { to: '/settings/branches', label: 'Branches', show: (auth) => auth.isManagingDirector },
  {
    to: '/settings/branch-admins',
    label: 'Branch Admins',
    show: (auth) => auth.isManagingDirector,
  },
]

export default function SettingsPage() {
  const { isManagingDirector, isBranchAdmin } = useAuth()
  const tabs = TABS.filter((tab) => tab.show({ isManagingDirector, isBranchAdmin }))

  return (
    <div className="animate-rise">
      <PageHeader
        title="Settings"
        description="Manage your profile, security, and organization configuration."
      />

      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              cn(
                '-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'border-brand text-brand-strong'
                  : 'border-transparent text-ink-muted hover:text-ink',
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </div>
  )
}
