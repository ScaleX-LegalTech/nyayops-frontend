import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Capsule } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'
import { humanize } from '@/lib/format'
import { ACTION_ICON, DEFAULT_ACTION_ICON, TIER_CAPSULE_ICON, TIER_ICON_WRAP, TIER_LABEL, TIER_TONE } from './actionCardMeta'
import type { PendingAction } from '@/types'

/** Shared chrome for every action-confirmation card in Ask NyayOps (redesign
 * brief §1/§10) - one header treatment, one tier vocabulary, one before/after
 * diff renderer, so a dedicated card (bill, role, destructive, ...) and the
 * generic fallback card both read as the same review-workflow surface
 * instead of drifting into their own one-off layouts. */

/** Icon-in-circle + title + tier capsule + one-line description, with a
 * divider before the card body - the one header every action card renders,
 * dedicated or generic. */
export function ActionCardHeader({
  actionType,
  tier,
  title,
  description,
}: {
  actionType: string
  tier: PendingAction['tier']
  title: ReactNode
  description?: ReactNode
}) {
  const Icon = ACTION_ICON[actionType] ?? DEFAULT_ACTION_ICON
  return (
    <div className="flex items-start gap-3 border-b border-border px-5 py-4">
      <span
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-full',
          TIER_ICON_WRAP[tier],
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          <Capsule tone={TIER_TONE[tier]} icon={TIER_CAPSULE_ICON[tier]}>
            {TIER_LABEL[tier]}
          </Capsule>
        </div>
        {description && <p className="mt-1 text-xs text-ink-muted">{description}</p>}
      </div>
    </div>
  )
}

export function VoiceTranscriptNote({ text }: { text: string }) {
  return (
    <p className="rounded-control bg-surface-muted px-3 py-2 text-xs text-ink-muted">
      You said: <span className="text-ink">&ldquo;{text}&rdquo;</span>
    </p>
  )
}

// Internal ids (branch_id, role_ids, user_id, ...) are plumbing for execute()
// calls, not something worth showing a human - a real name/label field
// (branch_name, role_names, ...) is always drafted alongside one where it
// matters. Filtered out here, not at the source, so this protects every
// action_type generically, including ones added later.
const ID_KEY = /^id$|_id$|_ids$/i

export function StateBlock({ title, state }: { title: string; state: Record<string, unknown> | null }) {
  if (!state) return null
  const entries = Object.entries(state).filter(
    ([k, v]) => v !== null && v !== undefined && v !== '' && !ID_KEY.test(k),
  )
  if (entries.length === 0) return null
  return (
    <div className="min-w-0 flex-1">
      <p className="text-xs font-medium tracking-wide text-ink-faint uppercase">{title}</p>
      <dl className="mt-1 space-y-1">
        {entries.map(([key, value]) => (
          <div key={key} className="flex justify-between gap-3 text-xs">
            <dt className="shrink-0 text-ink-muted">{humanize(key)}</dt>
            <dd className="text-right break-words text-ink">
              {Array.isArray(value) ? value.join(', ') : String(value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** The destructive-action gate (redesign brief §4): plain-language impact
 * bullets instead of a raw diff, plus a required "I understand" checkbox
 * before Confirm/Send-for-approval enables. Shared by DestructiveConfirmCard
 * and any dedicated T3 card (e.g. PermissionsUpdateConfirmCard) that needs
 * the same gate around its own bespoke body. */
export function WarningPanel({
  impact,
  irreversible,
  needsSecondApproval,
  acked,
  onAckChange,
}: {
  impact: string[]
  irreversible?: boolean
  needsSecondApproval?: boolean
  acked: boolean
  onAckChange: (v: boolean) => void
}) {
  return (
    <div className="flex flex-col gap-3 rounded-control border border-danger/30 bg-danger-soft p-3.5">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-danger-strong">This will affect</p>
          <ul className="mt-1.5 space-y-1 text-xs text-ink">
            {impact.map((line) => (
              <li key={line} className="flex gap-1.5">
                <span className="text-danger">&bull;</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
          {irreversible && (
            <p className="mt-2 text-xs font-medium text-danger">This cannot be undone.</p>
          )}
          {needsSecondApproval && (
            <p className="mt-1 text-xs text-ink-muted">
              Requires a second admin&apos;s approval before it happens.
            </p>
          )}
        </div>
      </div>
      <label className="flex items-center gap-2 border-t border-danger/20 pt-3 text-xs text-ink">
        <input
          type="checkbox"
          checked={acked}
          onChange={(e) => onAckChange(e.target.checked)}
          className="accent-danger"
        />
        I understand the consequences described above.
      </label>
    </div>
  )
}
