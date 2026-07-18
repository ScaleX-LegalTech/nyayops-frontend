import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { IndianRupee } from 'lucide-react'
import { listBills } from '@/lib/api/bills'
import { listBranches } from '@/lib/api/admin'
import { qk } from '@/lib/queryKeys'
import { useAuth } from '@/auth/AuthContext'
import { useUsers } from '@/lib/useUsers'
import { CaseCombobox } from '@/components/ui/CaseCombobox'
import { Field, Select } from '@/components/ui/Field'
import { BillStatusBadge, FlowDirectionBadge } from '@/components/ui/Badge'
import { Table, TBody, Td, Th, THead, TableWrap, Tr } from '@/components/ui/Table'
import { EmptyState, LoadingState } from '@/components/ui/Feedback'
import { RaiseBillDialog } from '@/features/bills/RaiseBillDialog'
import { BillDetailDialog } from '@/features/bills/BillDetailDialog'
import type { Bill, BillStatus, BillFlowDirection } from '@/types'

const STATUS_OPTIONS: { value: BillStatus; label: string }[] = [
  { value: 'raised', label: 'Raised' },
  { value: 'client_contacted', label: 'Client contacted' },
  { value: 'proof_uploaded', label: 'Proof uploaded' },
  { value: 'approved', label: 'Approved' },
]

/** The admin/branch-admin management view - case search to raise a bill, filters
 * (status/direction/associate, plus a branch filter for the org admin), and a
 * click-through detail dialog that folds in what used to be a separate Review
 * Queue page's approve/reject. */
export function AllBillsView() {
  const { isManagingDirector } = useAuth()
  const { users } = useUsers()
  const [raisingForCaseId, setRaisingForCaseId] = useState<string | null>(null)
  const [viewingBill, setViewingBill] = useState<Bill | null>(null)
  const [pendingOnly, setPendingOnly] = useState(true)
  const [status, setStatus] = useState<BillStatus | ''>('')
  const [flowDirection, setFlowDirection] = useState<BillFlowDirection | ''>('')
  const [branchId, setBranchId] = useState('')
  const [associateId, setAssociateId] = useState('')

  const branchesQuery = useQuery({
    queryKey: qk.branches,
    queryFn: listBranches,
    enabled: isManagingDirector,
  })

  const filters = {
    status: status || undefined,
    flow_direction: flowDirection || undefined,
    branch_id: branchId || undefined,
    associate_id: associateId || undefined,
  }
  const { data, isLoading } = useQuery({
    queryKey: qk.bills(filters),
    queryFn: () => listBills(filters),
  })

  const bills = useMemo(() => {
    const all = data ?? []
    return pendingOnly ? all.filter((b) => b.status !== 'approved') : all
  }, [data, pendingOnly])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <Field label="Raise a bill" hint="Search a case to raise a bill against it." className="sm:w-80">
          <CaseCombobox
            value=""
            onChange={(option) => option && setRaisingForCaseId(option.id)}
            excludeClosed
            placeholder="Search cases…"
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={pendingOnly}
            onChange={(e) => setPendingOnly(e.target.checked)}
          />
          Pending only
        </label>
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value as BillStatus | '')}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Direction">
          <Select
            value={flowDirection}
            onChange={(e) => setFlowDirection(e.target.value as BillFlowDirection | '')}
          >
            <option value="">Collection & refund</option>
            <option value="collection">Collection</option>
            <option value="refund">Refund</option>
          </Select>
        </Field>
        {isManagingDirector && (
          <Field label="Branch">
            <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">All branches</option>
              {(branchesQuery.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Associate">
          <Select value={associateId} onChange={(e) => setAssociateId(e.target.value)}>
            <option value="">Everyone</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : bills.length === 0 ? (
        <TableWrap>
          <EmptyState
            icon={IndianRupee}
            title="No bills match these filters"
            description="Search a case above to raise one, or adjust the filters."
          />
        </TableWrap>
      ) : (
        <TableWrap>
          <Table>
            <THead>
              <Tr>
                <Th>Case</Th>
                <Th>Client</Th>
                <Th>Bill type</Th>
                <Th>Client POC</Th>
                <Th>Due stage</Th>
                <Th>Amount</Th>
                <Th>Direction</Th>
                <Th>Status</Th>
              </Tr>
            </THead>
            <TBody>
              {bills.map((bill) => (
                <Tr
                  key={bill.id}
                  className="cursor-pointer hover:bg-surface-muted"
                  onClick={() => setViewingBill(bill)}
                >
                  <Td>
                    <Link
                      to={`/cases/${bill.case_id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-medium hover:text-brand"
                    >
                      {bill.case_title}
                    </Link>
                  </Td>
                  <Td className="text-ink-muted">{bill.case_client_name}</Td>
                  <Td className="text-ink-muted">{bill.custom_type_label ?? '—'}</Td>
                  <Td className="text-ink-muted">
                    {users.find((u) => u.id === bill.associate_id)?.full_name ?? '—'}
                  </Td>
                  <Td className="text-ink-muted">{bill.due_stage ?? '—'}</Td>
                  <Td className="tabular">{bill.amount != null ? `₹${bill.amount.toFixed(2)}` : '—'}</Td>
                  <Td>
                    <FlowDirectionBadge direction={bill.flow_direction} />
                  </Td>
                  <Td>
                    <BillStatusBadge status={bill.status} />
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      )}

      {raisingForCaseId && (
        <RaiseBillDialog
          open
          onClose={() => setRaisingForCaseId(null)}
          caseId={raisingForCaseId}
        />
      )}
      <BillDetailDialog bill={viewingBill} onClose={() => setViewingBill(null)} />
    </div>
  )
}
