import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  FilePlus2,
  FileSearch,
  FileSignature,
  FileText,
  Link2,
  MessageSquarePlus,
  Pencil,
  Plus,
  Trash2,
  UserCog,
  UserPlus,
} from 'lucide-react'
import { deleteCase, getCase, getCaseTransitions, updateCaseStatus } from '@/lib/api/cases'
import { downloadDocument, listDocuments, loadDocumentBlob, rollbackVersion } from '@/lib/api/documents'
import { invalidateCaseScopes, qk } from '@/lib/queryKeys'
import type { Case, CaseLifecycleStage, CaseStatus } from '@/types'
import { CASE_LIFECYCLE_STAGES, DOC_TYPE_OPTIONS, FORWARD_TRANSITIONS } from '@/types'
import { courtLabel, formatBytes, formatDate, formatDateTime, humanize } from '@/lib/format'
import { useUsers } from '@/lib/useUsers'
import { useCasePeople } from '@/lib/useCasePeople'
import { usePermissions } from '@/lib/usePermissions'
import { useMutationWithToast } from '@/lib/useMutationWithToast'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Textarea } from '@/components/ui/Field'
import { Badge, PriorityBadge, StatusBadge, STATUS_TONE, TONES } from '@/components/ui/Badge'
import { Dialog } from '@/components/ui/Dialog'
import { Tabs } from '@/components/ui/Tabs'
import { DocumentPreviewDialog, type PreviewTarget } from '@/components/ui/DocumentPreviewDialog'
import { ErrorState, LoadingState } from '@/components/ui/Feedback'
import { EditCaseDialog } from './EditCaseDialog'
import { AssignDialog } from './AssignDialog'
import { ReassignDialog } from './ReassignDialog'
import { UploadDialog } from '@/features/documents/UploadDialog'
import { SCAN_TONE, VersionHistory } from '@/features/documents/DocumentsPage'
import { CaseLifecycleTracker } from './CaseLifecycleTracker'
import { LinkCnrDialog } from './LinkCnrDialog'
import { FileSuitDialog } from './FileSuitDialog'
import { cn } from '@/lib/cn'

const REVIEWER_ONLY_STATUSES: CaseStatus[] = ['under_review', 'approved', 'rejected', 'closed']

// doc_type -> the stage it's curated for (DOC_TYPE_OPTIONS inverted). A doc_type that's
// curated for more than one stage (filing_document: filed + cnr_linked) keeps whichever
// stage comes first in CASE_LIFECYCLE_STAGES - that's the one it's actually required for
// (see REQUIRED_DOC_TYPE_FOR in domain/case_fsm.py).
const STAGE_FOR_DOC_TYPE: Partial<Record<string, CaseLifecycleStage>> = {}
for (const stage of CASE_LIFECYCLE_STAGES) {
  for (const option of DOC_TYPE_OPTIONS[stage]) {
    if (!(option.value in STAGE_FOR_DOC_TYPE)) STAGE_FOR_DOC_TYPE[option.value] = stage
  }
}

const DOC_TAB_LABELS: Record<CaseLifecycleStage, string> = {
  collection: 'Collection',
  scrutiny: 'Scrutiny',
  filed: 'Suit filed',
  cnr_linked: 'CNR linked',
  research_draft: 'Research & draft',
  hearing: 'Hearing',
  disposed: 'Disposed',
}

/** The moment a stage's own required document stopped being "current" - the first
 * lifecycle_history entry for one of that stage's forward successors. Documents whose
 * curated stage is behind this moment were added after that stage was already
 * completed - flagged for transparency rather than hidden. */
function stageExitedAt(history: Case['lifecycle_history'], stage: CaseLifecycleStage): string | null {
  const successors = FORWARD_TRANSITIONS[stage]
  const exit = history.find((h) => successors.includes(h.stage))
  return exit ? exit.entered_at : null
}

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
  const { nameOf: globalNameOf } = useUsers()
  const { nameOf: caseNameOf } = useCasePeople(caseId)
  const nameOf = (id: string) => caseNameOf(id) ?? globalNameOf(id)
  const { hasPermission } = usePermissions()

  const [editing, setEditing] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [reassigning, setReassigning] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [nextStatus, setNextStatus] = useState<CaseStatus | ''>('')
  const [statusComment, setStatusComment] = useState('')
  const [uploading, setUploading] = useState(false)
  const [linkingCnr, setLinkingCnr] = useState(false)
  const [filingSuit, setFilingSuit] = useState(false)
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null)
  const [versionFor, setVersionFor] = useState<string | null>(null)
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget | null>(null)
  const [docTab, setDocTab] = useState<'all' | CaseLifecycleStage | 'other'>('all')

  const { data: c, isLoading, isError, error, refetch } = useQuery({
    queryKey: qk.caseDetail(caseId),
    queryFn: () => getCase(caseId),
  })

  const { data: transitions } = useQuery({
    queryKey: qk.caseTransitions,
    queryFn: getCaseTransitions,
  })

  const { data: documents } = useQuery({
    queryKey: qk.documents({ case_id: caseId }),
    queryFn: () => listDocuments({ case_id: caseId }),
  })

  function invalidate() {
    invalidateCaseScopes(queryClient)
    queryClient.invalidateQueries({ queryKey: qk.caseDetail(caseId) })
    queryClient.invalidateQueries({ queryKey: qk.caseActivity(caseId) })
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

  const deleteMutation = useMutationWithToast({
    mutationFn: () => deleteCase(caseId),
    onSuccess: () => {
      invalidate()
      toast('Case deleted.', 'success')
      navigate('/cases')
    },
    errorFallback: 'Delete failed.',
  })

  const rollback = useMutationWithToast({
    mutationFn: ({ docId, versionId }: { docId: string; versionId: string }) =>
      rollbackVersion(docId, versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.documents({ case_id: caseId }) })
      toast('Rolled back to selected version.', 'success')
    },
    errorFallback: 'Rollback failed.',
  })

  if (isLoading) return <LoadingState />
  if (isError || !c) return <ErrorState error={error} onRetry={refetch} />

  const caseTransitions = transitions?.[c.status] ?? []
  const canReview = hasPermission('cases', 'review')
  // Carrying a case up to ready_for_review is the assignee's job; entering review,
  // the review decision, and closing afterward are the reviewer/manager's call.
  const allowed = caseTransitions.filter(
    (s) => s !== 'reassigned' && (canReview || !REVIEWER_ONLY_STATUSES.includes(s)),
  )
  const canReassign = hasPermission('cases', 'assign') && caseTransitions.includes('reassigned')
  const canLinkCnr = hasPermission('cases', 'update') && c.source !== 'cnr'
  const cnrStageReady =
    c.lifecycle_stage != null && c.lifecycle_stage !== 'collection' && c.lifecycle_stage !== 'scrutiny'
  // Filing details are only collectible once, while the case is still draft (add_case_details
  // is a one-time action) - after that the button just disappears, "File suit" done.
  const canFileSuit = hasPermission('cases', 'update') && c.status === 'draft'
  const fileSuitReady = c.lifecycle_stage === 'scrutiny'

  const fileDocuments = documents?.filter(
    (d) => d.doc_type !== 'comment_attachment' && d.doc_type !== 'final_order_attachment',
  )

  const docTabs: { key: CaseLifecycleStage | 'other'; label: string }[] = [
    ...CASE_LIFECYCLE_STAGES.filter((stage) =>
      fileDocuments?.some((d) => STAGE_FOR_DOC_TYPE[d.doc_type] === stage),
    ).map((stage) => ({ key: stage, label: DOC_TAB_LABELS[stage] })),
    ...(fileDocuments?.some((d) => !(d.doc_type in STAGE_FOR_DOC_TYPE))
      ? [{ key: 'other' as const, label: 'Other' }]
      : []),
  ]
  const shownDocuments = fileDocuments?.filter((d) => {
    if (docTab === 'all') return true
    if (docTab === 'other') return !(d.doc_type in STAGE_FOR_DOC_TYPE)
    return STAGE_FOR_DOC_TYPE[d.doc_type] === docTab
  })

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
            <span className="type-mono text-ink-faint">{c.case_code}</span>
            <span className="text-ink-faint">·</span>
            <StatusBadge status={c.status} />
            <PriorityBadge priority={c.priority} />
            <span className="text-ink-faint">·</span>
            <span>{c.client_name}</span>
          </span>
        }
        actions={
          <>
            {canFileSuit && (
              <Button
                variant="secondary"
                disabled={!fileSuitReady}
                title={!fileSuitReady ? 'Complete scrutiny before filing the suit' : undefined}
                onClick={() => setFilingSuit(true)}
              >
                <FileSignature className="size-4" /> File suit
              </Button>
            )}
            {c.status !== 'draft' && (
              <Button variant="secondary" onClick={() => navigate(`/cases/${caseId}/view-case-details`)}>
                <FileSearch className="size-4" /> View case details
              </Button>
            )}
            {canLinkCnr && (
              <Button
                variant="secondary"
                disabled={!cnrStageReady}
                title={!cnrStageReady ? 'File the suit before linking a CNR' : undefined}
                onClick={() => setLinkingCnr(true)}
              >
                <Link2 className="size-4" /> Link CNR
              </Button>
            )}
            {hasPermission('cases', 'assign') && c.status !== 'closed' && (
              <Button variant="secondary" onClick={() => setAssigning(true)}>
                <UserPlus className="size-4" /> Assign
              </Button>
            )}
            {canReassign && (
              <Button variant="secondary" onClick={() => setReassigning(true)}>
                <UserCog className="size-4" /> Reassign
              </Button>
            )}
            {hasPermission('cases', 'update') && c.status !== 'closed' && (
              <Button variant="secondary" onClick={() => setEditing(true)}>
                <Pencil className="size-4" /> Edit
              </Button>
            )}
            {hasPermission('cases', 'delete') && (
              <Button variant="ghost" aria-label="Delete case" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="size-4 text-danger" />
              </Button>
            )}
          </>
        }
      />

      <div className="mb-5">
        <CaseLifecycleTracker
          c={c}
          documents={documents ?? []}
          onRequestFileSuit={() => setFilingSuit(true)}
          onRequestLinkCnr={() => setLinkingCnr(true)}
        />
      </div>

      <Card className="mb-5">
        <CardHeader
          title="Documents"
          description={`${fileDocuments?.length ?? 0} file${fileDocuments?.length === 1 ? '' : 's'}`}
          action={
            c.status !== 'closed' && (
              <Button size="sm" variant="secondary" onClick={() => setUploading(true)}>
                <Plus className="size-4" /> Upload
              </Button>
            )
          }
        />
        <CardBody className="border-t border-border">
          {c.status === 'closed' && (
            <p className="mb-3 text-sm text-ink-muted">
              Documents are locked — this case is closed.
            </p>
          )}
          {docTabs.length > 1 && (
            <Tabs
              className="mb-3"
              tabs={[{ value: 'all', label: 'All' }, ...docTabs.map((t) => ({ value: t.key, label: t.label }))]}
              value={docTab}
              onChange={(v) => setDocTab(v as typeof docTab)}
            />
          )}
          {!shownDocuments || shownDocuments.length === 0 ? (
            <p className="text-sm text-ink-muted">No documents attached yet.</p>
          ) : (
            <ul className="space-y-2">
              {shownDocuments.map((doc) => {
                const latest = doc.latest_version
                const isOpen = expandedDoc === doc.id
                const docStage = STAGE_FOR_DOC_TYPE[doc.doc_type]
                const exitedAt = docStage ? stageExitedAt(c.lifecycle_history, docStage) : null
                const addedLater =
                  exitedAt != null &&
                  doc.first_version_uploaded_at != null &&
                  doc.first_version_uploaded_at > exitedAt
                return (
                  <li key={doc.id} className="rounded-control bg-surface-muted text-sm">
                    <div className="flex items-center gap-2.5 px-3.5 py-2.5">
                      <button
                        type="button"
                        onClick={() => setExpandedDoc(isOpen ? null : doc.id)}
                        aria-label="Toggle versions"
                        className="text-ink-muted hover:text-ink"
                      >
                        {isOpen ? (
                          <ChevronDown className="size-4" />
                        ) : (
                          <ChevronRight className="size-4" />
                        )}
                      </button>
                      <FileText className="size-4 shrink-0 text-ink-muted" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-ink">{doc.title}</p>
                        {latest && (
                          <p className="text-xs text-ink-faint">
                            {formatBytes(latest.file_size_bytes)} · {doc.version_count} version
                            {doc.version_count === 1 ? '' : 's'} · {doc.uploaded_by_name},{' '}
                            {formatDateTime(latest.uploaded_at)}
                          </p>
                        )}
                      </div>
                      {addedLater && docStage && (
                        <span title={`Added after ${DOC_TAB_LABELS[docStage]} was already completed`}>
                          <Badge tone="warning">Added later</Badge>
                        </span>
                      )}
                      {latest && (
                        <Badge tone={SCAN_TONE[latest.virus_scan_status] ?? 'neutral'}>
                          {humanize(latest.virus_scan_status)}
                        </Badge>
                      )}
                      {latest && (
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`View ${doc.title}`}
                            onClick={() =>
                              setPreviewTarget({
                                load: () => loadDocumentBlob(latest.storage_key),
                                mimeType: latest.mime_type,
                                title: doc.title,
                              })
                            }
                          >
                            <Eye className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Download ${doc.title}`}
                            onClick={() => downloadDocument(latest.storage_key)}
                          >
                            <Download className="size-4" />
                          </Button>
                          {c.status !== 'closed' && (
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`Add version to ${doc.title}`}
                              onClick={() => setVersionFor(doc.id)}
                            >
                              <FilePlus2 className="size-4" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                    {isOpen && (
                      <div className="border-t border-border/60 px-3.5 py-2.5">
                        <VersionHistory
                          documentId={doc.id}
                          docTitle={doc.title}
                          isOpen={isOpen}
                          rollbackPending={rollback.isPending}
                          onRollback={(versionId) => rollback.mutate({ docId: doc.id, versionId })}
                          onPreview={setPreviewTarget}
                          onDownload={downloadDocument}
                        />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Details" />
            <CardBody className="border-t border-border">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                <Detail label="Case type" value={c.case_type} />
                <Detail label="Court" value={courtLabel(c.court_jurisdiction)} />
                <Detail label="Region" value={c.region} />
                {c.cnr && <Detail label="CNR" value={c.cnr} />}
                <Detail label="Filing date" value={formatDate(c.filing_date)} />
                <Detail label="Hearing date" value={formatDate(c.hearing_date)} />
                <Detail label="Created" value={formatDate(c.created_at)} />
                <Detail label="Owner" value={nameOf(c.created_by)} />
                <Detail
                  label="Assignees"
                  value={
                    c.assigned_user_ids.length === 0
                      ? '—'
                      : c.assigned_user_ids.map(nameOf).join(', ')
                  }
                />
                {c.reviewed_by && (
                  <Detail
                    label="Reviewed by"
                    value={`${nameOf(c.reviewed_by)} · ${formatDateTime(c.reviewed_at)}`}
                  />
                )}
                {c.approved_by && (
                  <Detail
                    label="Approved by"
                    value={`${nameOf(c.approved_by)} · ${formatDateTime(c.approved_at)}`}
                  />
                )}
                {c.rejected_by && (
                  <Detail
                    label="Rejected by"
                    value={`${nameOf(c.rejected_by)} · ${formatDateTime(c.rejected_at)}`}
                  />
                )}
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
              action={
                <Link
                  to={`/cases/${caseId}/history`}
                  className="text-sm font-medium text-brand hover:text-brand-strong"
                >
                  View full history
                </Link>
              }
            />
            <CardBody className="border-t border-border">
              <p className="mb-3 text-sm text-ink-muted">
                Comments, mentions, attachments, and status changes for this case.
              </p>
              <Button
                variant="secondary"
                className="w-full justify-center"
                onClick={() => navigate(`/cases/${caseId}/thread`)}
              >
                <MessageSquarePlus className="size-4" /> Open thread
              </Button>
            </CardBody>
          </Card>
        </div>

        {hasPermission('cases', 'update') && (
        <Card className="h-fit">
          <CardHeader
            title="Internal review status"
            description="Firm-side review/approval workflow — separate from the litigation stage above"
          />
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
                  <div className="flex flex-wrap gap-2">
                    {allowed.map((s) => {
                      const needsAssignee = s === 'assigned' && c.assigned_user_ids.length === 0
                      // Re-entering in_progress from approved/closed is a re-hearing -
                      // the court re-listed the matter, so the internal workflow cycles
                      // back rather than needing a dedicated status.
                      const isRehearing =
                        s === 'in_progress' && (c.status === 'approved' || c.status === 'closed')
                      const label = isRehearing ? 'Re-hearing' : humanize(s)
                      const tone = isRehearing ? 'warning' : STATUS_TONE[s]
                      return (
                        <button
                          key={s}
                          type="button"
                          disabled={needsAssignee}
                          title={needsAssignee ? 'Assign someone to this case first' : undefined}
                          onClick={() => setNextStatus(s)}
                          className={cn(
                            'rounded-control border px-3 py-1.5 text-sm font-medium transition',
                            TONES[tone],
                            needsAssignee
                              ? 'cursor-not-allowed opacity-40'
                              : nextStatus === s
                                ? 'ring-2 ring-brand ring-offset-1'
                                : 'opacity-70 hover:opacity-100',
                          )}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
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
        )}
      </div>

      {editing && <EditCaseDialog open onClose={() => setEditing(false)} caseRecord={c} />}

      <AssignDialog
        open={assigning}
        onClose={() => setAssigning(false)}
        caseIds={[caseId]}
        initialSelected={c.assigned_user_ids}
        onDone={() => {}}
      />

      <ReassignDialog
        open={reassigning}
        onClose={() => setReassigning(false)}
        caseId={caseId}
        onDone={() => {}}
      />

      {uploading && (
        <UploadDialog mode="new" caseId={caseId} open onClose={() => setUploading(false)} />
      )}

      {versionFor && (
        <UploadDialog
          mode="version"
          documentId={versionFor}
          caseId={caseId}
          open
          onClose={() => setVersionFor(null)}
        />
      )}

      <DocumentPreviewDialog
        open={!!previewTarget}
        onClose={() => setPreviewTarget(null)}
        target={previewTarget}
      />

      <LinkCnrDialog open={linkingCnr} onClose={() => setLinkingCnr(false)} caseId={caseId} />

      <FileSuitDialog open={filingSuit} onClose={() => setFilingSuit(false)} caseId={caseId} />

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
