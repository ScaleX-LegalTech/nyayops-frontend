import { NyayOpsMark } from '@/components/ui/NyayOpsMark'
import { timeOfDayGreeting } from './greeting'
import { QUICK_ACTIONS } from './suggestedPrompts'

interface AskNyayOpsEmptyStateProps {
  size: 'full' | 'compact'
  name?: string
  onPrompt: (prompt: string) => void
}

export function AskNyayOpsEmptyState({ size, name, onPrompt }: AskNyayOpsEmptyStateProps) {
  if (size === 'compact') {
    return (
      <div className="flex flex-col items-center gap-3 py-5 text-center">
        <div className="grid size-10 place-items-center rounded-full bg-brand-soft text-brand">
          <NyayOpsMark size={24} />
        </div>
        <div>
          <p className="type-greeting text-base text-ink">
            {timeOfDayGreeting()}
            {name ? `, ${name}` : ''}
          </p>
          <p className="mt-0.5 text-sm text-ink-muted">I can help you manage:</p>
        </div>
        <div className="grid grid-cols-2 gap-2 self-stretch">
          {QUICK_ACTIONS.map(({ icon: Icon, label, bullets, prompt }) => (
            <button
              key={label}
              type="button"
              onClick={() => onPrompt(prompt)}
              className="flex flex-col items-start gap-1 rounded-control border border-border px-2.5 py-2 text-left transition-colors hover:border-brand hover:bg-brand-soft"
            >
              <span className="grid size-6 place-items-center rounded-full bg-brand-soft text-brand">
                <Icon className="size-3.5" />
              </span>
              <span className="text-xs font-medium text-ink">{label}</span>
              <span className="text-[0.6875rem] text-ink-muted">{bullets[0]}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-5 py-16 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-brand-soft text-brand">
        <NyayOpsMark size={28} />
      </div>
      <div>
        <p className="type-greeting text-lg text-ink">
          {timeOfDayGreeting()}
          {name ? `, ${name}` : ''}
        </p>
        <p className="mt-1 text-sm text-ink-muted">I can help you manage:</p>
      </div>
      <div className="grid w-full grid-cols-1 gap-3 sm:w-[28rem] sm:grid-cols-2">
        {QUICK_ACTIONS.map(({ icon: Icon, label, bullets, prompt }) => (
          <button
            key={label}
            type="button"
            onClick={() => onPrompt(prompt)}
            className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface px-4 py-3.5 text-left transition-colors hover:border-brand hover:bg-brand-soft"
          >
            <span className="grid size-8 place-items-center rounded-full bg-brand-soft text-brand">
              <Icon className="size-4" />
            </span>
            <span className="text-sm font-medium text-ink">{label}</span>
            <ul className="text-xs text-ink-muted">
              {bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </button>
        ))}
      </div>
    </div>
  )
}
