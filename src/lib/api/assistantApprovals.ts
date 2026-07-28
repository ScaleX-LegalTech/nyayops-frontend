import type { PendingAction, PendingApproval } from '@/types'
import { get, post } from './client'

/** The second-approver gate for the widest-radius T3 PendingActions
 * (implementation plan §7.1/§7.5: organization.freeze, branch.delete,
 * role.delete). Posted with the exact drafted PendingAction instead of the
 * real REST endpoint - a different org admin has to approve before anyone's
 * browser calls that real endpoint. */
export function proposePendingApproval(pendingAction: PendingAction): Promise<PendingApproval> {
  return post<PendingApproval>('/assistant/pending-approvals', {
    action_type: pendingAction.action_type,
    tier: pendingAction.tier,
    summary: pendingAction.summary,
    before_state: pendingAction.before_state,
    after_state: pendingAction.after_state,
    would_affect: pendingAction.would_affect,
    requires_role: pendingAction.requires_role,
    idempotency_key: pendingAction.idempotency_key,
  })
}

/** Every request awaiting a decision from someone other than the proposer -
 * the backend already excludes the current user's own proposals. */
export function listPendingApprovals(): Promise<PendingApproval[]> {
  return get<PendingApproval[]>('/assistant/pending-approvals')
}

export function approvePendingApproval(id: string): Promise<PendingApproval> {
  return post<PendingApproval>(`/assistant/pending-approvals/${id}/approve`, {})
}

export function rejectPendingApproval(id: string): Promise<PendingApproval> {
  return post<PendingApproval>(`/assistant/pending-approvals/${id}/reject`, {})
}

/** Called right after the approver's own browser calls the real REST endpoint
 * (setOrganizationFreeze/deleteBranch/deleteRole) so this row's status ends
 * at 'executed' instead of staying 'approved' forever. */
export function completePendingApproval(id: string): Promise<PendingApproval> {
  return post<PendingApproval>(`/assistant/pending-approvals/${id}/complete`, {})
}
