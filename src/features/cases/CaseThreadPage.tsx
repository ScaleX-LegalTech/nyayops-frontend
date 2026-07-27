import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText } from 'lucide-react'
import { addCaseComment, deleteCaseComment, getCase } from '@/lib/api/cases'
import { listCaseActivity } from '@/lib/api/audit'
import { invalidateCaseScopes, qk } from '@/lib/queryKeys'
import { formatDateTime } from '@/lib/format'
import { ACTION_ICONS, describeActivity } from '@/lib/caseActivity'
import { useAuth } from '@/auth/AuthContext'
import { useUsers } from '@/lib/useUsers'
import { useCasePeople } from '@/lib/useCasePeople'
import { usePermissions } from '@/lib/usePermissions'
import { ErrorState, LoadingState } from '@/components/ui/Feedback'
import { ThreadPanel, type ThreadActivityItem } from '@/features/threads/ThreadPanel'

export default function CaseThreadPage() {
  const { caseId = '' } = useParams()
  const queryClient = useQueryClient()
  const { nameOf: globalNameOf } = useUsers()
  const { people, nameOf: caseNameOf } = useCasePeople(caseId)
  const nameOf = (id: string) => caseNameOf(id) ?? globalNameOf(id)
  const { hasPermission } = usePermissions()
  const { user } = useAuth()

  const { data: c, isLoading, isError, error, refetch } = useQuery({
    queryKey: qk.caseDetail(caseId),
    queryFn: () => getCase(caseId),
  })

  const { data: activity } = useQuery({
    queryKey: qk.caseActivity(caseId),
    queryFn: () => listCaseActivity(caseId),
    enabled: !!c,
  })

  function invalidate() {
    invalidateCaseScopes(queryClient)
    queryClient.invalidateQueries({ queryKey: qk.caseDetail(caseId) })
    queryClient.invalidateQueries({ queryKey: qk.caseActivity(caseId) })
  }

  if (isLoading) return <LoadingState />
  if (isError || !c) return <ErrorState error={error} onRetry={refetch} />

  const currentUserId = user?.sub
  const isAssignee = !!currentUserId && c.assigned_user_ids.includes(currentUserId)
  const isCreator = !!currentUserId && c.created_by === currentUserId
  const canComment = hasPermission('cases', 'comment') || isAssignee || isCreator

  const activityItems: ThreadActivityItem[] = (activity ?? [])
    .filter(
      (log) => log.action_type !== 'CASE_COMMENT_ADDED' && log.action_type !== 'CASE_COMMENT_DELETED',
    )
    .map((log) => {
      const Icon = ACTION_ICONS[log.action_type] ?? FileText
      return {
        id: log.id,
        ts: log.occurred_at,
        node: (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-muted px-3 py-1">
            <Icon className="size-3 shrink-0" />
            <span>
              <span className="font-medium text-ink-muted">{nameOf(log.actor_id)}</span>{' '}
              {describeActivity(log, nameOf)}
            </span>
            <span className="text-ink-faint">· {formatDateTime(log.occurred_at)}</span>
          </span>
        ),
      }
    })

  return (
    <ThreadPanel
      title="Case Thread"
      backLink={{ label: c.title }}
      comments={c.comments}
      activityItems={activityItems}
      people={people}
      nameOf={nameOf}
      currentUserId={currentUserId}
      canComment={canComment}
      lockedMessage={c.status === 'closed' ? 'This case is closed — the thread is locked.' : undefined}
      uploadCaseId={caseId}
      wsPath={`/review/${caseId}/thread/ws`}
      invalidate={invalidate}
      onSend={({ comment, mentionedUserIds, attachmentIds, replyToId }) =>
        addCaseComment(caseId, comment, mentionedUserIds, attachmentIds, replyToId)
      }
      onDelete={({ commentId, scope }) => deleteCaseComment(caseId, commentId, scope)}
    />
  )
}
