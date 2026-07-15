import { cn } from '@/lib/cn'
import { initials } from '@/lib/format'

interface AvatarProps {
  label: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZES = {
  sm: 'size-7 text-xs',
  md: 'size-8 text-sm',
  lg: 'size-10 text-base',
}

/** Circle avatar — people only (profile icon, chat sender, assignee). Keeps the
 * human/system distinction visible without a label. */
export function PersonAvatar({ label, size = 'md', className }: AvatarProps) {
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-full bg-brand font-semibold text-white',
        SIZES[size],
        className,
      )}
    >
      {initials(label)}
    </span>
  )
}

/** Square avatar (2px radius) — anything representing a case, file, or entity.
 * Reinforces "this is a record," matching the flat/institutional visual language. */
export function EntityAvatar({ label, size = 'md', className }: AvatarProps) {
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-control border border-border bg-surface-muted font-semibold text-ink',
        SIZES[size],
        className,
      )}
    >
      {initials(label)}
    </span>
  )
}
