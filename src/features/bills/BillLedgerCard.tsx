import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { IndianRupee } from 'lucide-react'
import { listBillsForCase } from '@/lib/api/bills'
import { qk } from '@/lib/queryKeys'
import { usePermissions } from '@/lib/usePermissions'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { BillStatusBadge, FlowDirectionBadge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/Feedback'
import { RaiseBillDialog } from '@/features/bills/RaiseBillDialog'

/** Per-case Bill Ledger (Billing_Module_Engineering_Spec.md section 8) - every bill
 * tied to this case in one place, so "which of the milestones are actually in" is one
 * screen instead of a WhatsApp search. */
export function BillLedgerCard({ caseId }: { caseId: string }) {
  const { hasPermission } = usePermissions()
  const [raising, setRaising] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: qk.caseBills(caseId),
    queryFn: () => listBillsForCase(caseId),
  })
  const bills = data ?? []

  return (
    <Card>
      <CardHeader
        title="Bills"
        description="Every bill and refund raised on this case"
        action={
          hasPermission('bills', 'create') && (
            <Button size="sm" onClick={() => setRaising(true)}>
              Raise bill
            </Button>
          )
        }
      />
      <CardBody className="border-t border-border p-0">
        {isLoading ? null : bills.length === 0 ? (
          <EmptyState icon={IndianRupee} title="No bills yet" description="Nothing raised on this case yet." />
        ) : (
          <div className="divide-y divide-border">
            {bills.map((bill) => (
              <div key={bill.id} className="flex items-center gap-3 px-5 py-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-control bg-info-soft text-info-strong">
                  <IndianRupee className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {bill.custom_type_label ?? 'Bill'}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {bill.amount != null ? `₹${bill.amount.toFixed(2)}` : 'No amount'}
                    {bill.due_stage ? ` · ${bill.due_stage}` : ''}
                  </p>
                  {bill.rejection_reason && (
                    <p className="text-xs text-danger">Rejected once: {bill.rejection_reason}</p>
                  )}
                </div>
                <FlowDirectionBadge direction={bill.flow_direction} />
                <BillStatusBadge status={bill.status} />
              </div>
            ))}
          </div>
        )}
      </CardBody>

      {raising && <RaiseBillDialog open onClose={() => setRaising(false)} caseId={caseId} />}
    </Card>
  )
}
