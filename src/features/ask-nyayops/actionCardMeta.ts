import {
  AlertOctagon,
  Building2,
  Check,
  CheckCircle2,
  Eye,
  Files,
  FilePlus,
  FileText,
  FileUp,
  FileX,
  Flag,
  GitBranch,
  History,
  IndianRupee,
  KeyRound,
  Link2,
  ListChecks,
  Lock,
  MessageSquare,
  PhoneCall,
  RefreshCcw,
  RotateCcw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Tag,
  Trash2,
  UserCog,
  UserPlus,
  Users,
  UserX,
  XCircle,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { Tone } from '@/components/ui/Badge'
import type { PendingAction } from '@/types'

/** Plain data shared by every action card - kept in its own non-component
 * module (not actionCardKit.tsx) so this file only ever exports constants,
 * matching the codebase's existing convention for icon/tone lookup tables
 * (see components/ui/Badge.tsx). */

export const TIER_TONE: Record<PendingAction['tier'], Tone> = { T1: 'info', T2: 'warning', T3: 'danger' }
export const TIER_LABEL: Record<PendingAction['tier'], string> = {
  T1: 'Quick action',
  T2: 'Review before confirming',
  T3: 'Irreversible or wide-reaching',
}
export const TIER_CAPSULE_ICON: Record<PendingAction['tier'], LucideIcon> = {
  T1: Zap,
  T2: Eye,
  T3: ShieldAlert,
}
export const TIER_ICON_WRAP: Record<PendingAction['tier'], string> = {
  T1: 'bg-info-soft text-info-strong',
  T2: 'bg-warning-soft text-warning-strong',
  T3: 'bg-danger-soft text-danger-strong',
}

/** action_type -> the icon shown in an action card header's leading circle.
 * Deliberately keyed by the exact action_type (not a shared default) so
 * every distinct kind of drafted change reads at a glance before the title
 * is even read. */
export const ACTION_ICON: Record<string, LucideIcon> = {
  'case.create': FilePlus,
  'case.assign': UserPlus,
  'case.reassign': Users,
  'case.status_update': RefreshCcw,
  'case.lifecycle_stage_update': GitBranch,
  'case.approve': CheckCircle2,
  'case.reject': XCircle,
  'case.link_cnr': Link2,
  'case.refresh_cnr': RotateCcw,
  'case.comment': MessageSquare,
  'case.bulk_comment': MessageSquare,
  'bill.raise': IndianRupee,
  'bill.mark_contacted': PhoneCall,
  'bill.upload_proof': FileUp,
  'bill.reject': FileX,
  'bill_type.create': Tag,
  'milestone.create': Flag,
  'document.create': FileText,
  'document.create_version': Files,
  'document.rollback_version': History,
  'document.permanently_delete': Trash2,
  'notification.mark_read': Check,
  'notification.clear_all': XCircle,
  'issue.raise': AlertOctagon,
  'issue.resolve': CheckCircle2,
  'branch.create': Building2,
  'branch.update': Building2,
  'branch.freeze': Lock,
  'branch.delete': Trash2,
  'role.create': Shield,
  'role.update': ShieldCheck,
  'role.delete': Trash2,
  'branch_admin.permissions_update': KeyRound,
  'user.invite': UserPlus,
  'user.deactivate': UserX,
  'user.role_change': UserCog,
  'organization.freeze': Lock,
  'org.register': Building2,
  'workflow.batch': ListChecks,
}

export const DEFAULT_ACTION_ICON: LucideIcon = FileText
