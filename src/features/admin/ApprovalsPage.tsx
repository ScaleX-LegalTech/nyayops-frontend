import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Check, ShieldCheck, X } from 'lucide-react'
import {
  approvePendingApproval,
  completePendingApproval,
  listPendingApprovals,
  rejectPendingApproval,
} from '@/lib/api/assistantApprovals'
import { executeApprovedAction } from '@/features/ask-nyayops/pendingActionHandlers'
import { describeAskNyayOpsError } from '@/lib/api/askNyayOps'
import { qk } from '@/lib/queryKeys'
import { humanize } from '@/lib/format'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/Feedback'
import { useToast } from '@/components/ui/Toast'
import type { PendingApproval } from '@/types'

/** The second-approver queue for the widest-radius T3 assistant actions
 * (implementation plan §7.1/§7.5: organization.freeze, branch.delete,
 * role.delete) - the backend already excludes the current user's own
 * proposals, so everything here is by definition someone else's request. */
export default function ApprovalsPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [busyId, setBusyId] = useState<string | null>(null)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: qk.pendingApprovals,
    queryFn: listPendingApprovals,
  })

  async function handleApprove(approval: PendingApproval) {
    setBusyId(approval.id)
    try {
      await approvePendingApproval(approval.id)
      await executeApprovedAction(approval)
      await completePendingApproval(approval.id)
      queryClient.invalidateQueries({ queryKey: qk.pendingApprovals })
      toast('Approved and completed.', 'success')
    } catch (err) {
      toast(describeAskNyayOpsError(err), 'error')
      queryClient.invalidateQueries({ queryKey: qk.pendingApprovals })
    } finally {
      setBusyId(null)
    }
  }

  async function handleReject(approval: PendingApproval) {
    setBusyId(approval.id)
    try {
      await rejectPendingApproval(approval.id)
      queryClient.invalidateQueries({ queryKey: qk.pendingApprovals })
      toast('Rejected.', 'success')
    } catch (err) {
      toast(describeAskNyayOpsError(err), 'error')
    } finally {
      setBusyId(null)
    }
  }

  const approvals = data ?? []

  return (
    <div className="animate-rise">
      <PageHeader
        title="Approvals"
        description="Org-wide or branch-wide changes another admin drafted via Ask NyayOps - these need a second admin's sign-off before they happen."
      />

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : approvals.length === 0 ? (
        <Card>
          <EmptyState
            icon={ShieldCheck}
            title="Nothing awaiting your approval"
            description="Requests from other admins for organization freezes, branch deletions, or role deletions will show up here."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {approvals.map((approval) => (
            <Card key={approval.id}>
              <CardHeader
                title={humanize(approval.action_type)}
                description={`Requested by ${approval.proposed_by_name}`}
              />
              <CardBody className="flex flex-col gap-3">
                <p className="text-sm text-ink">{approval.summary}</p>
                <p className="flex items-center gap-1.5 text-xs font-medium text-danger">
                  <AlertTriangle className="size-3.5 shrink-0" /> Affects:{' '}
                  {approval.would_affect.map((s) => s.split(':')[0]).join(', ') ||
                    'the organization'}
                </p>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={busyId === approval.id}
                    onClick={() => handleReject(approval)}
                  >
                    <X className="size-4" /> Reject
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    loading={busyId === approval.id}
                    onClick={() => handleApprove(approval)}
                  >
                    <Check className="size-4" /> Approve
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
