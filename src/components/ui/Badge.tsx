import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import type { CaseStatus } from '@/types'
import { humanize } from '@/lib/format'

export type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'accent'

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-muted text-ink-muted border-border',
  brand: 'bg-brand-soft text-brand-strong border-brand/20',
  success: 'bg-success-soft text-success border-success/20',
  warning: 'bg-warning-soft text-warning-strong border-warning/30',
  danger: 'bg-danger-soft text-danger border-danger/20',
  info: 'bg-info-soft text-info border-info/20',
  accent: 'bg-accent/15 text-accent-strong border-accent/30',
}

interface BadgeProps {
  tone?: Tone
  children: ReactNode
  className?: string
  dot?: boolean
}

export function Badge({ tone = 'neutral', children, className, dot }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  )
}

const STATUS_TONE: Record<CaseStatus, Tone> = {
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

export function StatusBadge({ status }: { status: CaseStatus }) {
  return (
    <Badge tone={STATUS_TONE[status]} dot>
      {humanize(status)}
    </Badge>
  )
}

const PRIORITY_TONE: Record<string, Tone> = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  urgent: 'danger',
}

export function PriorityBadge({ priority }: { priority: string }) {
  return <Badge tone={PRIORITY_TONE[priority] ?? 'neutral'}>{humanize(priority)}</Badge>
}
