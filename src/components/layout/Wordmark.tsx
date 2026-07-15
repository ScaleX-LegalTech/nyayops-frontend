import { Scale } from 'lucide-react'
import { cn } from '@/lib/cn'

interface WordmarkProps {
  className?: string
  /** Tenant/firm name, shown under the wordmark - Wordmark always sits on the navy
   * shell (Sidebar, AuthLayout), so callers don't need to worry about contrast. */
  subtitle?: string
}

export function Wordmark({ className, subtitle }: WordmarkProps) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span className="grid size-9 shrink-0 place-items-center rounded-control bg-accent/15 text-accent">
        <Scale className="size-5" />
      </span>
      <div className="min-w-0">
        <span className="type-page-title text-xl text-shell-ink">
          Nyay<span className="text-accent">Ops</span>
        </span>
        {subtitle && (
          <p className="-mt-0.5 truncate text-xs text-shell-ink-muted">{subtitle}</p>
        )}
      </div>
    </div>
  )
}
