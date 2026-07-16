import type { ReactNode } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  RotateCcw,
  Send,
  UserCheck,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import type { CaseStatus } from '@/types'
import { humanize } from '@/lib/format'

export type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'accent'

/** Capsule fill/text per tone — every status and priority renders as one of these,
 * never a plain gray chip. Icon carries meaning too, so color is never the only signal. */
const TONE_CAPSULE: Record<Tone, string> = {
  neutral: 'bg-surface-muted text-ink-muted',
  brand: 'bg-brand-soft text-brand-strong',
  success: 'bg-success-soft text-success-strong',
  warning: 'bg-warning-soft text-warning-strong',
  danger: 'bg-danger-soft text-danger-strong',
  info: 'bg-info-soft text-info-strong',
  accent: 'bg-brand-soft text-brand-strong',
}

const TONE_ICON: Record<Tone, typeof AlertTriangle> = {
  neutral: Circle,
  brand: Circle,
  success: CheckCircle2,
  warning: Clock,
  danger: AlertTriangle,
  info: UserCheck,
  accent: Send,
}

/** Text/dot color per tone — still used by the transition-picker choice pills in
 * CaseDetailPage, which render their own control instead of this capsule. */
export const DOT_TONE: Record<Tone, string> = {
  neutral: 'bg-ink-faint',
  brand: 'bg-brand',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  accent: 'bg-accent',
}

export const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-muted text-ink-muted border-border',
  brand: 'bg-brand-soft text-brand-strong border-brand/30',
  success: 'bg-success-soft text-success border-success/30',
  warning: 'bg-warning-soft text-warning-strong border-warning/40',
  danger: 'bg-danger-soft text-danger border-danger/30',
  info: 'bg-info-soft text-info border-info/30',
  accent: 'bg-brand-soft text-brand-strong border-brand/30',
}

interface BadgeProps {
  tone?: Tone
  children: ReactNode
  className?: string
  dot?: boolean
}

/** Generic metadata tag (chip): bordered box, no color fill — for role names, counts,
 * scan status, version numbers. For a case/review STATUS use StatusBadge/PriorityBadge
 * instead — those render as colored capsules, this stays neutral. */
export function Badge({ tone = 'neutral', children, className, dot }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-control border border-border bg-surface-muted px-2.5 py-0.5 text-xs whitespace-nowrap',
        className,
      )}
    >
      {dot && <span className={cn('dot', DOT_TONE[tone])} aria-hidden />}
      {children}
    </span>
  )
}

/** Icon-anchored colored capsule — the one status pattern in this system. Every tone
 * gets a fill + icon so status/priority reads at a glance in a dense list, not just
 * the critical ones. Exported for one-off status-like indicators (e.g. an "Action
 * required" flag) that don't warrant their own Status/PriorityBadge-style wrapper. */
export function Capsule({ tone, icon: Icon, children }: { tone: Tone; icon: typeof AlertTriangle; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap',
        TONE_CAPSULE[tone],
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {children}
    </span>
  )
}

export const STATUS_TONE: Record<CaseStatus, Tone> = {
  draft: 'neutral',
  new: 'neutral',
  assigned: 'info',
  in_progress: 'brand',
  ready_for_review: 'accent',
  under_review: 'warning',
  approved: 'success',
  rejected: 'danger',
  reassigned: 'info',
  closed: 'neutral',
}

const STATUS_ICON: Partial<Record<CaseStatus, typeof AlertTriangle>> = {
  reassigned: RotateCcw,
}

export function StatusBadge({ status }: { status: CaseStatus }) {
  const tone = STATUS_TONE[status]
  const Icon = STATUS_ICON[status] ?? TONE_ICON[tone]
  return (
    <Capsule tone={tone} icon={Icon}>
      {humanize(status)}
    </Capsule>
  )
}

const PRIORITY_TONE: Record<string, Tone> = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  urgent: 'danger',
}

export function PriorityBadge({ priority }: { priority: string }) {
  const tone = PRIORITY_TONE[priority] ?? 'neutral'
  return (
    <Capsule tone={tone} icon={TONE_ICON[tone]}>
      {humanize(priority)}
    </Capsule>
  )
}
