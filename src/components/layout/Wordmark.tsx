import { cn } from '@/lib/cn'

interface WordmarkProps {
  className?: string
  /** Tenant/firm name, shown under the wordmark - Wordmark always sits on the navy
   * shell (Sidebar, AuthLayout), so callers don't need to worry about contrast. */
  subtitle?: string
}

export function Wordmark({ className, subtitle }: WordmarkProps) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <img src="/logo.png" alt="" className="size-16 shrink-0 object-contain" />
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
