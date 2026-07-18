import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Eye } from 'lucide-react'
import { approveBill, rejectBill } from '@/lib/api/bills'
import { getDocument, loadDocumentBlob } from '@/lib/api/documents'
import { invalidateCaseScopes, qk } from '@/lib/queryKeys'
import { formatDate, formatDateTime } from '@/lib/format'
import { useMutationWithToast } from '@/lib/useMutationWithToast'
import { usePermissions } from '@/lib/usePermissions'
import { useUsers } from '@/lib/useUsers'
import { useToast } from '@/components/ui/Toast'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Textarea } from '@/components/ui/Field'
import { BillStatusBadge, FlowDirectionBadge } from '@/components/ui/Badge'
import { DocumentPreviewDialog, type PreviewTarget } from '@/components/ui/DocumentPreviewDialog'
import { billCopy } from '@/features/bills/copy'
import type { Bill } from '@/types'

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value || '—'}</dd>
    </div>
  )
}

/** Full read view of one bill, folding in what used to be the standalone Review
 * Queue page's approve/reject/proof-preview - "All bills" is now the one place
 * admins work bills, so those actions live wherever a bill is opened from rather
 * than a separate screen. */
export function BillDetailDialog({ bill, onClose }: { bill: Bill | null; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { hasPermission } = usePermissions()
  const { nameOf } = useUsers()
  const [previewing, setPreviewing] = useState<'proof' | 'payment_info' | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')

  const previewDocId =
    previewing === 'proof' ? bill?.proof_document_id : previewing === 'payment_info' ? bill?.payment_info_document_id : null
  const docQuery = useQuery({
    queryKey: qk.documentDetail(previewDocId ?? ''),
    queryFn: () => getDocument(previewDocId!),
    enabled: !!previewDocId,
  })
  const latestVersion = docQuery.data?.versions.at(-1) ?? null
  const previewTarget: PreviewTarget | null =
    previewDocId && latestVersion
      ? {
          title: previewing === 'proof' ? 'Payment proof' : 'Payment info',
          mimeType: latestVersion.mime_type,
          load: () => loadDocumentBlob(latestVersion.storage_key),
        }
      : null

  function close() {
    setRejecting(false)
    setReason('')
    onClose()
  }

  const approveMutation = useMutationWithToast({
    mutationFn: () => approveBill(bill!.id),
    onSuccess: () => {
      invalidateCaseScopes(queryClient)
      toast('Bill approved.', 'success')
      close()
    },
    errorFallback: 'Could not approve the bill.',
  })

  const rejectMutation = useMutationWithToast({
    mutationFn: () => rejectBill(bill!.id, reason),
    onSuccess: () => {
      invalidateCaseScopes(queryClient)
      toast('Bill sent back to the associate.', 'success')
      close()
    },
    errorFallback: 'Could not reject the bill.',
  })

  if (!bill) return null
  const copy = billCopy(bill.flow_direction)
  const canReview = bill.status === 'proof_uploaded'

  return (
    <>
      <Dialog
        open={!!bill}
        onClose={close}
        title={bill.custom_type_label ?? 'Bill'}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Link to={`/cases/${bill.case_id}`} className="hover:text-brand">
              {bill.case_title}
            </Link>
            <span className="text-ink-faint">·</span>
            <span>{bill.case_client_name}</span>
          </span>
        }
        size="lg"
        footer={
          rejecting ? (
            <>
              <Button variant="secondary" onClick={() => setRejecting(false)}>
                Back
              </Button>
              <Button
                variant="danger"
                loading={rejectMutation.isPending}
                disabled={!reason.trim()}
                onClick={() => rejectMutation.mutate()}
              >
                Confirm reject
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={close}>
                Close
              </Button>
              {canReview && hasPermission('bills', 'reject') && (
                <Button variant="danger" onClick={() => setRejecting(true)}>
                  Reject
                </Button>
              )}
              {canReview && hasPermission('bills', 'approve') && (
                <Button loading={approveMutation.isPending} onClick={() => approveMutation.mutate()}>
                  Approve
                </Button>
              )}
            </>
          )
        }
      >
        {rejecting ? (
          <Field
            label="Reason"
            required
            error={!reason.trim() ? 'A reason is required to reject.' : undefined}
            hint="Sent back to the associate with this reason attached."
          >
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} autoFocus />
          </Field>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <BillStatusBadge status={bill.status} />
              <FlowDirectionBadge direction={bill.flow_direction} />
            </div>

            {bill.rejection_reason && (
              <p className="rounded-control border border-dashed border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">
                Rejected: {bill.rejection_reason}
              </p>
            )}

            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              <Detail label={copy.actionLabel} value={bill.amount != null ? `₹${bill.amount.toFixed(2)}` : null} />
              <Detail label="Due stage" value={bill.due_stage} />
              <Detail label="Due date" value={formatDate(bill.due_date)} />
              <Detail label="Associate" value={nameOf(bill.associate_id)} />
              <Detail label="Raised by" value={nameOf(bill.raised_by)} />
              {bill.approved_by && (
                <Detail label="Approved by" value={`${nameOf(bill.approved_by)} · ${formatDateTime(bill.approved_at)}`} />
              )}
            </dl>

            {bill.line_items.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs uppercase tracking-wide text-ink-faint">Line items</p>
                <ul className="divide-y divide-border rounded-control border border-border text-sm">
                  {bill.line_items.map((item) => (
                    <li key={item.id} className="flex items-center justify-between px-3 py-2">
                      <span className="text-ink">{item.description}</span>
                      <span className="tabular text-ink-muted">₹{item.amount.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-control border border-border bg-surface-muted px-3.5 py-3">
              <p className="text-xs uppercase tracking-wide text-ink-faint">Where the client should pay</p>
              <p className="mt-1 text-sm text-ink">
                {bill.payment_destination_type.replace('_', ' ')}: {bill.payment_destination_value}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {bill.payment_info_document_id && (
                <Button size="sm" variant="secondary" onClick={() => setPreviewing('payment_info')}>
                  <Eye className="size-4" /> View payment info
                </Button>
              )}
              {bill.proof_document_id && (
                <Button size="sm" variant="secondary" onClick={() => setPreviewing('proof')}>
                  <Eye className="size-4" /> View proof
                </Button>
              )}
            </div>
          </div>
        )}
      </Dialog>

      <DocumentPreviewDialog
        open={!!previewing}
        onClose={() => setPreviewing(null)}
        target={previewTarget}
      />
    </>
  )
}
