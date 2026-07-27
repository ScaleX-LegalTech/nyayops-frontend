import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/auth/AuthContext'
import { humanize } from '@/lib/format'
import { describeAskNyayOpsError, recordAssistantAuditEvent } from '@/lib/api/askNyayOps'
import { proposePendingApproval } from '@/lib/api/assistantApprovals'
import { HANDLERS, SECOND_APPROVAL_ACTION_TYPES } from './pendingActionHandlers'
import { ActionCardHeader, StateBlock, VoiceTranscriptNote, WarningPanel } from './actionCardKit'
import type { PendingAction } from '@/types'

// Plain-language consequences per action_type (redesign brief §4) - a raw
// before/after diff doesn't say what deleting a role or freezing an org
// actually does to the people affected by it.
const IMPACT_COPY: Record<string, string[]> = {
  'role.delete': ['Anyone currently assigned this role loses the access it grants.'],
  'branch.delete': [
    'Users, cases, and history tied to this branch are not deleted, but the branch record itself is removed.',
  ],
  'organization.freeze': [
    'Most write actions across the organization are blocked for every user while frozen.',
  ],
  'user.deactivate': [
    'This person loses access to the organization immediately.',
    'Cases already assigned to them are not automatically reassigned.',
  ],
  'document.permanently_delete': ['The file and every version of it are permanently removed from storage.'],
}

interface DestructiveConfirmCardProps {
  pendingAction: PendingAction
  onResolved: (message?: string) => void
  voiceTranscript?: string
}

/** The dedicated destructive-workflow surface (redesign brief §4) for T3
 * actions with no bespoke form of their own - role.delete, branch.delete,
 * organization.freeze, user.deactivate, document.permanently_delete. Shows
 * what's affected as plain-language impact bullets instead of a generic
 * before/after diff, and gates Confirm behind an explicit checkbox. */
export function DestructiveConfirmCard({ pendingAction, onResolved, voiceTranscript }: DestructiveConfirmCardProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [acked, setAcked] = useState(false)
  const [busy, setBusy] = useState(false)

  const handler = HANDLERS[pendingAction.action_type]
  const label = handler?.label ?? humanize(pendingAction.action_type)
  const needsSecondApproval = SECOND_APPROVAL_ACTION_TYPES.has(pendingAction.action_type)
  const impact =
    IMPACT_COPY[pendingAction.action_type] ??
    pendingAction.would_affect.map((s) => `Affects ${humanize(s.split(':')[0])}.`)

  async function handleConfirm() {
    setBusy(true)
    try {
      if (needsSecondApproval) {
        await proposePendingApproval(pendingAction)
        toast('Sent to another admin for approval.', 'success')
        onResolved(
          "I've sent this for a second admin to approve - it needs someone other than you to sign off before it happens.",
        )
      } else if (handler?.execute) {
        await handler.execute(pendingAction)
        await recordAssistantAuditEvent({
          action_type: 'ASSISTANT_HITL_APPROVED',
          resource_id: pendingAction.would_affect[0]?.split(':')[1] ?? 'n/a',
          new_state: { action_type: pendingAction.action_type, approved_by: user?.sub },
        })
        toast('Done.', 'success')
        onResolved('Done!')
      }
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
        tier="T3"
        title={label}
        description={pendingAction.summary}
      />
      <CardBody className="flex flex-col gap-3">
        {voiceTranscript && <VoiceTranscriptNote text={voiceTranscript} />}
        {pendingAction.before_state && Object.keys(pendingAction.before_state).length > 0 && (
          <div className="rounded-control bg-surface-muted p-3">
            <StateBlock title="Current state" state={pendingAction.before_state} />
          </div>
        )}
        <WarningPanel
          impact={impact}
          irreversible={handler?.irreversible}
          needsSecondApproval={needsSecondApproval}
          acked={acked}
          onAckChange={setAcked}
        />
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
            <Check className="size-4" /> {needsSecondApproval ? 'Send for approval' : 'Confirm'}
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}
