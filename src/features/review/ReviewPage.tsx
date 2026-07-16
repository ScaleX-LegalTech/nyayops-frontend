import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  CheckCircle2,
  ClipboardCheck,
  MessageSquare,
  PlayCircle,
  UserCog,
  XCircle,
} from 'lucide-react'
import {
  addCaseComment,
  approveCase,
  reassignCase,
  rejectCase,
  reviewQueue,
  updateCaseStatus,
} from '@/lib/api/cases'
import { invalidateCaseScopes, qk } from '@/lib/queryKeys'
import { formatDate } from '@/lib/format'
import { useMutationWithToast } from '@/lib/useMutationWithToast'
import { usePermissions } from '@/lib/usePermissions'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Textarea } from '@/components/ui/Field'
import { StatusBadge } from '@/components/ui/Badge'
import { Table, TBody, Td, Th, THead, TableWrap, Tr } from '@/components/ui/Table'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/Feedback'
import { UserMultiSelect } from '@/components/ui/UserMultiSelect'
import type { Case } from '@/types'

type Action = 'approve' | 'reject' | 'reassign' | 'comment'

const ACTION_META: Record<Action, { title: string; verb: string }> = {
  approve: { title: 'Approve case', verb: 'Approve' },
  reject: { title: 'Reject case', verb: 'Reject' },
  reassign: { title: 'Reassign case', verb: 'Reassign' },
  comment: { title: 'Add comment', verb: 'Comment' },
}

export default function ReviewPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { hasPermission } = usePermissions()
  const [active, setActive] = useState<{ case: Case; action: Action } | null>(null)
  const [text, setText] = useState('')
  const [assignees, setAssignees] = useState<string[]>([])

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: qk.reviewQueue,
    queryFn: reviewQueue,
  })

  const startReview = useMutationWithToast({
    mutationFn: (caseId: string) => updateCaseStatus(caseId, 'under_review'),
    onSuccess: () => {
      invalidateCaseScopes(queryClient)
      toast('Moved to review.', 'success')
    },
    errorFallback: 'Could not start review.',
  })

  function close() {
    setActive(null)
    setText('')
    setAssignees([])
  }

  const mutation = useMutationWithToast({
    mutationFn: async () => {
      if (!active) return
      const id = active.case.id
      switch (active.action) {
        case 'approve':
          return approveCase(id, text || undefined)
        case 'reject':
          return rejectCase(id, text)
        case 'reassign':
          return reassignCase(id, assignees, text || undefined)
        case 'comment':
          return addCaseComment(id, text)
      }
    },
    onSuccess: () => {
      invalidateCaseScopes(queryClient)
      toast('Done.', 'success')
      close()
    },
    errorFallback: 'Action failed.',
  })

  const cases = data ?? []
  const rejectNeedsComment = active?.action === 'reject' && !text.trim()
  const reassignNeedsUser = active?.action === 'reassign' && assignees.length === 0

  return (
    <div className="animate-rise">
      <PageHeader title="Review queue" description="Cases awaiting your decision." />

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : cases.length === 0 ? (
        <TableWrap>
          <EmptyState
            icon={ClipboardCheck}
            title="Queue is clear"
            description="No cases are waiting for review right now."
          />
        </TableWrap>
      ) : (
        <TableWrap>
          <Table>
            <THead>
              <Tr>
                <Th>Title</Th>
                <Th>Client</Th>
                <Th>Status</Th>
                <Th>Hearing</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {cases.map((c) => (
                <Tr key={c.id} className="hover:bg-surface-muted">
                  <Td className="font-medium">
                    <Link to={`/cases/${c.id}`} className="hover:text-brand">
                      {c.title}
                    </Link>
                  </Td>
                  <Td className="text-ink-muted">{c.client_name}</Td>
                  <Td>
                    <StatusBadge status={c.status} />
                  </Td>
                  <Td className="text-ink-muted tabular">{formatDate(c.hearing_date)}</Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      {c.status === 'ready_for_review' ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Start review"
                          aria-label="Start review"
                          loading={startReview.isPending}
                          onClick={() => startReview.mutate(c.id)}
                        >
                          <PlayCircle className="size-4 text-brand" />
                        </Button>
                      ) : (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            title={ACTION_META.approve.title}
                            aria-label={ACTION_META.approve.title}
                            onClick={() => setActive({ case: c, action: 'approve' })}
                          >
                            <CheckCircle2 className="size-4 text-success" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title={ACTION_META.reject.title}
                            aria-label={ACTION_META.reject.title}
                            onClick={() => setActive({ case: c, action: 'reject' })}
                          >
                            <XCircle className="size-4 text-danger" />
                          </Button>
                        </>
                      )}
                      {hasPermission('cases', 'assign') && (
                        <Button
                          size="icon"
                          variant="ghost"
                          title={ACTION_META.reassign.title}
                          aria-label={ACTION_META.reassign.title}
                          onClick={() => setActive({ case: c, action: 'reassign' })}
                        >
                          <UserCog className="size-4 text-ink-muted" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        title={ACTION_META.comment.title}
                        aria-label={ACTION_META.comment.title}
                        onClick={() => setActive({ case: c, action: 'comment' })}
                      >
                        <MessageSquare className="size-4 text-ink-muted" />
                      </Button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      )}

      <Dialog
        open={!!active}
        onClose={close}
        title={active ? ACTION_META[active.action].title : ''}
        description={active?.case.title}
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button
              variant={active?.action === 'reject' ? 'danger' : 'primary'}
              loading={mutation.isPending}
              disabled={rejectNeedsComment || reassignNeedsUser}
              onClick={() => mutation.mutate()}
            >
              {active ? ACTION_META[active.action].verb : ''}
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            if (!rejectNeedsComment && !reassignNeedsUser) mutation.mutate()
          }}
          className="space-y-4"
        >
          {active?.action === 'reassign' && (
            <Field label="Assign to" error={reassignNeedsUser ? 'Select at least one user.' : undefined}>
              <UserMultiSelect
                caseIds={active ? [active.case.id] : []}
                selected={assignees}
                onChange={setAssignees}
              />
            </Field>
          )}
          <Field
            label={active?.action === 'comment' ? 'Comment' : 'Comment'}
            required={active?.action === 'reject'}
            error={rejectNeedsComment ? 'A comment is required to reject.' : undefined}
            hint={
              active?.action === 'approve'
                ? 'Optional note recorded with the approval.'
                : undefined
            }
          >
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} autoFocus />
          </Field>
        </form>
      </Dialog>
    </div>
  )
}
