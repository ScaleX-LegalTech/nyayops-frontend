import { Scale } from 'lucide-react'
import { cn } from '@/lib/cn'

export function Wordmark({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span className="grid size-9 place-items-center rounded-control bg-accent/15 text-accent">
        <Scale className="size-5" />
      </span>
      <span className="font-display text-xl font-semibold tracking-tight text-white">
        Nyay<span className="text-accent">Ops</span>
      </span>
    </div>
  )
}
