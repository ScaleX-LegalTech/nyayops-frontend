import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, MessageSquarePlus, Pencil, Trash2 } from 'lucide-react'
import {
  addCaseComment,
  deleteCase,
  getCase,
  getCaseTransitions,
  updateCaseStatus,
} from '@/lib/api/cases'
import { invalidateCaseScopes, qk } from '@/lib/queryKeys'
import type { CaseStatus } from '@/types'
import { formatDate, formatDateTime, humanize } from '@/lib/format'
import { useUsers } from '@/lib/useUsers'
import { useMutationWithToast } from '@/lib/useMutationWithToast'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Select, Textarea } from '@/components/ui/Field'
import { PriorityBadge, StatusBadge } from '@/components/ui/Badge'
import { Dialog } from '@/components/ui/Dialog'
import { ErrorState, LoadingState } from '@/components/ui/Feedback'
import { EditCaseDialog } from './EditCaseDialog'

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value || '—'}</dd>
    </div>
  )
}

export default function CaseDetailPage() {
  const { caseId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { nameOf } = useUsers()

  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [nextStatus, setNextStatus] = useState<CaseStatus | ''>('')
  const [statusComment, setStatusComment] = useState('')
  const [comment, setComment] = useState('')

  const { data: c, isLoading, isError, error, refetch } = useQuery({
    queryKey: qk.caseDetail(caseId),
    queryFn: () => getCase(caseId),
  })

  const { data: transitions } = useQuery({
    queryKey: qk.caseTransitions,
    queryFn: getCaseTransitions,
  })

  function invalidate() {
    invalidateCaseScopes(queryClient)
    queryClient.invalidateQueries({ queryKey: qk.caseDetail(caseId) })
  }

  const statusMutation = useMutationWithToast({
    mutationFn: () => updateCaseStatus(caseId, nextStatus as CaseStatus, statusComment || undefined),
    onSuccess: () => {
      invalidate()
      toast('Status updated.', 'success')
      setNextStatus('')
      setStatusComment('')
    },
    errorFallback: 'Could not update status.',
  })

  const commentMutation = useMutationWithToast({
    mutationFn: () => addCaseComment(caseId, comment),
    onSuccess: () => {
      invalidate()
      setComment('')
      toast('Comment added.', 'success')
    },
    errorFallback: 'Could not add comment.',
  })

  const deleteMutation = useMutationWithToast({
    mutationFn: () => deleteCase(caseId),
    onSuccess: () => {
      invalidate()
      toast('Case deleted.', 'success')
      navigate('/cases')
    },
    errorFallback: 'Delete failed.',
  })

  if (isLoading) return <LoadingState />
  if (isError || !c) return <ErrorState error={error} onRetry={refetch} />

  const allowed = transitions?.[c.status] ?? []

  return (
    <div className="animate-rise">
      <Link
        to="/cases"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Cases
      </Link>

      <PageHeader
        title={c.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={c.status} />
            <PriorityBadge priority={c.priority} />
            <span className="text-ink-faint">·</span>
            <span>{c.client_name}</span>
          </span>
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Pencil className="size-4" /> Edit
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="size-4 text-danger" />
            </Button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Details" />
            <CardBody className="border-t border-border">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                <Detail label="Case type" value={c.case_type} />
                <Detail label="Court" value={c.court_jurisdiction} />
                <Detail label="Region" value={c.region} />
                <Detail label="Filing date" value={formatDate(c.filing_date)} />
                <Detail label="Hearing date" value={formatDate(c.hearing_date)} />
                <Detail label="Created" value={formatDate(c.created_at)} />
                <Detail
                  label="Assignees"
                  value={
                    c.assigned_user_ids.length === 0
                      ? '—'
                      : c.assigned_user_ids.map(nameOf).join(', ')
                  }
                />
              </dl>
              {c.description && (
                <div className="mt-5 border-t border-border pt-4">
                  <p className="text-xs uppercase tracking-wide text-ink-faint">Description</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink">{c.description}</p>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Activity & comments"
              description={`${c.comments.length} comment${c.comments.length === 1 ? '' : 's'}`}
            />
            <CardBody className="border-t border-border">
              <ul className="space-y-3">
                {c.comments.length === 0 && (
                  <li className="text-sm text-ink-muted">No comments yet.</li>
                )}
                {c.comments.map((text, i) => (
                  <li
                    key={i}
                    className="rounded-control bg-surface-muted px-3.5 py-2.5 text-sm text-ink"
                  >
                    {text}
                  </li>
                ))}
              </ul>
              <form
                onSubmit={(e: FormEvent) => {
                  e.preventDefault()
                  if (comment.trim()) commentMutation.mutate()
                }}
                className="mt-4 space-y-2"
              >
                <Textarea
                  placeholder="Add a comment…"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                />
                <Button
                  type="submit"
                  size="sm"
                  loading={commentMutation.isPending}
                  disabled={!comment.trim()}
                >
                  <MessageSquarePlus className="size-4" /> Comment
                </Button>
              </form>
            </CardBody>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader title="Move status" description="Valid transitions from the current state" />
          <CardBody className="space-y-3 border-t border-border">
            {allowed.length === 0 ? (
              <p className="text-sm text-ink-muted">
                This case is <span className="font-medium">{humanize(c.status)}</span> — no further
                transitions.
              </p>
            ) : (
              <form
                onSubmit={(e: FormEvent) => {
                  e.preventDefault()
                  if (nextStatus) statusMutation.mutate()
                }}
                className="space-y-3"
              >
                <Field label="New status">
                  <Select
                    value={nextStatus}
                    onChange={(e) => setNextStatus(e.target.value as CaseStatus)}
                  >
                    <option value="">Select…</option>
                    {allowed.map((s) => (
                      <option key={s} value={s}>
                        {humanize(s)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Comment" hint="Optional, recorded with the transition.">
                  <Textarea
                    value={statusComment}
                    onChange={(e) => setStatusComment(e.target.value)}
                    rows={2}
                  />
                </Field>
                <Button
                  type="submit"
                  className="w-full justify-center"
                  loading={statusMutation.isPending}
                  disabled={!nextStatus}
                >
                  Update status
                </Button>
              </form>
            )}
          </CardBody>
        </Card>
      </div>

      {editing && <EditCaseDialog open onClose={() => setEditing(false)} caseRecord={c} />}

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete case"
        description="This soft-deletes the case. It can be restored by an administrator."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">
          Delete <span className="font-medium text-ink">{c.title}</span>? Updated{' '}
          {formatDateTime(c.created_at)}.
        </p>
      </Dialog>
    </div>
  )
}
