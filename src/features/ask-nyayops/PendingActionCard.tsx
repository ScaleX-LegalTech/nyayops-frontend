import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowRight, Check, Pencil, X } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Capsule, type Tone } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/auth/AuthContext'
import { cn } from '@/lib/cn'
import { humanize } from '@/lib/format'
import { qk } from '@/lib/queryKeys'
import { describeAskNyayOpsError, recordAssistantAuditEvent } from '@/lib/api/askNyayOps'
import {
  addCaseComment,
  approveCase,
  assignCase,
  createCase,
  linkCaseCnr,
  reassignCase,
  refreshCaseCnr,
  rejectCase,
  updateCaseLifecycleStage,
  updateCaseStatus,
} from '@/lib/api/cases'
import { markBillContacted, raiseBill, rejectBill, uploadBillProof } from '@/lib/api/bills'
import { createPaymentMilestone } from '@/lib/api/payments'
import { deleteDocument, rollbackVersion } from '@/lib/api/documents'
import { clearAllNotifications, markNotificationRead } from '@/lib/api/notifications'
import { raiseIssue, resolveIssue } from '@/lib/api/issues'
import {
  assignRoles,
  createBranch,
  createRole,
  deleteBranch,
  deleteRole,
  deleteUser,
  freezeBranch,
  inviteUser,
  listBranches,
  listRoles,
  updateBranch,
  updateRole,
} from '@/lib/api/admin'
import { updateBranchAdminPermissions } from '@/lib/api/branchAdmins'
import { setOrganizationFreeze } from '@/lib/api/organization'
import { createBillType } from '@/lib/api/billTypes'
import type {
  BillCaseTypeCategory,
  BillFlowDirection,
  BillPaymentDestinationType,
  CaseLifecycleStage,
  CaseStatus,
  Permission,
  PendingAction,
} from '@/types'

/** after_state's permissions entries only ever carry {resource, action, scope}
 * (PermissionRead.model_dump() on the backend) - the frontend Permission type
 * carries two extra display-only fields no draft_* tool ever sets. */
function toPermissions(raw: unknown): Permission[] {
  return (raw as { resource: string; action: string; scope: string }[]).map((p) => ({
    ...p,
    condition: null,
    description: null,
  }))
}

interface PendingActionCardProps {
  pendingAction: PendingAction
  /** Called once the card is resolved (confirmed, discarded, or navigated
   * away from) so the chat can stop rendering it. */
  onResolved: () => void
}

interface ActionHandler {
  label: string
  irreversible?: boolean
  /** Calls the real, existing REST endpoint directly - the assistant only
   * ever prepared a preview, this is what actually performs the change,
   * entirely outside the chat's tool-calling loop. */
  execute?: (pa: PendingAction) => Promise<unknown>
  /** For the two document actions that need real file bytes the chat never
   * has - "confirming" means taking the user to where they can pick a file,
   * not calling an endpoint blind. */
  navigateTo?: (pa: PendingAction) => string
}

function idFromWouldAffect(pa: PendingAction, prefix: string): string {
  const entry = pa.would_affect.find((s) => s.startsWith(`${prefix}:`))
  const id = entry?.slice(prefix.length + 1)
  if (!id) throw new Error(`Missing ${prefix} id on this action.`)
  return id
}

/** action_type -> how to actually perform it once the user confirms. Every
 * handler here covers a tool the Case & Billing agent can draft (implementation
 * plan Phases 1-9) - case.comment is handled separately below since it needs
 * an editable draft, not a blind re-send of after_state. */
const HANDLERS: Record<string, ActionHandler> = {
  'case.create': {
    label: 'Create case',
    execute: (pa) =>
      createCase({
        title: pa.after_state.title as string,
        client_name: pa.after_state.client_name as string,
        description: pa.after_state.description as string | null | undefined,
        priority: pa.after_state.priority as string | undefined,
        branch_id: pa.after_state.branch_id as string | null | undefined,
      }),
  },
  'case.assign': {
    label: 'Assign case',
    execute: (pa) =>
      assignCase(idFromWouldAffect(pa, 'case'), pa.after_state.assigned_user_ids as string[]),
  },
  'case.reassign': {
    label: 'Reassign case',
    execute: (pa) =>
      reassignCase(
        idFromWouldAffect(pa, 'case'),
        pa.after_state.assigned_user_ids as string[],
        pa.after_state.comment as string | undefined,
      ),
  },
  'case.status_update': {
    label: 'Update case status',
    execute: (pa) =>
      updateCaseStatus(
        idFromWouldAffect(pa, 'case'),
        pa.after_state.status as CaseStatus,
        pa.after_state.comment as string | undefined,
      ),
  },
  'case.lifecycle_stage_update': {
    label: 'Update case stage',
    execute: (pa) =>
      updateCaseLifecycleStage(
        idFromWouldAffect(pa, 'case'),
        pa.after_state.lifecycle_stage as CaseLifecycleStage,
        pa.after_state.comment as string | undefined,
      ),
  },
  'case.approve': {
    label: 'Approve case',
    execute: (pa) =>
      approveCase(idFromWouldAffect(pa, 'case'), pa.after_state.comment as string | undefined),
  },
  'case.reject': {
    label: 'Reject case',
    execute: (pa) => rejectCase(idFromWouldAffect(pa, 'case'), pa.after_state.comment as string),
  },
  'case.link_cnr': {
    label: 'Link CNR',
    execute: (pa) =>
      linkCaseCnr(idFromWouldAffect(pa, 'case'), {
        cnr: pa.after_state.cnr as string,
        court_type: pa.after_state.court_type as string | null | undefined,
      }),
  },
  'case.refresh_cnr': {
    label: 'Refresh CNR details',
    execute: (pa) => refreshCaseCnr(idFromWouldAffect(pa, 'case')),
  },
  'bill.raise': {
    label: 'Raise bill',
    execute: (pa) =>
      raiseBill(pa.after_state.case_id as string, {
        associate_id: pa.after_state.associate_id as string,
        bill_type_id: pa.after_state.bill_type_id as string | undefined,
        custom_type_label: pa.after_state.custom_type_label as string | undefined,
        flow_direction: pa.after_state.flow_direction as BillFlowDirection,
        amount: pa.after_state.amount as number | undefined,
        payment_destination_type: pa.after_state
          .payment_destination_type as BillPaymentDestinationType,
        payment_destination_value: pa.after_state.payment_destination_value as string,
      }),
  },
  'bill.mark_contacted': {
    label: 'Mark client contacted',
    execute: (pa) => markBillContacted(idFromWouldAffect(pa, 'bill')),
  },
  'bill.upload_proof': {
    label: 'Attach payment proof',
    execute: (pa) =>
      uploadBillProof(idFromWouldAffect(pa, 'bill'), pa.after_state.proof_document_id as string),
  },
  'bill.reject': {
    label: 'Reject bill proof',
    execute: (pa) =>
      rejectBill(idFromWouldAffect(pa, 'bill'), pa.after_state.rejection_reason as string),
  },
  'milestone.create': {
    label: 'Create payment milestone',
    execute: (pa) =>
      createPaymentMilestone(idFromWouldAffect(pa, 'case'), {
        label: pa.after_state.label as string,
        amount: pa.after_state.amount as number | null | undefined,
        percentage: pa.after_state.percentage as number | null | undefined,
        due_stage: pa.after_state.due_stage as string | null | undefined,
      }),
  },
  'document.create': {
    label: 'Add document',
    // No file bytes exist in the chat (multi-modal attach isn't built) -
    // "confirming" opens the case so the user can pick a file the normal way.
    navigateTo: (pa) => `/cases/${pa.after_state.case_id as string}`,
  },
  'document.create_version': {
    label: 'Add document version',
    navigateTo: () => '/documents',
  },
  'document.rollback_version': {
    label: 'Roll back document version',
    execute: (pa) =>
      rollbackVersion(
        idFromWouldAffect(pa, 'document'),
        pa.after_state.current_version_id as string,
      ),
  },
  'document.permanently_delete': {
    label: 'Permanently delete document',
    irreversible: true,
    execute: (pa) => deleteDocument(idFromWouldAffect(pa, 'document')),
  },
  'notification.mark_read': {
    label: 'Mark notification read',
    execute: (pa) => markNotificationRead(idFromWouldAffect(pa, 'notification')),
  },
  'notification.clear_all': {
    label: 'Clear all notifications',
    execute: () => clearAllNotifications(),
  },
  'issue.raise': {
    label: 'Raise issue',
    execute: (pa) =>
      raiseIssue(pa.after_state.case_id as string, {
        issue_type: pa.after_state.issue_type as string,
        description: pa.after_state.description as string,
        routed_to: pa.after_state.routed_to as string,
      }),
  },
  'issue.resolve': {
    label: 'Resolve issue',
    execute: (pa) =>
      resolveIssue(idFromWouldAffect(pa, 'issue'), {
        resolution_note: pa.after_state.resolution_note as string | undefined,
      }),
  },

  // --- Org & Access agent action types --------------------------------------
  'branch.create': {
    label: 'Create branch',
    execute: (pa) => createBranch({ name: pa.after_state.name as string }),
  },
  'branch.update': {
    label: 'Rename branch',
    execute: (pa) =>
      updateBranch(idFromWouldAffect(pa, 'branch'), { name: pa.after_state.name as string }),
  },
  'branch.freeze': {
    label: 'Freeze/unfreeze branch',
    execute: (pa) =>
      freezeBranch(idFromWouldAffect(pa, 'branch'), pa.after_state.is_frozen as boolean),
  },
  'branch.delete': {
    label: 'Delete branch',
    execute: (pa) => deleteBranch(idFromWouldAffect(pa, 'branch')),
  },
  'role.create': {
    label: 'Create role',
    execute: (pa) =>
      createRole({
        name: pa.after_state.name as string,
        description: pa.after_state.description as string | undefined,
        permissions: toPermissions(pa.after_state.permissions),
      }),
  },
  'role.update': {
    label: 'Update role',
    execute: (pa) =>
      updateRole(idFromWouldAffect(pa, 'role'), {
        name: pa.after_state.name as string,
        description: pa.after_state.description as string | undefined,
        permissions: toPermissions(pa.after_state.permissions),
      }),
  },
  'role.delete': {
    label: 'Delete role',
    execute: (pa) => deleteRole(idFromWouldAffect(pa, 'role')),
  },
  'branch_admin.permissions_update': {
    label: 'Update branch admin permissions',
    execute: (pa) =>
      updateBranchAdminPermissions(idFromWouldAffect(pa, 'user'), {
        branch_id: pa.after_state.branch_id as string,
        case_reassignment: pa.after_state.case_reassignment as boolean,
        fee_milestone_setting: pa.after_state.fee_milestone_setting as boolean,
        precedent_sharing: pa.after_state.precedent_sharing as boolean,
        invite_team_members: pa.after_state.invite_team_members as boolean,
        document_access_full: pa.after_state.document_access_full as boolean,
      }),
  },
  // 'user.invite' is deliberately absent - it gets its own editable form
  // (InviteUserConfirmCard below), not a blind re-send of after_state.
  'user.deactivate': {
    label: 'Deactivate user',
    execute: (pa) => deleteUser(idFromWouldAffect(pa, 'user')),
  },
  'user.role_change': {
    label: 'Change user roles',
    execute: (pa) =>
      assignRoles(idFromWouldAffect(pa, 'user'), pa.after_state.role_ids as string[]),
  },
  'organization.freeze': {
    label: 'Freeze/unfreeze organization',
    execute: (pa) => setOrganizationFreeze(pa.after_state.is_frozen as boolean),
  },
  'bill_type.create': {
    label: 'Create bill type',
    execute: (pa) =>
      createBillType({
        label: pa.after_state.label as string,
        case_type: pa.after_state.case_type as BillCaseTypeCategory,
        default_direction: pa.after_state.default_direction as BillFlowDirection,
      }),
  },
}

const TIER_TONE: Record<PendingAction['tier'], Tone> = { T1: 'info', T2: 'warning', T3: 'danger' }
const TIER_LABEL: Record<PendingAction['tier'], string> = {
  T1: 'Quick action',
  T2: 'Review before confirming',
  T3: 'Needs the full app',
}

// Internal ids (branch_id, role_ids, user_id, ...) are plumbing for execute()
// calls, not something worth showing a human - a real name/label field
// (branch_name, role_names, ...) is always drafted alongside one where it
// matters. Filtered out here, not at the source, so this protects every
// action_type generically, including ones added later.
const ID_KEY = /^id$|_id$|_ids$/i

function StateBlock({ title, state }: { title: string; state: Record<string, unknown> | null }) {
  if (!state) return null
  const entries = Object.entries(state).filter(
    ([k, v]) => v !== null && v !== undefined && v !== '' && !ID_KEY.test(k),
  )
  if (entries.length === 0) return null
  return (
    <div className="min-w-0 flex-1">
      <p className="text-xs font-medium tracking-wide text-ink-faint uppercase">{title}</p>
      <dl className="mt-1 space-y-1">
        {entries.map(([key, value]) => (
          <div key={key} className="flex justify-between gap-3 text-xs">
            <dt className="shrink-0 text-ink-muted">{humanize(key)}</dt>
            <dd className="text-right break-words text-ink">
              {Array.isArray(value) ? value.join(', ') : String(value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

async function recordHitlApproval(
  pendingAction: PendingAction,
  approvedBy: string | undefined,
  extra?: Record<string, unknown>,
) {
  await recordAssistantAuditEvent({
    action_type: 'ASSISTANT_HITL_APPROVED',
    resource_id: pendingAction.would_affect[0]?.split(':')[1] ?? 'n/a',
    new_state: { action_type: pendingAction.action_type, approved_by: approvedBy, ...extra },
  })
}

/** user.invite's dedicated confirm UI (not the generic before/after diff) -
 * inviting someone needs a branch picked from a dropdown and roles from a
 * checklist, the same real UsersPage.InviteDialog does, not raw ids typed
 * into chat. Pre-filled from the assistant's draft, fully editable before
 * sending - covers both "the model resolved the wrong branch" and "the user
 * wants to change something before confirming" in one UI. */
function InviteUserConfirmCard({
  pendingAction,
  onResolved,
}: {
  pendingAction: PendingAction
  onResolved: () => void
}) {
  const { user } = useAuth()
  const { toast } = useToast()
  const after = pendingAction.after_state as {
    email: string
    full_name: string
    branch_id: string | null
    is_branch_admin: boolean
    role_ids: string[]
  }
  const { data: branches } = useQuery({ queryKey: qk.branches, queryFn: listBranches })
  const { data: roles } = useQuery({ queryKey: qk.roles, queryFn: listRoles })
  const [fullName, setFullName] = useState(after.full_name)
  const [email, setEmail] = useState(after.email)
  const [branchId, setBranchId] = useState(after.branch_id ?? '')
  const [isBranchAdmin, setIsBranchAdmin] = useState(after.is_branch_admin)
  const [roleIds, setRoleIds] = useState<string[]>(after.role_ids ?? [])
  const [busy, setBusy] = useState(false)

  function toggleRole(id: string) {
    setRoleIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  async function handleConfirm() {
    setBusy(true)
    try {
      await inviteUser({
        email,
        full_name: fullName,
        branch_id: branchId || null,
        is_branch_admin: isBranchAdmin,
        role_ids: roleIds,
      })
      await recordHitlApproval(pendingAction, user?.sub, { email, full_name: fullName })
      toast('Invitation sent.', 'success')
      onResolved()
    } catch (err) {
      toast(describeAskNyayOpsError(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="animate-message-in mt-2">
      <CardHeader
        title="Invite new associate"
        description="Ask NyayOps drafted this plan - nothing is sent until you review and confirm."
        action={
          <Capsule tone={TIER_TONE[pendingAction.tier]} icon={AlertTriangle}>
            {TIER_LABEL[pendingAction.tier]}
          </Capsule>
        }
      />
      <CardBody className="flex flex-col gap-3">
        <Field label="Full name" required>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field label="Email" required>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Branch" hint="Leave unset for an org-wide user.">
          <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">Org-wide (no branch)</option>
            {(branches ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
        {branchId && (
          <label className="flex items-center gap-2.5 text-sm text-ink">
            <input
              type="checkbox"
              checked={isBranchAdmin}
              onChange={(e) => setIsBranchAdmin(e.target.checked)}
            />
            Branch Admin (manages only this branch)
          </label>
        )}
        <Field label="Roles" hint="Without a role the user will be locked out of most pages.">
          {(roles ?? []).length === 0 ? (
            <p className="text-sm text-ink-muted">No roles defined yet.</p>
          ) : (
            <div className="space-y-1">
              {(roles ?? []).map((r) => {
                const checked = roleIds.includes(r.id)
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggleRole(r.id)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-control px-3 py-2.5 text-left text-sm',
                      checked ? 'bg-brand-soft text-brand-strong' : 'hover:bg-surface-muted',
                    )}
                  >
                    {r.name}
                    <span
                      className={cn(
                        'grid size-5 place-items-center rounded border text-xs',
                        checked ? 'border-brand bg-brand text-white' : 'border-border-strong',
                      )}
                    >
                      {checked && '✓'}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </Field>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onResolved} disabled={busy}>
            <X className="size-4" /> Discard
          </Button>
          <Button
            size="sm"
            loading={busy}
            disabled={!fullName.trim() || !email.trim()}
            onClick={handleConfirm}
          >
            <Check className="size-4" /> Send invite
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

/** case.bulk_comment's dedicated confirm UI - posting the SAME comment to
 * several cases in one go (an MD/branch admin nudging every client_contacted
 * case for a payment update, say) needs to show which cases are actually
 * included and let the admin drop any before confirming, not just a single
 * before/after diff. Editable comment text, one Confirm click loops
 * addCaseComment across every still-checked case. */
function BulkCommentConfirmCard({
  pendingAction,
  onResolved,
}: {
  pendingAction: PendingAction
  onResolved: () => void
}) {
  const { user } = useAuth()
  const { toast } = useToast()
  const after = pendingAction.after_state as {
    comment: string
    cases: { case_id: string; title: string }[]
  }
  const [comment, setComment] = useState(after.comment)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(after.cases.map((c) => c.case_id)),
  )
  const [busy, setBusy] = useState(false)

  function toggleCase(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleConfirm() {
    const targets = after.cases.filter((c) => selectedIds.has(c.case_id))
    setBusy(true)
    try {
      for (const c of targets) {
        await addCaseComment(c.case_id, comment)
      }
      await recordHitlApproval(pendingAction, user?.sub, {
        comment,
        case_ids: targets.map((c) => c.case_id),
      })
      toast(`Comment posted to ${targets.length} case${targets.length === 1 ? '' : 's'}.`, 'success')
      onResolved()
    } catch (err) {
      toast(describeAskNyayOpsError(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="animate-message-in mt-2">
      <CardHeader
        title={`Post to ${after.cases.length} case${after.cases.length === 1 ? '' : 's'}`}
        description="Ask NyayOps drafted this - nothing is posted until you review and confirm."
        action={
          <Capsule tone={TIER_TONE[pendingAction.tier]} icon={AlertTriangle}>
            {TIER_LABEL[pendingAction.tier]}
          </Capsule>
        }
      />
      <CardBody className="flex flex-col gap-3">
        <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium tracking-wide text-ink-faint uppercase">
            Cases ({selectedIds.size} of {after.cases.length} selected)
          </p>
          <div className="space-y-0.5">
            {after.cases.map((c) => (
              <label
                key={c.case_id}
                className="flex items-center gap-2.5 rounded-control px-1 py-1 text-sm text-ink hover:bg-surface-muted"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(c.case_id)}
                  onChange={() => toggleCase(c.case_id)}
                />
                {c.title}
              </label>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onResolved} disabled={busy}>
            <X className="size-4" /> Discard
          </Button>
          <Button
            size="sm"
            loading={busy}
            disabled={selectedIds.size === 0 || !comment.trim()}
            onClick={handleConfirm}
          >
            <Check className="size-4" /> Post to {selectedIds.size} case
            {selectedIds.size === 1 ? '' : 's'}
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

/** The HITL confirm step for every drafted write, case.comment included -
 * Gemini only ever prepares a PendingAction (see the assistant's draft_*
 * tools), executing happens here, entirely outside the LLM, by calling
 * backend v1's existing, unmodified endpoints directly (implementation plan
 * Phase 10; replaces the old comment-only PendingCommentCard). */
export function PendingActionCard({ pendingAction, onResolved }: PendingActionCardProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  const isComment = pendingAction.action_type === 'case.comment'
  const [commentText, setCommentText] = useState(
    isComment ? ((pendingAction.after_state.comment as string) ?? '') : '',
  )
  const [editingComment, setEditingComment] = useState(false)

  if (pendingAction.action_type === 'user.invite') {
    return <InviteUserConfirmCard pendingAction={pendingAction} onResolved={onResolved} />
  }
  if (pendingAction.action_type === 'case.bulk_comment') {
    return <BulkCommentConfirmCard pendingAction={pendingAction} onResolved={onResolved} />
  }

  const handler = HANDLERS[pendingAction.action_type]
  const label = isComment ? 'Post comment' : (handler?.label ?? humanize(pendingAction.action_type))
  const irreversible = handler?.irreversible ?? false

  async function recordApproval(extra?: Record<string, unknown>) {
    await recordAssistantAuditEvent({
      action_type: 'ASSISTANT_HITL_APPROVED',
      resource_id: pendingAction.would_affect[0]?.split(':')[1] ?? 'n/a',
      new_state: { action_type: pendingAction.action_type, approved_by: user?.sub, ...extra },
    })
  }

  async function handleConfirm() {
    setBusy(true)
    try {
      if (isComment) {
        const caseId = pendingAction.after_state.case_id as string
        await addCaseComment(caseId, commentText)
        await recordApproval({
          case_id: caseId,
          draft_text: pendingAction.after_state.comment,
          final_text: commentText,
        })
        toast('Comment posted.', 'success')
      } else if (handler?.execute) {
        await handler.execute(pendingAction)
        await recordApproval()
        toast('Done.', 'success')
      }
      onResolved()
    } catch (err) {
      toast(describeAskNyayOpsError(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  function handleOpenTarget() {
    if (handler?.navigateTo) navigate(handler.navigateTo(pendingAction))
    onResolved()
  }

  const canAct = isComment || Boolean(handler)

  return (
    <Card className="animate-message-in mt-2">
      <CardHeader
        title={label}
        description={
          isComment
            ? 'Ask NyayOps drafted this comment. Nothing is posted until you confirm.'
            : pendingAction.summary
        }
        action={
          <Capsule tone={TIER_TONE[pendingAction.tier]} icon={AlertTriangle}>
            {TIER_LABEL[pendingAction.tier]}
          </Capsule>
        }
      />
      <CardBody className="flex flex-col gap-3">
        {isComment ? (
          editingComment ? (
            <Textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              rows={4}
              autoFocus
            />
          ) : (
            <p className="text-sm whitespace-pre-wrap text-ink">{commentText}</p>
          )
        ) : (
          pendingAction.tier !== 'T1' && (
            <div className="flex flex-col gap-3 rounded-control bg-surface-muted p-3 sm:flex-row">
              <StateBlock title="Before" state={pendingAction.before_state} />
              <StateBlock title="After" state={pendingAction.after_state} />
            </div>
          )
        )}

        {irreversible && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-danger">
            <AlertTriangle className="size-3.5 shrink-0" /> This cannot be undone.
          </p>
        )}

        {!canAct && (
          <p className="text-xs text-ink-muted">
            This kind of change can't be completed from chat - use the full app.
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onResolved} disabled={busy}>
            <X className="size-4" /> Discard
          </Button>
          {isComment && !editingComment && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setEditingComment(true)}
              disabled={busy}
            >
              <Pencil className="size-4" /> Edit
            </Button>
          )}
          {handler?.navigateTo ? (
            <Button size="sm" onClick={handleOpenTarget}>
              <ArrowRight className="size-4" /> Continue
            </Button>
          ) : (
            canAct && (
              <Button
                size="sm"
                variant={irreversible ? 'danger' : 'primary'}
                loading={busy}
                onClick={handleConfirm}
              >
                <Check className="size-4" /> Confirm
              </Button>
            )
          )}
        </div>
      </CardBody>
    </Card>
  )
}
