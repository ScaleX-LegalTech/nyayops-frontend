import {
  Briefcase,
  CalendarDays,
  ClipboardCheck,
  FileText,
  Gavel,
  IndianRupee,
  LayoutDashboard,
  MessageSquare,
  ScrollText,
  Sparkles,
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
      { to: '/calendar', label: 'Calendar', icon: CalendarDays },
      {
        to: '/cases',
        label: 'Cases',
        icon: Briefcase,
        permission: { resource: 'cases', action: 'read' },
      },
      // Public court data, not case-scoped - no permission gate, everyone in the
      // tenant sees the same thing.
      { to: '/cause-list', label: 'Cause List', icon: Gavel },
      {
        to: '/documents',
        label: 'Documents',
        icon: FileText,
        permission: { resource: 'documents', action: 'read' },
      },
      {
        to: '/bills',
        label: 'Bills & Payments',
        icon: IndianRupee,
        permission: { resource: 'bills', action: 'read' },
      },
      {
        to: '/review',
        label: 'Review Queue',
        icon: ClipboardCheck,
        permission: { resource: 'cases', action: 'review' },
      },
      {
        to: '/ask-nyayops',
        label: 'Ask NyayOps',
        icon: Sparkles,
        permission: { resource: 'assistant', action: 'use' },
      },
      { to: '/chats', label: 'Chats', icon: MessageSquare },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/admin/users', label: 'Users', icon: Users, adminOnly: true },
      { to: '/audit', label: 'Audit Log', icon: ScrollText, adminOnly: true },
    ],
  },
]
