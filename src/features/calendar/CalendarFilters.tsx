import { AlarmClock, Gavel, IndianRupee, Landmark, ListTodo } from 'lucide-react'
import { cn } from '@/lib/cn'

export type CalendarCategory = 'hearing' | 'deadlines' | 'payments' | 'holidays'

const CATEGORIES: { value: CalendarCategory; label: string; icon: typeof Gavel }[] = [
  { value: 'hearing', label: 'Hearings', icon: Gavel },
  { value: 'deadlines', label: 'Deadlines', icon: AlarmClock },
  { value: 'payments', label: 'Payments', icon: IndianRupee },
  { value: 'holidays', label: 'Holidays', icon: Landmark },
]

/** Multi-select category chips - each toggles independently ("hide/show
 * categories"), "All" is just a shortcut back to every category on rather than a
 * distinct filter state. A "Tasks" chip is shown but permanently disabled - there's
 * no Task/Meeting entity in the backend yet, so a working filter for it would just
 * be decoration over nothing; this is honest about that instead of pretending. */
export function CalendarFilters({
  active,
  onToggle,
  onReset,
}: {
  active: Set<CalendarCategory>
  onToggle: (category: CalendarCategory) => void
  onReset: () => void
}) {
  const allActive = active.size === CATEGORIES.length

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        onClick={onReset}
        className={cn(
          'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
          allActive ? 'bg-brand text-white' : 'bg-surface-muted text-ink-muted hover:bg-surface-hover',
        )}
      >
        All
      </button>
      {CATEGORIES.map(({ value, label, icon: Icon }) => {
        const isActive = active.has(value)
        return (
          <button
            key={value}
            onClick={() => onToggle(value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              isActive
                ? 'bg-brand-soft text-brand-strong'
                : 'bg-surface-muted text-ink-faint hover:bg-surface-hover',
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {label}
          </button>
        )
      })}
      <span
        title="Task tracking isn't built yet - this chip is a placeholder for it."
        className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1.5 text-xs font-medium text-ink-disabled"
      >
        <ListTodo className="size-3.5" aria-hidden />
        Tasks
      </span>
    </div>
  )
}
