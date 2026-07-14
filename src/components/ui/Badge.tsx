import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import type { CaseStatus } from '@/types'
import { humanize } from '@/lib/format'

export type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'accent'

/** Text/dot color per tone — used by StatusBadge/PriorityBadge's dot+label pattern. */
export const DOT_TONE: Record<Tone, string> = {
  neutral: 'bg-ink-faint',
  brand: 'bg-brand',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  accent: 'bg-accent',
}

/** Semi-filled tone classes for interactive controls (e.g. transition picker buttons)
 * where a passive dot+label doesn't apply — this system's badges never use fill, but
 * a clickable choice pill is a control, not a status label. */
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
 * instead — this system's one status pattern is a dot + label, never a filled pill. */
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

/** Status — dot + lowercase label, never a filled badge. The single most load-bearing
 * restraint in this system: with urgency/payment/role/source status all potentially
 * live on one screen, colored pill badges compound into visual noise fast. */
export function StatusBadge({ status }: { status: CaseStatus }) {
  const tone = STATUS_TONE[status]
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted whitespace-nowrap">
      <span className={cn('dot', DOT_TONE[tone])} aria-hidden />
      {humanize(status)}
    </span>
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
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted whitespace-nowrap">
      <span className={cn('dot', DOT_TONE[tone])} aria-hidden />
      {humanize(priority)}
    </span>
  )
}
