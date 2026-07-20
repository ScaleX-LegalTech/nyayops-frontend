import {
  Bot,
  Briefcase,
  ClipboardCheck,
  FileText,
  IndianRupee,
  LayoutDashboard,
  ScrollText,
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
  /** Hide unless the user holds this permission grant. */
  permission?: { resource: string; action: string }
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
      {
        to: '/cases',
        label: 'Cases',
        icon: Briefcase,
        permission: { resource: 'cases', action: 'read' },
      },
      {
        to: '/review',
        label: 'Review queue',
        icon: ClipboardCheck,
        permission: { resource: 'cases', action: 'review' },
      },
      {
        to: '/documents',
        label: 'Documents',
        icon: FileText,
        permission: { resource: 'documents', action: 'read' },
      },
      {
        to: '/bills',
        label: 'Bills',
        icon: IndianRupee,
        permission: { resource: 'bills', action: 'read' },
      },
      {
        to: '/ask-nyayops',
        label: 'Ask NyayOps',
        icon: Bot,
        permission: { resource: 'assistant', action: 'use' },
      },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/admin/users', label: 'Users', icon: Users, adminOnly: true },
      { to: '/audit', label: 'Audit log', icon: ScrollText, adminOnly: true },
    ],
  },
]
