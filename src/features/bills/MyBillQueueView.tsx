import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { IndianRupee, MessageSquare } from 'lucide-react'
import { getMyBillQueue, markBillContacted } from '@/lib/api/bills'
import { invalidateCaseScopes, qk } from '@/lib/queryKeys'
import { useMutationWithToast } from '@/lib/useMutationWithToast'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { BillStatusBadge, FlowDirectionBadge } from '@/components/ui/Badge'
import { Table, TBody, Td, Th, THead, TableWrap, Tr } from '@/components/ui/Table'
import { EmptyState, LoadingState } from '@/components/ui/Feedback'
import { BillProofUploadDialog } from '@/features/bills/BillProofUploadDialog'
import type { Bill } from '@/types'

/** The Associate's own bill queue - always self-scoped by the backend
 * (GET /bills/my-queue), so viewing it needs no permission, the same way "My Work"
 * on the dashboard needs none. Mounted as the "My queue" tab of BillsPage - not a
 * standalone routed page. */
export function MyBillQueueView() {
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
    <div>
      {isLoading ? (
        <LoadingState />
      ) : bills.length === 0 ? (
        <TableWrap>
          <EmptyState
            icon={IndianRupee}
            title="Nothing to follow up on"
            description="No bills are currently assigned to you."
          />
        </TableWrap>
      ) : (
        <>
          <TableWrap className="hidden lg:block">
            <Table>
              <THead>
                <Tr>
                  <Th>Case</Th>
                  <Th>Type</Th>
                  <Th>Direction</Th>
                  <Th>Amount</Th>
                  <Th>Due stage</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Action</Th>
                </Tr>
              </THead>
              <TBody>
                {bills.map((bill) => (
                  <Tr key={bill.id} className="hover:bg-surface-muted">
                    <Td className="max-w-[220px]">
                      <Link
                        to={`/cases/${bill.case_id}`}
                        className="block truncate font-medium hover:text-brand"
                      >
                        {bill.case_title}
                      </Link>
                      <p className="truncate text-xs text-ink-muted">{bill.case_client_name}</p>
                    </Td>
                    <Td className="text-ink-muted">{bill.custom_type_label ?? '—'}</Td>
                    <Td>
                      <FlowDirectionBadge direction={bill.flow_direction} />
                    </Td>
                    <Td className="tabular">
                      {bill.amount != null ? `₹${bill.amount.toFixed(2)}` : '—'}
                    </Td>
                    <Td className="text-ink-muted">{bill.due_stage ?? '—'}</Td>
                    <Td>
                      <div className="space-y-1">
                        <BillStatusBadge status={bill.status} />
                        {bill.rejection_reason && (
                          <p className="text-xs text-danger">Rejected: {bill.rejection_reason}</p>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <div className="flex justify-end gap-2">
                        <Link
                          to={`/bills/${bill.id}/thread`}
                          className="inline-flex items-center gap-1.5 rounded-control border border-border bg-surface px-2.5 py-1.5 text-xs text-ink-muted hover:text-ink"
                        >
                          <MessageSquare className="size-3.5" /> Thread
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
                          <Button size="sm" onClick={() => setUploadingFor(bill)}>
                            {bill.rejection_reason ? 'Re-upload proof' : 'Upload proof'}
                          </Button>
                        )}
                        {bill.status === 'proof_uploaded' && (
                          <span className="text-xs text-ink-muted">Awaiting approval</span>
                        )}
                      </div>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableWrap>

          <div className="divide-y divide-border rounded-card border border-border bg-surface lg:hidden">
            {bills.map((bill) => (
              <div key={bill.id} className="flex flex-col gap-3 px-4 py-3">
                <div className="flex min-w-0 items-start gap-4">
                  <span className="hidden size-11 shrink-0 place-items-center rounded-control bg-brand-soft text-brand">
                    <IndianRupee className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/cases/${bill.case_id}`}
                      className="block truncate text-sm font-semibold text-ink hover:underline"
                    >
                      {bill.case_title}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <FlowDirectionBadge direction={bill.flow_direction} />
                      <BillStatusBadge status={bill.status} />
                    </div>
                    <p className="mt-1 truncate text-xs text-ink-faint">{bill.case_client_name}</p>
                    {bill.rejection_reason && (
                      <p className="mt-1 text-xs text-danger">Rejected: {bill.rejection_reason}</p>
                    )}
                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
                      <div className="min-w-0">
                        <p className="type-label text-[10px] text-ink-faint">Type</p>
                        <p className="mt-0.5 truncate text-xs text-ink-muted">
                          {bill.custom_type_label ?? '—'}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="type-label text-[10px] text-ink-faint">Due stage</p>
                        <p className="mt-0.5 truncate text-xs text-ink-muted">{bill.due_stage ?? '—'}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="type-label text-[10px] text-ink-faint">Amount</p>
                        <p className="mt-0.5 truncate text-xs font-semibold tabular text-ink">
                          {bill.amount != null ? `₹${bill.amount.toFixed(2)}` : '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
                  <Link
                    to={`/bills/${bill.id}/thread`}
                    className="inline-flex items-center gap-1.5 rounded-control border border-border bg-surface px-2.5 py-1.5 text-xs text-ink-muted hover:text-ink"
                  >
                    <MessageSquare className="size-3.5" /> Thread
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
                    <Button size="sm" onClick={() => setUploadingFor(bill)}>
                      {bill.rejection_reason ? 'Re-upload proof' : 'Upload proof'}
                    </Button>
                  )}
                  {bill.status === 'proof_uploaded' && (
                    <span className="text-xs text-ink-muted">Awaiting approval</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {uploadingFor && (
        <BillProofUploadDialog open onClose={() => setUploadingFor(null)} bill={uploadingFor} />
      )}
    </div>
  )
}
