import { cn } from '@/lib/cn'
import { useUsers } from '@/lib/useUsers'
import { PersonAvatar } from '@/components/ui/Avatar'

interface UserMultiSelectProps {
  selected: string[]
  onChange: (ids: string[]) => void
  emptyHint?: string
}

/** Checkbox list of tenant users for assignment. Degrades when not permitted. */
export function UserMultiSelect({ selected, onChange, emptyHint }: UserMultiSelectProps) {
  const { users, canList } = useUsers()

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  }

  if (!canList || users.length === 0) {
    return (
      <p className="rounded-control border border-dashed border-border bg-surface-muted px-3 py-3 text-sm text-ink-muted">
        {emptyHint ?? 'No assignable users available.'}
      </p>
    )
  }

  return (
    <div className="max-h-52 space-y-1 overflow-y-auto rounded-control border border-border p-1.5 scrollbar-thin">
      {users.map((u) => {
        const checked = selected.includes(u.id)
        return (
          <button
            type="button"
            key={u.id}
            onClick={() => toggle(u.id)}
            className={cn(
              'flex w-full items-center gap-3 rounded-control px-2.5 py-2 text-left transition-colors',
              checked ? 'bg-brand-soft' : 'hover:bg-surface-muted',
            )}
          >
            <PersonAvatar label={u.full_name} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink">{u.full_name}</span>
              <span className="block truncate text-xs text-ink-muted">{u.email}</span>
            </span>
            <span
              className={cn(
                'grid size-[1.125rem] place-items-center rounded border text-xs',
                checked ? 'border-brand bg-brand text-white' : 'border-border-strong',
              )}
            >
              {checked && '✓'}
            </span>
          </button>
        )
      })}
    </div>
  )
}
