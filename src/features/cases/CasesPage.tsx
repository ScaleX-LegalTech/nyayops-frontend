import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Briefcase, Plus, Search, UserPlus } from 'lucide-react'
import { listCases } from '@/lib/api/cases'
import { listBranches } from '@/lib/api/admin'
import { qk } from '@/lib/queryKeys'
import { CASE_STATUSES, type CaseStatus } from '@/types'
import { formatDate, humanize } from '@/lib/format'
import { useUsers } from '@/lib/useUsers'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { PriorityBadge, StatusBadge } from '@/components/ui/Badge'
import { Table, TBody, Td, Th, THead, TableWrap, Tr } from '@/components/ui/Table'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/Feedback'
import { CaseFormDialog } from './CaseFormDialog'
import { AssignDialog } from './AssignDialog'

export default function CasesPage() {
  const navigate = useNavigate()
  const { nameOf } = useUsers()
  const { isManagingDirector } = useAuth()
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

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  return (
    <div className="animate-rise">
      <PageHeader
        title="Cases"
        description="Every matter across your firm."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" /> New case
          </Button>
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
            <Button size="sm" onClick={() => setAssigning(true)}>
              <UserPlus className="size-4" /> Assign
            </Button>
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
              <Button onClick={() => setCreating(true)}>
                <Plus className="size-4" /> New case
              </Button>
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
                  <Td className="font-medium text-ink">{c.title}</Td>
                  {isManagingDirector && (
                    <Td className="text-ink-muted">{branchName(c.branch_id)}</Td>
                  )}
                  <Td className="text-ink-muted">{c.client_name}</Td>
                  <Td className="text-ink-muted">{c.court_jurisdiction}</Td>
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

      <CaseFormDialog open={creating} onClose={() => setCreating(false)} />
      <AssignDialog
        open={assigning}
        onClose={() => setAssigning(false)}
        caseIds={selected}
        onDone={() => setSelected([])}
      />
    </div>
  )
}
