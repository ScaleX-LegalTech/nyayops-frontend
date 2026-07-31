import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { IndianRupee, ListFilter, MessageSquare } from 'lucide-react'
import { listBills } from '@/lib/api/bills'
import { listBranches } from '@/lib/api/admin'
import { qk } from '@/lib/queryKeys'
import { useAuth } from '@/auth/AuthContext'
import { useUsers } from '@/lib/useUsers'
import { useUrlState } from '@/lib/useUrlState'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
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
  const [pendingOnlyStr, setPendingOnlyStr] = useUrlState('pending_only', 'true')
  const pendingOnly = pendingOnlyStr !== 'false'
  const setPendingOnly = (v: boolean) => setPendingOnlyStr(String(v))
  const [status, setStatus] = useUrlState('status')
  const [flowDirection, setFlowDirection] = useUrlState('direction')
  const [branchId, setBranchId] = useUrlState('branch_id')
  const [associateId, setAssociateId] = useUrlState('associate_id')
  const [filtersOpen, setFiltersOpen] = useState(false)

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

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={pendingOnly}
              onChange={(e) => setPendingOnly(e.target.checked)}
            />
            Pending only
          </label>
          <Button
            variant="secondary"
            className="ml-auto shrink-0 sm:hidden"
            onClick={() => setFiltersOpen((v) => !v)}
          >
            <ListFilter className="size-4" /> Filters
          </Button>
        </div>

        <div
          className={cn('grid gap-3 sm:grid-cols-2 lg:grid-cols-4', filtersOpen ? 'grid' : 'hidden sm:grid')}
        >
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
        <>
          {/* Desktop: real table - lg+ viewports have room for every column without
              forcing a squeeze, so this never needs to scroll horizontally. */}
          <TableWrap className="hidden lg:block">
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
                  <Th />
                </Tr>
              </THead>
              <TBody>
                {bills.map((bill) => (
                  <Tr
                    key={bill.id}
                    className="cursor-pointer hover:bg-surface-muted"
                    onClick={() => setViewingBill(bill)}
                  >
                    <Td className="max-w-[220px]">
                      <Link
                        to={`/cases/${bill.case_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="block truncate font-medium hover:text-brand"
                      >
                        {bill.case_title}
                      </Link>
                    </Td>
                    <Td className="max-w-[160px] truncate text-ink-muted">{bill.case_client_name}</Td>
                    <Td className="text-ink-muted">{bill.custom_type_label ?? '—'}</Td>
                    <Td className="text-ink-muted">
                      {users.find((u) => u.id === bill.associate_id)?.full_name ?? '—'}
                    </Td>
                    <Td className="text-ink-muted">{bill.due_stage ?? '—'}</Td>
                    <Td className="tabular">
                      {bill.amount != null ? `₹${bill.amount.toFixed(2)}` : '—'}
                    </Td>
                    <Td>
                      <FlowDirectionBadge direction={bill.flow_direction} />
                    </Td>
                    <Td>
                      <BillStatusBadge status={bill.status} />
                    </Td>
                    <Td>
                      <Link
                        to={`/bills/${bill.id}/thread`}
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Open chat"
                        className="grid size-8 place-items-center rounded-control text-ink-muted hover:bg-surface-muted hover:text-brand"
                      >
                        <MessageSquare className="size-4" />
                      </Link>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableWrap>

          {/* Phone/tablet: labeled card list - a table's columns don't fit below lg
              without either clipping or a scroll users have to discover. */}
          <div className="divide-y divide-border rounded-card border border-border bg-surface lg:hidden">
            {bills.map((bill) => (
              <div
                key={bill.id}
                onClick={() => setViewingBill(bill)}
                className="flex cursor-pointer flex-col gap-3 px-4 py-3 transition-colors hover:bg-surface-muted"
              >
                <div className="flex min-w-0 items-start gap-4">
                  <span className="hidden size-11 shrink-0 place-items-center rounded-control bg-brand-soft text-brand">
                    <IndianRupee className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/cases/${bill.case_id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="block truncate text-sm font-semibold text-ink hover:underline"
                    >
                      {bill.case_title}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <FlowDirectionBadge direction={bill.flow_direction} />
                      <BillStatusBadge status={bill.status} />
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
                      <div className="min-w-0">
                        <p className="type-label text-[10px] text-ink-faint">Client</p>
                        <p className="mt-0.5 truncate text-xs text-ink-muted">{bill.case_client_name}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="type-label text-[10px] text-ink-faint">Client POC</p>
                        <p className="mt-0.5 truncate text-xs text-ink-muted">
                          {users.find((u) => u.id === bill.associate_id)?.full_name ?? '—'}
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
                <Link
                  to={`/bills/${bill.id}/thread`}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Open chat"
                  className="grid size-9 shrink-0 place-items-center self-end rounded-control text-ink-muted hover:bg-surface-muted hover:text-brand"
                >
                  <MessageSquare className="size-4" />
                </Link>
              </div>
            ))}
          </div>
        </>
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
