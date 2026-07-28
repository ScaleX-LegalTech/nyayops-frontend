import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowRight, Check, Pencil, X } from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { UserMultiSelect } from '@/components/ui/UserMultiSelect'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/auth/AuthContext'
import { cn } from '@/lib/cn'
import { humanize } from '@/lib/format'
import { qk } from '@/lib/queryKeys'
import { describeAskNyayOpsError, recordAssistantAuditEvent } from '@/lib/api/askNyayOps'
import { assignCase, reassignCase, addCaseComment } from '@/lib/api/cases'
import { inviteUser, listBranches, listRoles } from '@/lib/api/admin'
import { HANDLERS, idFromWouldAffect } from './pendingActionHandlers'
import { ActionCardHeader, StateBlock, VoiceTranscriptNote } from './actionCardKit'
import { RoleFormConfirmCard } from './RoleFormConfirmCard'
import { BillRaiseConfirmCard } from './BillRaiseConfirmCard'
import { PermissionsUpdateConfirmCard } from './PermissionsUpdateConfirmCard'
import { DestructiveConfirmCard } from './DestructiveConfirmCard'
import type { PendingAction } from '@/types'

interface PendingActionCardProps {
  pendingAction: PendingAction
  /** Called once the card is resolved (confirmed, discarded, or navigated
   * away from) so the chat can stop rendering it. Confirming/discarding never
   * goes back through the model (this calls the real REST endpoint directly),
   * so the optional message here is the ONLY reply the thread gets - a
   * synthetic assistant turn appended client-side, not a second model call. */
  onResolved: (message?: string) => void
  /** The spoken transcript that produced this action, only when it came from
   * voice input (Improvements v1 doc §3.5/§8.2 item 7) - shown alongside the
   * summary so a misheard name/date is caught here, at the one point the user
   * already has to stop and look, not after confirming. */
  voiceTranscript?: string
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
  voiceTranscript,
}: {
  pendingAction: PendingAction
  onResolved: (message?: string) => void
  voiceTranscript?: string
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
      onResolved(`Done! Invitation sent to ${email}.`)
    } catch (err) {
      toast(describeAskNyayOpsError(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="animate-message-in mt-2 border-border-strong shadow-sm">
      <ActionCardHeader
        actionType={pendingAction.action_type}
        tier={pendingAction.tier}
        title="Invite new associate"
        description="Ask NyayOps drafted this plan - nothing is sent until you review and confirm."
      />
      <CardBody className="flex flex-col gap-3">
        {voiceTranscript && <VoiceTranscriptNote text={voiceTranscript} />}
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onResolved("No problem, I won't send that invite.")}
            disabled={busy}
          >
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

/** case.assign/case.reassign's dedicated confirm UI - a searchable picker
 * (the same UserMultiSelect the real Assign/Reassign dialogs use) instead of
 * the generic before/after diff, which just showed raw would-be assignee ids
 * with no way to browse or fix them. Pre-filled from the assistant's draft
 * (its own free-text name resolution still runs first, same as before), but
 * fully correctable here - covers a misheard/ambiguous name without another
 * round trip through the model. case.reassign additionally carries the
 * optional reassignment comment case.assign doesn't have. */
function AssignCaseConfirmCard({
  pendingAction,
  onResolved,
  voiceTranscript,
}: {
  pendingAction: PendingAction
  onResolved: (message?: string) => void
  voiceTranscript?: string
}) {
  const { user } = useAuth()
  const { toast } = useToast()
  const isReassign = pendingAction.action_type === 'case.reassign'
  const caseId = idFromWouldAffect(pendingAction, 'case')
  const [selected, setSelected] = useState<string[]>(
    (pendingAction.after_state.assigned_user_ids as string[]) ?? [],
  )
  const [comment, setComment] = useState((pendingAction.after_state.comment as string) ?? '')
  const [busy, setBusy] = useState(false)

  async function handleConfirm() {
    setBusy(true)
    try {
      if (isReassign) {
        await reassignCase(caseId, selected, comment || undefined)
      } else {
        await assignCase(caseId, selected)
      }
      await recordHitlApproval(pendingAction, user?.sub, { assigned_user_ids: selected })
      toast(isReassign ? 'Case reassigned.' : 'Case assigned.', 'success')
      onResolved(`Done! ${isReassign ? 'Reassigned' : 'Assigned'} to ${selected.length} person${selected.length === 1 ? '' : 's'}.`)
    } catch (err) {
      toast(describeAskNyayOpsError(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="animate-message-in mt-2 border-border-strong shadow-sm">
      <ActionCardHeader
        actionType={pendingAction.action_type}
        tier={pendingAction.tier}
        title={isReassign ? 'Reassign case' : 'Assign case'}
        description="Ask NyayOps drafted this plan - nothing is sent until you review and confirm."
      />
      <CardBody className="flex flex-col gap-3">
        {voiceTranscript && <VoiceTranscriptNote text={voiceTranscript} />}
        <Field label="Assign to" error={selected.length === 0 ? 'Select at least one user.' : undefined}>
          <UserMultiSelect caseIds={[caseId]} selected={selected} onChange={setSelected} />
        </Field>
        {isReassign && (
          <Field label="Comment" hint="Optional, recorded with the reassignment.">
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
          </Field>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onResolved("Okay, I've discarded that - let me know if you'd like something else.")}
            disabled={busy}
          >
            <X className="size-4" /> Discard
          </Button>
          <Button size="sm" loading={busy} disabled={selected.length === 0} onClick={handleConfirm}>
            <Check className="size-4" /> {isReassign ? 'Reassign' : 'Assign'}
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
  voiceTranscript,
}: {
  pendingAction: PendingAction
  onResolved: (message?: string) => void
  voiceTranscript?: string
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
      onResolved(`Done! Posted to ${targets.length} case${targets.length === 1 ? '' : 's'}.`)
    } catch (err) {
      toast(describeAskNyayOpsError(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="animate-message-in mt-2 border-border-strong shadow-sm">
      <ActionCardHeader
        actionType={pendingAction.action_type}
        tier={pendingAction.tier}
        title={`Post to ${after.cases.length} case${after.cases.length === 1 ? '' : 's'}`}
        description="Ask NyayOps drafted this - nothing is posted until you review and confirm."
      />
      <CardBody className="flex flex-col gap-3">
        {voiceTranscript && <VoiceTranscriptNote text={voiceTranscript} />}
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onResolved("Okay, I won't post that comment.")}
            disabled={busy}
          >
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

/** 'workflow.batch' - the backend's `combine_pending_actions` (Improvements v1
 * doc §6.3) merges multiple draft_ tool results from the SAME model turn
 * (e.g. "reassign this to Priya and let her know" = case.reassign +
 * case.comment) into one after_state.actions list instead of the loop
 * silently keeping only the last one. Each sub-action still runs through its
 * own real execute() - this card is a bundled confirm surface, not a new
 * execution path. Confirm runs them in order and stops at the first failure,
 * so already-applied changes aren't retried; comment sub-actions post the
 * drafted text as-is (no per-card edit, unlike the single-comment card). */
function WorkflowConfirmCard({
  pendingAction,
  onResolved,
  voiceTranscript,
}: {
  pendingAction: PendingAction
  onResolved: (message?: string) => void
  voiceTranscript?: string
}) {
  const { user } = useAuth()
  const { toast } = useToast()
  const actions = (pendingAction.after_state.actions as PendingAction[]) ?? []
  const [busy, setBusy] = useState(false)

  async function runOne(pa: PendingAction) {
    if (pa.action_type === 'case.comment') {
      await addCaseComment(pa.after_state.case_id as string, pa.after_state.comment as string)
      return
    }
    const handler = HANDLERS[pa.action_type]
    if (!handler?.execute) {
      throw new Error(`${humanize(pa.action_type)} can't be completed from chat.`)
    }
    await handler.execute(pa)
  }

  async function handleConfirm() {
    setBusy(true)
    let done = 0
    try {
      for (const pa of actions) {
        await runOne(pa)
        done += 1
      }
      await recordHitlApproval(pendingAction, user?.sub, {
        action_types: actions.map((pa) => pa.action_type),
      })
      toast('Done.', 'success')
      onResolved(`Done! Completed all ${done} step${done === 1 ? '' : 's'}.`)
    } catch (err) {
      toast(describeAskNyayOpsError(err), 'error')
      if (done > 0) {
        onResolved(
          `I completed ${done} of ${actions.length} steps before hitting a problem - ` +
            'the rest were not applied.',
        )
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="animate-message-in mt-2 border-border-strong shadow-sm">
      <ActionCardHeader
        actionType={pendingAction.action_type}
        tier={pendingAction.tier}
        title={`${actions.length} steps drafted together`}
        description="Ask NyayOps drafted these together - nothing happens until you confirm."
      />
      <CardBody className="flex flex-col gap-3">
        {voiceTranscript && <VoiceTranscriptNote text={voiceTranscript} />}
        <ol className="space-y-2">
          {actions.map((pa, i) => (
            <li
              key={pa.idempotency_key}
              className="rounded-control bg-surface-muted px-3 py-2 text-sm text-ink"
            >
              <span className="mr-2 text-ink-faint">{i + 1}.</span>
              {pa.summary}
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onResolved("Okay, I've discarded that - let me know if you'd like something else.")}
            disabled={busy}
          >
            <X className="size-4" /> Discard
          </Button>
          <Button size="sm" loading={busy} onClick={handleConfirm}>
            <Check className="size-4" /> Confirm all {actions.length}
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
export function PendingActionCard({
  pendingAction,
  onResolved,
  voiceTranscript,
}: PendingActionCardProps) {
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
    return (
      <InviteUserConfirmCard
        pendingAction={pendingAction}
        onResolved={onResolved}
        voiceTranscript={voiceTranscript}
      />
    )
  }
  if (pendingAction.action_type === 'case.assign' || pendingAction.action_type === 'case.reassign') {
    return (
      <AssignCaseConfirmCard
        pendingAction={pendingAction}
        onResolved={onResolved}
        voiceTranscript={voiceTranscript}
      />
    )
  }
  if (pendingAction.action_type === 'case.bulk_comment') {
    return (
      <BulkCommentConfirmCard
        pendingAction={pendingAction}
        onResolved={onResolved}
        voiceTranscript={voiceTranscript}
      />
    )
  }
  if (pendingAction.action_type === 'workflow.batch') {
    return (
      <WorkflowConfirmCard
        pendingAction={pendingAction}
        onResolved={onResolved}
        voiceTranscript={voiceTranscript}
      />
    )
  }
  if (pendingAction.action_type === 'role.create' || pendingAction.action_type === 'role.update') {
    return (
      <RoleFormConfirmCard
        pendingAction={pendingAction}
        onResolved={onResolved}
        voiceTranscript={voiceTranscript}
      />
    )
  }
  if (pendingAction.action_type === 'branch_admin.permissions_update') {
    return (
      <PermissionsUpdateConfirmCard
        pendingAction={pendingAction}
        onResolved={onResolved}
        voiceTranscript={voiceTranscript}
      />
    )
  }
  if (pendingAction.action_type === 'bill.raise') {
    return (
      <BillRaiseConfirmCard
        pendingAction={pendingAction}
        onResolved={onResolved}
        voiceTranscript={voiceTranscript}
      />
    )
  }
  // Every other T3 (role.delete, branch.delete, organization.freeze,
  // user.deactivate, document.permanently_delete) gets the dedicated
  // destructive-workflow treatment (redesign brief §4) instead of the
  // generic diff below - case.comment never reaches T3, so isComment can't
  // land here.
  if (pendingAction.tier === 'T3' && !isComment) {
    return (
      <DestructiveConfirmCard
        pendingAction={pendingAction}
        onResolved={onResolved}
        voiceTranscript={voiceTranscript}
      />
    )
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
        onResolved('Done! Comment posted.')
      } else if (handler?.execute) {
        await handler.execute(pendingAction)
        await recordApproval()
        toast('Done.', 'success')
        onResolved('Done!')
      }
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
    <Card className="animate-message-in mt-2 border-border-strong shadow-sm">
      <ActionCardHeader
        actionType={pendingAction.action_type}
        tier={pendingAction.tier}
        title={label}
        description={
          isComment
            ? 'Ask NyayOps drafted this comment. Nothing is posted until you confirm.'
            : pendingAction.summary
        }
      />
      <CardBody className="flex flex-col gap-3">
        {voiceTranscript && <VoiceTranscriptNote text={voiceTranscript} />}
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              onResolved(
                isComment
                  ? "Okay, I won't post that comment."
                  : "Okay, I've discarded that - let me know if you'd like something else.",
              )
            }
            disabled={busy}
          >
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
