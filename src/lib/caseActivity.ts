import {
  ArrowRight,
  FileEdit,
  FilePlus,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Trash2,
  UserPlus,
  type LucideIcon,
} from 'lucide-react'

export const ACTION_ICONS: Record<string, LucideIcon> = {
  CASE_CREATED: FilePlus,
  CASE_DETAILS_SET: FileEdit,
  CASE_CNR_REFRESHED: RefreshCw,
  CASE_ASSIGNED: UserPlus,
  CASE_BULK_ASSIGNED: UserPlus,
  CASE_REASSIGNED: UserPlus,
  CASE_STATUS_UPDATED: ArrowRight,
  CASE_UPDATED: FileEdit,
  CASE_DELETED: Trash2,
  CASE_RESTORED: RotateCcw,
  CASE_COMMENT_ADDED: MessageSquare,
}

export const ACTION_LABELS: Record<string, string> = {
  CASE_CREATED: 'Case created',
  CASE_DETAILS_SET: 'Case details set',
  CASE_CNR_REFRESHED: 'Refreshed from CNR',
  CASE_ASSIGNED: 'Assigned',
  CASE_BULK_ASSIGNED: 'Assigned',
  CASE_REASSIGNED: 'Reassigned',
  CASE_STATUS_UPDATED: 'Status updated',
  CASE_UPDATED: 'Case updated',
  CASE_DELETED: 'Case deleted',
  CASE_RESTORED: 'Case restored',
  CASE_COMMENT_ADDED: 'Comment added',
}

interface ActivityLike {
  action_type: string
  previous_state: Record<string, unknown> | null
  new_state: Record<string, unknown> | null
}

function idList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

function namesOf(ids: string[], nameOf: (id: string) => string): string {
  return ids.map(nameOf).join(', ')
}

/** Turns an activity log's before/after state into a human sentence fragment,
 * e.g. "assigned Ajay Verma, Priya Sharma" or "changed status from New to
 * Assigned" - falls back to the generic ACTION_LABELS entry when a type has
 * no fields worth diffing. */
export function describeActivity(log: ActivityLike, nameOf: (id: string) => string): string {
  const prev = log.previous_state ?? {}
  const next = log.new_state ?? {}
  switch (log.action_type) {
    case 'CASE_ASSIGNED':
    case 'CASE_BULK_ASSIGNED': {
      const before = new Set(idList(prev.assigned_user_ids))
      const after = idList(next.assigned_user_ids)
      const added = after.filter((id) => !before.has(id))
      return added.length > 0
        ? `assigned ${namesOf(added, nameOf)}`
        : (ACTION_LABELS.CASE_ASSIGNED ?? '').toLowerCase()
    }
    case 'CASE_REASSIGNED': {
      const before = idList(prev.assigned_user_ids)
      const after = idList(next.assigned_user_ids)
      if (before.length === 0 && after.length > 0) return `reassigned to ${namesOf(after, nameOf)}`
      if (after.length === 0) return 'reassigned'
      return `reassigned from ${namesOf(before, nameOf)} to ${namesOf(after, nameOf)}`
    }
    case 'CASE_STATUS_UPDATED': {
      const from = typeof prev.status === 'string' ? prev.status : null
      const to = typeof next.status === 'string' ? next.status : null
      if (from && to) return `changed status from ${humanizeStatus(from)} to ${humanizeStatus(to)}`
      return (ACTION_LABELS.CASE_STATUS_UPDATED ?? '').toLowerCase()
    }
    default:
      return (ACTION_LABELS[log.action_type] ?? log.action_type).toLowerCase()
  }
}

function humanizeStatus(value: string): string {
  return value
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}
