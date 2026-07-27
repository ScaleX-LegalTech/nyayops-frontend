import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { addBillComment, deleteBillComment, getBill } from '@/lib/api/bills'
import { invalidateCaseScopes, qk } from '@/lib/queryKeys'
import { useAuth } from '@/auth/AuthContext'
import { useUsers } from '@/lib/useUsers'
import { usePermissions } from '@/lib/usePermissions'
import { ErrorState, LoadingState } from '@/components/ui/Feedback'
import { ThreadPanel } from '@/features/threads/ThreadPanel'

/** Bill thread reuses the exact same reply/delete/attribution/realtime chat
 * infrastructure as the case thread (see ThreadPanel) - scoped to only the bill's
 * associate/raiser plus admins, per ThreadService._enforce_can_comment_bill. No
 * @mention picker yet (no bill-scoped "visible people" endpoint exists, unlike
 * useCasePeople for cases) - mentions still work server-side if a caller somehow
 * supplies user ids, there's just no autocomplete for it here. */
export default function BillThreadPage() {
  const { billId = '' } = useParams()
  const queryClient = useQueryClient()
  const { nameOf } = useUsers()
  const { hasPermission } = usePermissions()
  const { user } = useAuth()

  const { data: bill, isLoading, isError, error, refetch } = useQuery({
    queryKey: qk.billDetail(billId),
    queryFn: () => getBill(billId),
  })

  function invalidate() {
    invalidateCaseScopes(queryClient)
    queryClient.invalidateQueries({ queryKey: qk.billDetail(billId) })
  }

  if (isLoading) return <LoadingState />
  if (isError || !bill) return <ErrorState error={error} onRetry={refetch} />

  const currentUserId = user?.sub
  const canComment =
    hasPermission('bills', 'comment') ||
    bill.associate_id === currentUserId ||
    bill.raised_by === currentUserId

  return (
    <ThreadPanel
      title="Bill Thread"
      backLink={{ label: bill.custom_type_label ?? bill.case_title }}
      comments={bill.comments}
      people={[]}
      nameOf={nameOf}
      currentUserId={currentUserId}
      canComment={canComment}
      lockedMessage={bill.status === 'approved' ? 'This bill is closed — the thread is locked.' : undefined}
      uploadCaseId={bill.case_id}
      wsPath={`/bills/${billId}/thread/ws`}
      invalidate={invalidate}
      onSend={({ comment, mentionedUserIds, attachmentIds, replyToId }) =>
        addBillComment(billId, comment, mentionedUserIds, attachmentIds, replyToId)
      }
      onDelete={({ commentId, scope }) => deleteBillComment(billId, commentId, scope)}
    />
  )
}
