import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { IndianRupee } from 'lucide-react'
import { getMyBillQueue, markBillContacted } from '@/lib/api/bills'
import { invalidateCaseScopes, qk } from '@/lib/queryKeys'
import { useMutationWithToast } from '@/lib/useMutationWithToast'
import { useToast } from '@/components/ui/Toast'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { BillStatusBadge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/Feedback'
import { ListRowsSkeleton } from '@/features/dashboard/DashboardPage'
import { BillProofUploadDialog } from '@/features/bills/BillProofUploadDialog'
import { billCopy } from '@/features/bills/copy'
import type { Bill } from '@/types'

/** Replaces the old milestone-backed PaymentFollowUpCard - this is the real Billing
 * module the dashboard's "Payment follow-ups" section was always meant to show. */
export function BillQueueCard() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [uploadingFor, setUploadingFor] = useState<Bill | null>(null)

  const { data, isLoading } = useQuery({ queryKey: qk.billQueue, queryFn: getMyBillQueue })
  const bills = data ?? []

  const contactMutation = useMutationWithToast({
    mutationFn: (billId: string) => markBillContacted(billId),
    onSuccess: () => {
      invalidateCaseScopes(queryClient)
      toast('Marked as contacted.', 'success')
    },
    errorFallback: 'Could not update the bill.',
  })

  return (
    <Card>
      <CardHeader
        title="Payment follow-ups"
        description="Bills still awaiting action, on your cases"
      />
      <CardBody className="border-t border-border p-0">
        {isLoading ? (
          <ListRowsSkeleton />
        ) : bills.length === 0 ? (
          <EmptyState
            icon={IndianRupee}
            title="Nothing to follow up on"
            description="No pending bills on your cases."
          />
        ) : (
          <div className="divide-y divide-border">
            {bills.map((bill) => {
              const copy = billCopy(bill.flow_direction)
              return (
                <div key={bill.id} className="flex items-center gap-3 px-5 py-3">
                  <Link
                    to={`/cases/${bill.case_id}`}
                    className="flex min-w-0 flex-1 items-center gap-3 hover:text-brand"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-control bg-info-soft text-info-strong">
                      <IndianRupee className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">
                        {bill.custom_type_label ?? copy.actionLabel}
                      </span>
                      {bill.rejection_reason ? (
                        <span className="block truncate text-xs text-danger">
                          Rejected: {bill.rejection_reason}
                        </span>
                      ) : (
                        bill.due_stage && (
                          <span className="block truncate text-xs text-ink-muted">{bill.due_stage}</span>
                        )
                      )}
                    </span>
                  </Link>
                  {bill.status === 'raised' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={contactMutation.isPending}
                      onClick={() => contactMutation.mutate(bill.id)}
                    >
                      Mark contacted
                    </Button>
                  )}
                  {(bill.status === 'raised' || bill.status === 'client_contacted') && (
                    <Button size="sm" variant="secondary" onClick={() => setUploadingFor(bill)}>
                      {bill.rejection_reason ? 'Re-upload proof' : 'Upload proof'}
                    </Button>
                  )}
                  {bill.status === 'proof_uploaded' && <BillStatusBadge status={bill.status} />}
                </div>
              )
            })}
          </div>
        )}
      </CardBody>

      {uploadingFor && (
        <BillProofUploadDialog
          open
          onClose={() => setUploadingFor(null)}
          bill={uploadingFor}
        />
      )}
    </Card>
  )
}
