import { useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Archive,
  Briefcase,
  CalendarDays,
  CheckSquare,
  ChevronRight,
  Landmark,
  MapPin,
  Plus,
  RotateCcw,
  Scale,
  Search,
  Trash2,
  User,
  UserCheck,
  UserPlus,
} from 'lucide-react'
import { hardDeleteCase, listCases, listDeletedCases, restoreCase } from '@/lib/api/cases'
import { listBranches } from '@/lib/api/admin'
import { invalidateCaseScopes, qk } from '@/lib/queryKeys'
import { CASE_STATUSES, type Case, type CaseStatus } from '@/types'
import { courtLabel, formatDate, humanize } from '@/lib/format'
import { useAuth } from '@/auth/AuthContext'
import { usePermissions } from '@/lib/usePermissions'
import { useMutationWithToast } from '@/lib/useMutationWithToast'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { Dialog } from '@/components/ui/Dialog'
import { PriorityBadge, StatusBadge } from '@/components/ui/Badge'
import { TableWrap } from '@/components/ui/Table'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/Feedback'
import { CaseWizardDialog } from './CaseWizardDialog'
import { AssignDialog } from './AssignDialog'

const SORT_OPTIONS = [
  { value: 'hearing_asc', label: 'Hearing date: soonest first' },
  { value: 'hearing_desc', label: 'Hearing date: latest first' },
  { value: 'priority', label: 'Priority: highest first' },
  { value: 'created_desc', label: 'Recently created' },
] as const
type SortBy = (typeof SORT_OPTIONS)[number]['value']

const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 }

function sortCases(cases: Case[], sortBy: SortBy): Case[] {
  const list = [...cases]
  switch (sortBy) {
    case 'hearing_asc':
      return list.sort((a, b) => (a.hearing_date ?? '9999').localeCompare(b.hearing_date ?? '9999'))
    case 'hearing_desc':
      return list.sort((a, b) => (b.hearing_date ?? '0000').localeCompare(a.hearing_date ?? '0000'))
    case 'priority':
      return list.sort(
        (a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9),
      )
    case 'created_desc':
      return list.sort((a, b) => b.created_at.localeCompare(a.created_at))
  }
}

const LONG_PRESS_MS = 500

export default function CasesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
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
  const [sortBy, setSortBy] = useState<SortBy>('created_desc')
  const [creating, setCreating] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [viewingDeleted, setViewingDeleted] = useState(false)
  const [purging, setPurging] = useState<{ id: string; title: string } | null>(null)
  const longPressTimer = useRef<number | null>(null)

  const filters = useMemo(
    () => ({ query: search || undefined, status: status || undefined }),
    [search, status],
  )
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: qk.cases(filters),
    queryFn: () => listCases(filters),
  })

  const cases = useMemo(() => data ?? [], [data])
  const sortedCases = useMemo(() => sortCases(cases, sortBy), [cases, sortBy])
  const allSelected = cases.length > 0 && selected.length === cases.length

  function enterSelection(id: string) {
    setSelectionMode(true)
    setSelected((s) => (s.includes(id) ? s : [...s, id]))
  }

  function exitSelection() {
    setSelectionMode(false)
    setSelected([])
  }

  function clearLongPress() {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  function onRowPointerDown(e: ReactPointerEvent, id: string) {
    if (e.pointerType !== 'touch') return
    clearLongPress()
    longPressTimer.current = window.setTimeout(() => enterSelection(id), LONG_PRESS_MS)
  }

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
            <Button
              variant="secondary"
              onClick={() => (selectionMode ? exitSelection() : setSelectionMode(true))}
            >
              <CheckSquare className="size-4" /> {selectionMode ? 'Cancel select' : 'Select'}
            </Button>
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
        <Select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          className="sm:w-56"
          aria-label="Sort by"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              Sort: {o.label}
            </option>
          ))}
        </Select>
      </div>

      {selectionMode && (
        <div className="mb-3 flex items-center justify-between rounded-card border border-brand/20 bg-brand-soft px-4 py-2.5">
          <span className="text-sm font-medium text-brand-strong">
            {selected.length} selected
          </span>
          <div className="flex gap-2">
            {hasPermission('cases', 'assign') && selected.length > 0 && (
              <Button size="sm" onClick={() => setAssigning(true)}>
                <UserPlus className="size-4" /> Assign
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={exitSelection}>
              Done
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
              hasPermission('cases', 'create') && (
                <Button onClick={() => setCreating(true)}>
                  <Plus className="size-4" /> New case
                </Button>
              )
            }
          />
        </TableWrap>
      ) : (
        <div>
          <div className="flex items-center gap-3 px-1 pb-2.5">
            {selectionMode && (
              <input
                type="checkbox"
                aria-label="Select all"
                checked={allSelected}
                onChange={(e) => setSelected(e.target.checked ? cases.map((c) => c.id) : [])}
              />
            )}
            <span className="type-label text-ink-faint">
              {cases.length} case{cases.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="space-y-2.5">
            {sortedCases.map((c) => {
              const [firstAssigneeName, ...restAssignees] = c.assignee_names
              return (
                <div
                  key={c.id}
                  onClick={() => (selectionMode ? toggle(c.id) : navigate(`/cases/${c.id}`))}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    enterSelection(c.id)
                  }}
                  onPointerDown={(e) => onRowPointerDown(e, c.id)}
                  onPointerUp={clearLongPress}
                  onPointerLeave={clearLongPress}
                  onPointerCancel={clearLongPress}
                  className="flex cursor-pointer items-center gap-4 rounded-card border border-border bg-surface px-4 py-3.5 transition-colors hover:border-brand/30 hover:bg-surface-muted"
                >
                  {selectionMode ? (
                    <input
                      type="checkbox"
                      aria-label={`Select ${c.title}`}
                      checked={selected.includes(c.id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggle(c.id)}
                    />
                  ) : (
                    <span className="grid size-11 shrink-0 place-items-center rounded-control bg-brand-soft text-brand">
                      <Scale className="size-5" aria-hidden />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="type-mono block text-xs text-ink-faint">{c.case_code}</span>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Link
                        to={`/cases/${c.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="truncate text-sm font-semibold text-ink outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand"
                      >
                        {c.title}
                      </Link>
                      <StatusBadge status={c.status} />
                      <span className="text-ink-faint">·</span>
                      <PriorityBadge priority={c.priority} />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
                      <span className="inline-flex items-center gap-1">
                        <User className="size-3.5 shrink-0 text-ink-faint" aria-hidden />
                        {c.client_name}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Landmark className="size-3.5 shrink-0 text-ink-faint" aria-hidden />
                        {courtLabel(c.court_jurisdiction)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3.5 shrink-0 text-ink-faint" aria-hidden />
                        {c.region ?? branchName(c.branch_id)}
                      </span>
                    </div>
                    <p className="mt-1 flex items-center gap-1 text-xs text-ink-muted">
                      <UserCheck className="size-3.5 shrink-0 text-ink-faint" aria-hidden />
                      {firstAssigneeName ? (
                        <span className="truncate">
                          {firstAssigneeName}
                          {restAssignees.length > 0 && (
                            <span className="text-ink-faint"> +{restAssignees.length}</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-ink-faint">Unassigned</span>
                      )}
                    </p>
                  </div>
                  <div className="shrink-0 space-y-1.5 text-right">
                    <div>
                      <p className="inline-flex items-center gap-1 text-xs font-semibold tabular text-ink">
                        <CalendarDays className="size-3 shrink-0 text-ink-faint" aria-hidden />
                        {formatDate(c.hearing_date)}
                      </p>
                      <p className="type-label mt-0.5 text-[10px] text-ink-faint">Hearing</p>
                    </div>
                    <div>
                      <p className="inline-flex items-center gap-1 text-xs tabular text-ink-muted">
                        <CalendarDays className="size-3 shrink-0 text-ink-faint" aria-hidden />
                        {formatDate(c.created_at)}
                      </p>
                      <p className="type-label mt-0.5 text-[10px] text-ink-faint">Created</p>
                    </div>
                  </div>
                  <ChevronRight className="hidden size-4 shrink-0 text-ink-faint sm:block" aria-hidden />
                </div>
              )
            })}
          </div>
        </div>
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
