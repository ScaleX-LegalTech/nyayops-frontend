import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/auth/AuthContext'
import { cn } from '@/lib/cn'
import { describeAskNyayOpsError, recordAssistantAuditEvent } from '@/lib/api/askNyayOps'
import { updateBranchAdminPermissions } from '@/lib/api/branchAdmins'
import { ActionCardHeader, VoiceTranscriptNote, WarningPanel } from './actionCardKit'
import { idFromWouldAffect } from './pendingActionHandlers'
import type { BranchAdminPermissionsUpdate, PendingAction } from '@/types'

type ToggleKey = Exclude<keyof BranchAdminPermissionsUpdate, 'branch_id'>

const TOGGLES: { key: ToggleKey; label: string; hint: string }[] = [
  { key: 'case_reassignment', label: 'Case reassignment', hint: 'Can reassign cases within this branch.' },
  { key: 'fee_milestone_setting', label: 'Fee milestone setting', hint: 'Can create or edit payment milestones.' },
  { key: 'precedent_sharing', label: 'Precedent sharing', hint: 'Can share precedent documents branch-wide.' },
  { key: 'invite_team_members', label: 'Invite team members', hint: 'Can invite new users into this branch.' },
  {
    key: 'document_access_full',
    label: 'Full document access',
    hint: 'Can view and manage all documents, not just assigned cases.',
  },
]

interface PermissionsUpdateConfirmCardProps {
  pendingAction: PendingAction
  onResolved: (message?: string) => void
  voiceTranscript?: string
}

/** branch_admin.permissions_update's dedicated confirm UI (redesign brief §4)
 * - a widening of what one person can manage org-wide, so it gets switches
 * (not a raw diff) plus the same destructive-workflow gate every other T3
 * action gets: what changes, then a required acknowledgement before Confirm
 * enables. */
export function PermissionsUpdateConfirmCard({
  pendingAction,
  onResolved,
  voiceTranscript,
}: PermissionsUpdateConfirmCardProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const after = pendingAction.after_state as unknown as BranchAdminPermissionsUpdate & {
    branch_name: string
  }
  const before = pendingAction.before_state as Partial<BranchAdminPermissionsUpdate> | null
  const userId = idFromWouldAffect(pendingAction, 'user')

  const [values, setValues] = useState<Record<ToggleKey, boolean>>(() =>
    Object.fromEntries(TOGGLES.map((t) => [t.key, Boolean(after[t.key])])) as Record<ToggleKey, boolean>,
  )
  const [acked, setAcked] = useState(false)
  const [busy, setBusy] = useState(false)

  const changed = TOGGLES.filter((t) => before && Boolean(before[t.key]) !== values[t.key])
  const impact = [
    `Changes what this branch admin can manage across the ${after.branch_name} branch.`,
    ...(changed.length > 0
      ? [`${changed.length} permission${changed.length === 1 ? '' : 's'} will change from their current value.`]
      : []),
  ]

  async function handleConfirm() {
    setBusy(true)
    try {
      await updateBranchAdminPermissions(userId, { branch_id: after.branch_id, ...values })
      await recordAssistantAuditEvent({
        action_type: 'ASSISTANT_HITL_APPROVED',
        resource_id: userId,
        new_state: { action_type: pendingAction.action_type, approved_by: user?.sub, ...values },
      })
      toast('Permissions updated.', 'success')
      onResolved('Done! Branch admin permissions updated.')
    } catch (err) {
      toast(describeAskNyayOpsError(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="animate-message-in mt-2 border-border-strong shadow-sm">
      <ActionCardHeader
        actionType={pendingAction.action_type}
        tier={pendingAction.tier}
        title="Update branch admin permissions"
        description={pendingAction.summary}
      />
      <CardBody className="flex flex-col gap-3">
        {voiceTranscript && <VoiceTranscriptNote text={voiceTranscript} />}
        <div className="divide-y divide-border rounded-control border border-border">
          {TOGGLES.map((t) => {
            const was = before ? Boolean(before[t.key]) : undefined
            const now = values[t.key]
            return (
              <div key={t.key} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm text-ink">{t.label}</p>
                  <p className="text-xs text-ink-muted">{t.hint}</p>
                  {was !== undefined && was !== now && (
                    <p className="mt-0.5 text-[0.6875rem] font-medium text-warning-strong">
                      {was ? 'On' : 'Off'} &rarr; {now ? 'On' : 'Off'}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={now}
                  aria-label={t.label}
                  onClick={() => setValues((v) => ({ ...v, [t.key]: !v[t.key] }))}
                  className={cn(
                    'relative h-5 w-9 shrink-0 rounded-full transition-colors',
                    now ? 'bg-brand' : 'border border-border-strong bg-surface-muted',
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform',
                      now ? 'translate-x-4' : 'translate-x-0.5',
                    )}
                  />
                </button>
              </div>
            )
          })}
        </div>
        <WarningPanel impact={impact} acked={acked} onAckChange={setAcked} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onResolved("Okay, I've discarded that - let me know if you'd like something else.")}
            disabled={busy}
          >
            <X className="size-4" /> Discard
          </Button>
          <Button size="sm" variant="danger" loading={busy} disabled={!acked} onClick={handleConfirm}>
            <Check className="size-4" /> Confirm
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}
