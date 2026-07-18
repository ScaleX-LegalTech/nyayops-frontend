import type { CSSProperties, ReactNode } from 'react'
import { Loader2, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { ApiError } from '@/lib/api/client'

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-5 animate-spin text-ink-muted', className)} aria-hidden />
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-ink-muted">
      <Spinner />
      <span className="text-sm">{label}</span>
    </div>
  )
}

export function Skeleton({
  className,
  style,
}: {
  className?: string
  style?: CSSProperties
}) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-surface-muted', className)}
      style={style}
      aria-hidden
    />
  )
}

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: ReactNode
  action?: ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      {Icon && (
        <div className="grid size-12 place-items-center rounded-full bg-surface-muted text-ink-muted">
          <Icon className="size-6" />
        </div>
      )}
      <div>
        <p className="text-base font-semibold text-ink">{title}</p>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}

/** Friendly error block. 403s get a tailored access message. */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const is403 = error instanceof ApiError && error.status === 403
  // A 404 is as pointless to retry as a 403 - the resource doesn't exist (deleted,
  // wrong id, never did), not a transient failure - "Try again" would just 404 again.
  const is404 = error instanceof ApiError && error.status === 404
  const message = is403
    ? "You don't have permission to view this. Ask an org admin to grant access."
    : error instanceof Error
      ? error.message
      : 'Something went wrong.'
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <p className="text-base font-semibold text-ink">
        {is403 ? 'Access restricted' : is404 ? 'Not found' : 'Unable to load'}
      </p>
      <p className="max-w-sm text-sm text-ink-muted">{message}</p>
      {is404 ? (
        <button
          onClick={() => window.history.back()}
          className="text-sm font-medium text-brand hover:text-brand-strong"
        >
          Go back
        </button>
      ) : (
        onRetry &&
        !is403 && (
          <button
            onClick={onRetry}
            className="text-sm font-medium text-brand hover:text-brand-strong"
          >
            Try again
          </button>
        )
      )}
    </div>
  )
}
