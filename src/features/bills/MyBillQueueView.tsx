import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { IndianRupee } from 'lucide-react'
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
        <TableWrap>
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
                  <Td>
                    <Link to={`/cases/${bill.case_id}`} className="font-medium hover:text-brand">
                      {bill.case_title}
                    </Link>
                    <p className="text-xs text-ink-muted">{bill.case_client_name}</p>
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
      )}

      {uploadingFor && (
        <BillProofUploadDialog open onClose={() => setUploadingFor(null)} bill={uploadingFor} />
      )}
    </div>
  )
}
