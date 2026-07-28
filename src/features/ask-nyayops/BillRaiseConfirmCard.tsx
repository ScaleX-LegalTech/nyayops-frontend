import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, X } from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { FlowDirectionBadge } from '@/components/ui/Badge'
import { UserMultiSelect } from '@/components/ui/UserMultiSelect'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/auth/AuthContext'
import { qk } from '@/lib/queryKeys'
import { describeAskNyayOpsError, recordAssistantAuditEvent } from '@/lib/api/askNyayOps'
import { raiseBill } from '@/lib/api/bills'
import { listBillTypes } from '@/lib/api/billTypes'
import { ActionCardHeader, VoiceTranscriptNote } from './actionCardKit'
import type { BillFlowDirection, BillPaymentDestinationType, PendingAction } from '@/types'

const DESTINATION_OPTIONS: { value: BillPaymentDestinationType; label: string }[] = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'upi', label: 'UPI' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
]

interface BillRaiseConfirmCardProps {
  pendingAction: PendingAction
  onResolved: (message?: string) => void
  voiceTranscript?: string
}

/** bill.raise's dedicated confirm UI (redesign brief §2) - the amount,
 * payment destination, and bill type stay editable right up to confirm
 * instead of forcing a discard-and-restart for a correction. Flow direction
 * (collection vs. refund) is shown read-only - it changes what the bill
 * *means*, not a detail worth inline-editing here. */
export function BillRaiseConfirmCard({ pendingAction, onResolved, voiceTranscript }: BillRaiseConfirmCardProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const after = pendingAction.after_state as {
    case_id: string
    associate_id: string
    bill_type_id: string | null
    custom_type_label: string | null
    flow_direction: BillFlowDirection
    amount: number | null
    payment_destination_type: BillPaymentDestinationType
    payment_destination_value: string
  }
  const { data: billTypes } = useQuery({ queryKey: qk.billTypes(), queryFn: () => listBillTypes() })
  const usingCustomType = Boolean(after.custom_type_label) && !after.bill_type_id

  const [amount, setAmount] = useState(after.amount != null ? String(after.amount) : '')
  const [billTypeId, setBillTypeId] = useState(after.bill_type_id ?? '')
  const [customLabel, setCustomLabel] = useState(after.custom_type_label ?? '')
  const [destinationType, setDestinationType] = useState(after.payment_destination_type)
  const [destinationValue, setDestinationValue] = useState(after.payment_destination_value)
  const [associateId, setAssociateId] = useState(after.associate_id ?? '')
  const [busy, setBusy] = useState(false)

  async function handleConfirm() {
    setBusy(true)
    try {
      const bill = await raiseBill(after.case_id, {
        associate_id: associateId,
        bill_type_id: usingCustomType ? undefined : billTypeId || undefined,
        custom_type_label: usingCustomType ? customLabel : undefined,
        flow_direction: after.flow_direction,
        amount: amount ? Number(amount) : undefined,
        payment_destination_type: destinationType,
        payment_destination_value: destinationValue,
      })
      await recordAssistantAuditEvent({
        action_type: 'ASSISTANT_HITL_APPROVED',
        resource_id: after.case_id,
        new_state: { action_type: pendingAction.action_type, approved_by: user?.sub, bill_id: bill.id, amount },
      })
      toast('Bill raised.', 'success')
      onResolved('Done! Bill raised.')
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
        title="Raise bill"
        description={pendingAction.summary}
      />
      <CardBody className="flex flex-col gap-3">
        {voiceTranscript && <VoiceTranscriptNote text={voiceTranscript} />}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium tracking-wide text-ink-faint uppercase">Direction</span>
          <FlowDirectionBadge direction={after.flow_direction} />
        </div>
        <Field
          label="Associate"
          error={!associateId ? 'Select who this bill is credited to.' : undefined}
        >
          <UserMultiSelect
            caseIds={[after.case_id]}
            selected={associateId ? [associateId] : []}
            onChange={(ids) => setAssociateId(ids[ids.length - 1] ?? '')}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Amount" hint={!amount ? 'Leave blank for a percentage-based bill.' : undefined}>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </Field>
          <Field label="Bill type">
            {usingCustomType ? (
              <Input value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} />
            ) : (
              <Select value={billTypeId} onChange={(e) => setBillTypeId(e.target.value)}>
                {(billTypes ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Payment destination">
            <Select
              value={destinationType}
              onChange={(e) => setDestinationType(e.target.value as BillPaymentDestinationType)}
            >
              {DESTINATION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Payment account / reference">
            <Input value={destinationValue} onChange={(e) => setDestinationValue(e.target.value)} />
          </Field>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onResolved("Okay, I won't raise that bill.")}
            disabled={busy}
          >
            <X className="size-4" /> Discard
          </Button>
          <Button
            size="sm"
            loading={busy}
            disabled={
              !associateId ||
              !destinationValue.trim() ||
              (usingCustomType ? !customLabel.trim() : !billTypeId)
            }
            onClick={handleConfirm}
          >
            <Check className="size-4" /> Raise bill
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}
