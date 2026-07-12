import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, Briefcase, Plus, RotateCcw, Search, Trash2, UserPlus } from 'lucide-react'
import { hardDeleteCase, listCases, listDeletedCases, restoreCase } from '@/lib/api/cases'
import { listBranches } from '@/lib/api/admin'
import { invalidateCaseScopes, qk } from '@/lib/queryKeys'
import { CASE_STATUSES, type CaseStatus } from '@/types'
import { courtLabel, formatDate, humanize } from '@/lib/format'
import { useUsers } from '@/lib/useUsers'
import { useAuth } from '@/auth/AuthContext'
import { usePermissions } from '@/lib/usePermissions'
import { useMutationWithToast } from '@/lib/useMutationWithToast'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { Dialog } from '@/components/ui/Dialog'
import { PriorityBadge, StatusBadge } from '@/components/ui/Badge'
import { Table, TBody, Td, Th, THead, TableWrap, Tr } from '@/components/ui/Table'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/Feedback'
import { CaseWizardDialog } from './CaseWizardDialog'
import { AssignDialog } from './AssignDialog'

export default function CasesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { nameOf } = useUsers()
  const { isManagingDirector } = useAuth()
  const { hasPermission } = usePermissions()
  const branchesQuery = useQuery({
    queryKey: qk.branches,
    queryFn: listBranches,
    enabled: isManagingDirector,
  })
  const branchName = (id: string | null) =>
    id ? branchesQuery.data?.find((b) => b.id === id)?.name ?? id.slice(0, 6) : 'Org-wide'
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<CaseStatus | ''>('')
  const [creating, setCreating] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [viewingDeleted, setViewingDeleted] = useState(false)
  const [purging, setPurging] = useState<{ id: string; title: string } | null>(null)

  const filters = useMemo(
    () => ({ query: search || undefined, status: status || undefined }),
    [search, status],
  )
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: qk.cases(filters),
    queryFn: () => listCases(filters),
  })

  const cases = data ?? []
  const allSelected = cases.length > 0 && selected.length === cases.length

  const deletedQuery = useQuery({
    queryKey: qk.deletedCases,
    queryFn: listDeletedCases,
    enabled: viewingDeleted,
  })

  const restoreMutation = useMutationWithToast({
    mutationFn: (caseId: string) => restoreCase(caseId),
    onSuccess: () => {
      invalidateCaseScopes(queryClient)
      queryClient.invalidateQueries({ queryKey: qk.deletedCases })
      toast('Case restored.', 'success')
    },
    errorFallback: 'Restore failed.',
  })

  const hardDeleteMutation = useMutationWithToast({
    mutationFn: (caseId: string) => hardDeleteCase(caseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.deletedCases })
      toast('Case permanently deleted.', 'success')
      setPurging(null)
    },
    errorFallback: 'Could not permanently delete this case.',
  })

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  return (
    <div className="animate-rise">
      <PageHeader
        title="Cases"
        description="Every matter across your firm."
        actions={
          <>
            {hasPermission('cases', 'delete') && (
              <Button variant="secondary" onClick={() => setViewingDeleted(true)}>
                <Archive className="size-4" /> Deleted cases
              </Button>
            )}
            {hasPermission('cases', 'create') && (
              <Button onClick={() => setCreating(true)}>
                <Plus className="size-4" /> New case
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
          <Input
            placeholder="Search by title or client…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as CaseStatus | '')}
          className="sm:w-52"
        >
          <option value="">All statuses</option>
          {CASE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {humanize(s)}
            </option>
          ))}
        </Select>
      </div>

      {selected.length > 0 && (
        <div className="mb-3 flex items-center justify-between rounded-card border border-brand/20 bg-brand-soft px-4 py-2.5">
          <span className="text-sm font-medium text-brand-strong">
            {selected.length} selected
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setSelected([])}>
              Clear
            </Button>
            {hasPermission('cases', 'assign') && (
              <Button size="sm" onClick={() => setAssigning(true)}>
                <UserPlus className="size-4" /> Assign
              </Button>
            )}
          </div>
        </div>
      )}

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : cases.length === 0 ? (
        <TableWrap>
          <EmptyState
            icon={Briefcase}
            title="No cases found"
            description="Adjust your filters or create the first case."
            action={
              hasPermission('cases', 'create') && (
                <Button onClick={() => setCreating(true)}>
                  <Plus className="size-4" /> New case
                </Button>
              )
            }
          />
        </TableWrap>
      ) : (
        <TableWrap>
          <Table>
            <THead>
              <Tr>
                <Th className="w-10">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={allSelected}
                    onChange={(e) => setSelected(e.target.checked ? cases.map((c) => c.id) : [])}
                  />
                </Th>
                <Th>Title</Th>
                {isManagingDirector && <Th>Branch</Th>}
                <Th>Client</Th>
                <Th>Court</Th>
                <Th>Status</Th>
                <Th>Priority</Th>
                <Th>Assignees</Th>
                <Th>Hearing</Th>
              </Tr>
            </THead>
            <TBody>
              {cases.map((c) => (
                <Tr
                  key={c.id}
                  className="cursor-pointer hover:bg-surface-muted"
                  onClick={() => navigate(`/cases/${c.id}`)}
                >
                  <Td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${c.title}`}
                      checked={selected.includes(c.id)}
                      onChange={() => toggle(c.id)}
                    />
                  </Td>
                  <Td className="font-medium text-ink">
                    <Link
                      to={`/cases/${c.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded-control outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      {c.title}
                    </Link>
                  </Td>
                  {isManagingDirector && (
                    <Td className="text-ink-muted">{branchName(c.branch_id)}</Td>
                  )}
                  <Td className="text-ink-muted">{c.client_name}</Td>
                  <Td className="text-ink-muted">{courtLabel(c.court_jurisdiction)}</Td>
                  <Td>
                    <StatusBadge status={c.status} />
                  </Td>
                  <Td>
                    <PriorityBadge priority={c.priority} />
                  </Td>
                  <Td className="text-ink-muted">
                    {c.assigned_user_ids.length === 0
                      ? '—'
                      : c.assigned_user_ids.map(nameOf).join(', ')}
                  </Td>
                  <Td className="text-ink-muted tabular">{formatDate(c.hearing_date)}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      )}

      <CaseWizardDialog
        open={creating}
        onClose={() => setCreating(false)}
        onFinished={(caseId) => navigate(`/cases/${caseId}`)}
      />
      <AssignDialog
        open={assigning}
        onClose={() => setAssigning(false)}
        caseIds={selected}
        onDone={() => setSelected([])}
      />

      <Dialog
        open={viewingDeleted}
        onClose={() => setViewingDeleted(false)}
        title="Deleted cases"
        description="Soft-deleted cases. Restore to bring one back."
        size="lg"
      >
        {deletedQuery.isLoading ? (
          <LoadingState />
        ) : deletedQuery.isError ? (
          <ErrorState error={deletedQuery.error} onRetry={deletedQuery.refetch} />
        ) : !deletedQuery.data || deletedQuery.data.length === 0 ? (
          <p className="text-sm text-ink-muted">No deleted cases.</p>
        ) : (
          <ul className="space-y-2">
            {deletedQuery.data.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-control bg-surface-muted px-3.5 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{c.title}</p>
                  <p className="truncate text-xs text-ink-muted">{c.client_name}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={restoreMutation.isPending}
                    onClick={() => restoreMutation.mutate(c.id)}
                  >
                    <RotateCcw className="size-4" /> Restore
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Permanently delete ${c.title}`}
                    onClick={() => setPurging({ id: c.id, title: c.title })}
                  >
                    <Trash2 className="size-4 text-danger" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Dialog>

      <Dialog
        open={purging !== null}
        onClose={() => setPurging(null)}
        title="Permanently delete case"
        description="This cannot be undone - the case, its parties, history, and documents will be gone for good."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPurging(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={hardDeleteMutation.isPending}
              onClick={() => purging && hardDeleteMutation.mutate(purging.id)}
            >
              Delete permanently
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">
          Permanently delete <span className="font-medium text-ink">{purging?.title}</span>?
        </p>
      </Dialog>
    </div>
  )
}
