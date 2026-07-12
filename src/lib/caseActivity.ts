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
