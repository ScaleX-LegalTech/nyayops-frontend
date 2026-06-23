import {
  Briefcase,
  Building2,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  ScrollText,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Restrict to Managing Directors or Branch Admins (server still enforces RBAC). */
  adminOnly?: boolean
  /** Restrict to Managing Directors only - branch management is org-wide. */
  mdOnly?: boolean
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Workspace',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/cases', label: 'Cases', icon: Briefcase },
      { to: '/review', label: 'Review queue', icon: ClipboardCheck },
      { to: '/documents', label: 'Documents', icon: FileText },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/admin/branches', label: 'Branches', icon: Building2, mdOnly: true },
      { to: '/admin/users', label: 'Users', icon: Users, adminOnly: true },
      { to: '/admin/roles', label: 'Roles', icon: ShieldCheck, adminOnly: true },
      { to: '/audit', label: 'Audit log', icon: ScrollText, adminOnly: true },
    ],
  },
]
