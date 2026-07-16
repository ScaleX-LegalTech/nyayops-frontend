import { useState } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import type { Case, CaseLifecycleStage, DocumentCard } from '@/types'
import {
  CASE_LIFECYCLE_PARTS,
  FORWARD_TRANSITIONS,
  BACKWARD_TRANSITIONS,
  GATED_LIFECYCLE_STAGES,
  REQUIRED_DOC_TYPE_FOR,
  OPTIONAL_DOC_TYPE_FOR,
} from '@/types'
import { cn } from '@/lib/cn'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Textarea } from '@/components/ui/Field'
import { UploadDialog } from '@/features/documents/UploadDialog'
import { approveScrutiny, rejectScrutiny, updateCaseLifecycleStage } from '@/lib/api/cases'
import { invalidateCaseScopes, qk } from '@/lib/queryKeys'
import { useMutationWithToast } from '@/lib/useMutationWithToast'
import { useToast } from '@/components/ui/Toast'
import { usePermissions } from '@/lib/usePermissions'

const STAGE_LABELS: Record<CaseLifecycleStage, string> = {
  collection: 'Collection',
  scrutiny: 'Scrutiny',
  filed: 'Suit filed',
  cnr_linked: 'CNR linked',
  research_draft: 'Research & draft',
  hearing: 'Hearing',
  disposed: 'Disposed',
}

function partIndexOf(stage: CaseLifecycleStage): number {
  return CASE_LIFECYCLE_PARTS.findIndex((part) => part.stages.includes(stage))
}

/**
 * The firm's actual SOP, grouped into 4 parts (Collection & Scrutiny / Suit & CNR /
 * Research, Draft & Hearing / Disposed) - see CASE_LIFECYCLE_PARTS. A stage move is one
 * of three kinds:
 *  - a gated forward entry (filed/cnr_linked) - only reachable via the File suit / Link
 *    CNR dialogs, never a bare click here;
 *  - an ungated forward move - hard-blocked until the current stage's required document
 *    (REQUIRED_DOC_TYPE_FOR) is on file, prompting an upload instead of moving; a few
 *    other stages have only an optional document (OPTIONAL_DOC_TYPE_FOR) - missing it
 *    just prompts a "continue anyway?" instead of blocking;
 *  - a backward revert - always allowed, confirmed first (with stronger copy when it
 *    crosses a part boundary), never gated by documents.
 */
export function CaseLifecycleTracker({
  c,
  documents,
  onRequestFileSuit,
  onRequestLinkCnr,
}: {
  c: Case
  documents: DocumentCard[]
  onRequestFileSuit: () => void
  onRequestLinkCnr: () => void
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { hasPermission } = usePermissions()
  const currentStage = c.lifecycle_stage ?? 'collection'
  const currentPartIndex = partIndexOf(currentStage)
  const forwardReachable = FORWARD_TRANSITIONS[currentStage]
  const backwardReachable = BACKWARD_TRANSITIONS[currentStage]
  const canEdit = hasPermission('cases', 'update')

  const [revertTarget, setRevertTarget] = useState<CaseLifecycleStage | null>(null)
  const [missingDocFor, setMissingDocFor] = useState<{
    stage: CaseLifecycleStage
    requiredType: string
    /** Optional (OPTIONAL_DOC_TYPE_FOR) just nudges, with a "Continue anyway" way
     * out - required (REQUIRED_DOC_TYPE_FOR) hard-blocks until uploaded. */
    optional: boolean
  } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const mutation = useMutationWithToast({
    mutationFn: (stage: CaseLifecycleStage) => updateCaseLifecycleStage(c.id, stage),
    onSuccess: () => {
      invalidateCaseScopes(queryClient)
      queryClient.invalidateQueries({ queryKey: qk.caseDetail(c.id) })
      toast('Stage updated.', 'success')
      setRevertTarget(null)
    },
    errorFallback: 'Could not update stage.',
  })

  const canApproveScrutiny = hasPermission('cases', 'approve_scrutiny')
  const hasScrutinyReport = documents.some((d) => d.doc_type === 'scrutiny_report')

  function invalidateAfterScrutinyAction() {
    invalidateCaseScopes(queryClient)
    queryClient.invalidateQueries({ queryKey: qk.caseDetail(c.id) })
    queryClient.invalidateQueries({ queryKey: qk.scrutinyActionRequired })
    queryClient.invalidateQueries({ queryKey: qk.kpis })
  }

  const approveMutation = useMutationWithToast({
    mutationFn: () => approveScrutiny(c.id),
    onSuccess: () => {
      invalidateAfterScrutinyAction()
      toast('Scrutiny approved.', 'success')
    },
    errorFallback: 'Could not approve scrutiny.',
  })

  const rejectMutation = useMutationWithToast({
    mutationFn: () => rejectScrutiny(c.id, rejectReason),
    onSuccess: () => {
      invalidateAfterScrutinyAction()
      toast('Scrutiny rejected.', 'success')
      setRejecting(false)
      setRejectReason('')
    },
    errorFallback: 'Could not reject scrutiny.',
  })

  function handleStageClick(stage: CaseLifecycleStage) {
    if (!canEdit || mutation.isPending || stage === currentStage) return

    if (forwardReachable.includes(stage)) {
      if (GATED_LIFECYCLE_STAGES.includes(stage)) {
        if (stage === 'filed') onRequestFileSuit()
        else onRequestLinkCnr()
        return
      }
      const requiredType = REQUIRED_DOC_TYPE_FOR[currentStage]
      if (requiredType && !documents.some((d) => d.doc_type === requiredType)) {
        setMissingDocFor({ stage, requiredType, optional: false })
        return
      }
      const optionalType = OPTIONAL_DOC_TYPE_FOR[currentStage]
      if (optionalType && !documents.some((d) => d.doc_type === optionalType)) {
        setMissingDocFor({ stage, requiredType: optionalType, optional: true })
        return
      }
      mutation.mutate(stage)
      return
    }

    if (backwardReachable.includes(stage)) {
      setRevertTarget(stage)
    }
  }

  const revertCrossesPart = revertTarget != null && partIndexOf(revertTarget) < currentPartIndex

  return (
    <Card>
      <CardBody className="py-4">
        <div className="flex items-stretch overflow-x-auto">
          {CASE_LIFECYCLE_PARTS.map((part, partIdx) => {
            const partDone = partIdx < currentPartIndex
            const partActive = partIdx === currentPartIndex
            return (
              <div key={part.name} className="flex flex-1 items-center last:flex-none">
                <div className="flex shrink-0 flex-col gap-2">
                  <span
                    className={cn(
                      'text-xs font-semibold uppercase tracking-wide',
                      partActive ? 'text-brand' : partDone ? 'text-ink-muted' : 'text-ink-faint',
                    )}
                  >
                    {part.name}
                  </span>
                  <div className="flex items-center gap-2">
                    {part.stages.map((stage, stageIdx) => {
                      const done =
                        partDone || (partActive && part.stages.indexOf(currentStage) > stageIdx)
                      const active = stage === currentStage
                      const canClick =
                        canEdit &&
                        !mutation.isPending &&
                        (forwardReachable.includes(stage) || backwardReachable.includes(stage))
                      return (
                        <div key={stage} className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={!canClick}
                            title={
                              !canClick && canEdit && !active
                                ? 'Not reachable from the current stage'
                                : undefined
                            }
                            onClick={() => handleStageClick(stage)}
                            className={cn(
                              'flex shrink-0 flex-col items-center gap-1.5',
                              canClick && 'cursor-pointer',
                            )}
                          >
                            <span
                              className={cn(
                                'dot size-2',
                                done || active ? 'bg-brand' : 'bg-border-strong',
                              )}
                              aria-hidden
                            />
                            <span
                              className={cn(
                                'whitespace-nowrap text-xs',
                                active ? 'font-medium text-ink' : 'text-ink-faint',
                              )}
                            >
                              {STAGE_LABELS[stage]}
                            </span>
                          </button>
                          {stageIdx < part.stages.length - 1 && (
                            <div
                              className={cn('h-px w-4', done ? 'bg-brand' : 'bg-border')}
                              aria-hidden
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
                {partIdx < CASE_LIFECYCLE_PARTS.length - 1 && (
                  <div
                    className={cn('mx-3 h-px min-w-6 flex-1', partDone ? 'bg-brand' : 'bg-border')}
                    aria-hidden
                  />
                )}
              </div>
            )
          })}
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-faint">
          <RotateCcw className="size-3.5" aria-hidden />
          Click a stage to move the case there — an already-passed stage can be reverted
          back to for a misclick, with confirmation.
        </p>

        {currentStage === 'scrutiny' && c.scrutiny_review_status === 'rejected' && (
          <div className="mt-4 flex items-start gap-3 rounded-control border border-danger/30 bg-danger-soft px-4 py-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-danger">Action required — scrutiny rejected</p>
              <p className="mt-0.5 text-sm text-ink">{c.scrutiny_rejection_reason}</p>
              <p className="mt-1 text-xs text-ink-muted">
                Upload a corrected scrutiny report to send it up for approval again.
              </p>
            </div>
          </div>
        )}

        {currentStage === 'scrutiny' && c.scrutiny_review_status === 'approved' && (
          <p className="mt-4 text-sm text-ink-muted">
            Scrutiny approved — the suit can now be filed.
          </p>
        )}

        {currentStage === 'scrutiny' && canApproveScrutiny && hasScrutinyReport && (
          <div className="mt-4 flex items-center gap-2">
            {c.scrutiny_review_status !== 'approved' && (
              <Button
                size="sm"
                loading={approveMutation.isPending}
                onClick={() => approveMutation.mutate()}
              >
                Approve scrutiny
              </Button>
            )}
            {c.scrutiny_review_status !== 'rejected' && (
              <Button size="sm" variant="secondary" onClick={() => setRejecting(true)}>
                Reject scrutiny
              </Button>
            )}
          </div>
        )}
      </CardBody>

      <Dialog
        open={revertTarget != null}
        onClose={() => setRevertTarget(null)}
        title="Revert stage"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRevertTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={mutation.isPending}
              onClick={() => revertTarget && mutation.mutate(revertTarget)}
            >
              Revert
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">
          {revertCrossesPart ? (
            <>
              This undoes progress already made — move the case back to{' '}
              <span className="font-medium text-ink">
                {revertTarget && STAGE_LABELS[revertTarget]}
              </span>
              ?
            </>
          ) : (
            <>
              Move this case back to{' '}
              <span className="font-medium text-ink">
                {revertTarget && STAGE_LABELS[revertTarget]}
              </span>
              ?
            </>
          )}
        </p>
      </Dialog>

      <Dialog
        open={missingDocFor != null}
        onClose={() => setMissingDocFor(null)}
        title={missingDocFor?.optional ? 'No document on file yet' : 'Document required'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setMissingDocFor(null)}>
              Cancel
            </Button>
            {missingDocFor?.optional && (
              <Button
                variant="secondary"
                loading={mutation.isPending}
                onClick={() => missingDocFor && mutation.mutate(missingDocFor.stage)}
              >
                Continue anyway
              </Button>
            )}
            <Button onClick={() => setUploading(true)}>Upload</Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">
          {missingDocFor?.optional ? (
            <>
              No{' '}
              <span className="font-medium text-ink">
                {missingDocFor.requiredType.replace(/_/g, ' ')}
              </span>{' '}
              on file yet. You can upload one, or continue on to{' '}
              <span className="font-medium text-ink">{STAGE_LABELS[missingDocFor.stage]}</span>{' '}
              without it.
            </>
          ) : (
            <>
              Upload a{' '}
              <span className="font-medium text-ink">
                {missingDocFor && missingDocFor.requiredType.replace(/_/g, ' ')}
              </span>{' '}
              before moving on to{' '}
              <span className="font-medium text-ink">
                {missingDocFor && STAGE_LABELS[missingDocFor.stage]}
              </span>
              .
            </>
          )}
        </p>
      </Dialog>

      <Dialog
        open={rejecting}
        onClose={() => setRejecting(false)}
        title="Reject scrutiny"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejecting(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={rejectMutation.isPending}
              disabled={!rejectReason.trim()}
              onClick={() => rejectMutation.mutate()}
            >
              Reject
            </Button>
          </>
        }
      >
        <Field label="Reason" required hint="Shown to whoever's working the case, so they know what to fix.">
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            autoFocus
          />
        </Field>
      </Dialog>

      {uploading && (
        <UploadDialog
          mode="new"
          caseId={c.id}
          open
          onClose={() => {
            setUploading(false)
            setMissingDocFor(null)
          }}
        />
      )}
    </Card>
  )
}
