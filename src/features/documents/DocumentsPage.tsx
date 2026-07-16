import { Fragment, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  FilePlus2,
  FileText,
  Paperclip,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import {
  deleteDocument,
  downloadDocument,
  getDocument,
  listDocuments,
  loadDocumentBlob,
  rollbackVersion,
} from '@/lib/api/documents'
import { qk } from '@/lib/queryKeys'
import { formatBytes, formatDateTime, humanize } from '@/lib/format'
import { useAuth } from '@/auth/AuthContext'
import { useMutationWithToast } from '@/lib/useMutationWithToast'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { CaseCombobox } from '@/components/ui/CaseCombobox'
import { Badge, type Tone } from '@/components/ui/Badge'
import { Table, TBody, Td, Th, THead, TableWrap, Tr } from '@/components/ui/Table'
import { EmptyState, ErrorState, LoadingState, Spinner } from '@/components/ui/Feedback'
import { Dialog } from '@/components/ui/Dialog'
import { DocumentPreviewDialog, type PreviewTarget } from '@/components/ui/DocumentPreviewDialog'
import { UploadDialog } from './UploadDialog'

const HIDDEN_DOC_TYPES = new Set(['comment_attachment', 'final_order_attachment'])

export const SCAN_TONE: Record<string, Tone> = {
  clean: 'success',
  pending: 'warning',
  infected: 'danger',
}

export default function DocumentsPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { isManagingDirector, isBranchAdmin } = useAuth()
  const isAdmin = isManagingDirector || isBranchAdmin
  const [caseId, setCaseId] = useState('')
  const [title, setTitle] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [uploadNew, setUploadNew] = useState(false)
  const [versionFor, setVersionFor] = useState<{ id: string; caseId: string } | null>(null)
  const [showHiddenSection, setShowHiddenSection] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget | null>(null)

  const filters = useMemo(
    () => ({ case_id: caseId || undefined, title: title || undefined }),
    [caseId, title],
  )
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: qk.documents(filters),
    queryFn: () => listDocuments(filters),
  })

  const rollback = useMutationWithToast({
    mutationFn: ({ docId, versionId }: { docId: string; versionId: string }) =>
      rollbackVersion(docId, versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      toast('Rolled back to selected version.', 'success')
    },
    errorFallback: 'Rollback failed.',
  })

  const deleteMutation = useMutationWithToast({
    mutationFn: (documentId: string) => deleteDocument(documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      toast('File deleted.', 'success')
      setDeleteTarget(null)
    },
    errorFallback: 'Could not delete file.',
  })

  async function handleDownload(storageKey: string) {
    try {
      await downloadDocument(storageKey)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Download failed.', 'error')
    }
  }

  // Comment/final-order attachments live in their own context (the case thread, the
  // manual case document) - the main table never shows them; admins get a separate,
  // simpler list below for finding and cleaning up orphaned uploads.
  const docs = (data ?? []).filter((doc) => !HIDDEN_DOC_TYPES.has(doc.doc_type))
  const hiddenDocs = (data ?? []).filter((doc) => HIDDEN_DOC_TYPES.has(doc.doc_type))

  return (
    <div className="animate-rise">
      <PageHeader
        title="Documents"
        description="Versioned, virus-scanned case files."
        actions={
          <Button onClick={() => setUploadNew(true)}>
            <Plus className="size-4" /> Upload
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="sm:w-64">
          <CaseCombobox
            value={caseId}
            onChange={(option) => setCaseId(option?.id ?? '')}
            clearLabel="All cases"
            placeholder="All cases"
          />
        </div>
        <Input
          placeholder="Filter by title…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1"
        />
      </div>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : docs.length === 0 ? (
        <TableWrap>
          <EmptyState
            icon={FileText}
            title="No documents"
            description="Upload the first file for a case."
            action={
              <Button onClick={() => setUploadNew(true)}>
                <Plus className="size-4" /> Upload
              </Button>
            }
          />
        </TableWrap>
      ) : (
        <TableWrap>
          <Table>
            <THead>
              <Tr>
                <Th className="w-8" />
                <Th>Title</Th>
                <Th>Type</Th>
                <Th>Case</Th>
                <Th>Versions</Th>
                <Th>Latest scan</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {docs.map((doc) => {
                const latest = doc.latest_version
                const isOpen = expanded === doc.id
                return (
                  <Fragment key={doc.id}>
                    <Tr className="hover:bg-surface-muted">
                      <Td>
                        <button
                          onClick={() => setExpanded(isOpen ? null : doc.id)}
                          className="grid size-11 place-items-center rounded-control text-ink-muted hover:bg-surface-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                          aria-label="Toggle versions"
                        >
                          {isOpen ? (
                            <ChevronDown className="size-4" />
                          ) : (
                            <ChevronRight className="size-4" />
                          )}
                        </button>
                      </Td>
                      <Td className="font-medium text-ink">
                        {doc.title}
                        {doc.is_quarantined && (
                          <Badge tone="danger" className="ml-2">
                            Quarantined
                          </Badge>
                        )}
                      </Td>
                      <Td className="text-ink-muted">{humanize(doc.doc_type)}</Td>
                      <Td className="text-ink-muted">{doc.case_title}</Td>
                      <Td className="tabular text-ink-muted">{doc.version_count}</Td>
                      <Td>
                        {latest && (
                          <Badge tone={SCAN_TONE[latest.virus_scan_status] ?? 'neutral'}>
                            {humanize(latest.virus_scan_status)}
                          </Badge>
                        )}
                      </Td>
                      <Td>
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Add version to ${doc.title}`}
                            onClick={() => setVersionFor({ id: doc.id, caseId: doc.case_id })}
                          >
                            <FilePlus2 className="size-4" />
                          </Button>
                          {latest && (
                            <>
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
                                onClick={() => handleDownload(latest.storage_key)}
                              >
                                <Download className="size-4" />
                              </Button>
                            </>
                          )}
                          {isAdmin && (
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`Delete ${doc.title}`}
                              onClick={() => setDeleteTarget({ id: doc.id, title: doc.title })}
                            >
                              <Trash2 className="size-4 text-danger" />
                            </Button>
                          )}
                        </div>
                      </Td>
                    </Tr>
                    {isOpen && (
                      <Tr className="bg-surface-muted/50">
                        <Td colSpan={7} className="px-4 py-3">
                          <VersionHistory
                            documentId={doc.id}
                            docTitle={doc.title}
                            isOpen={isOpen}
                            rollbackPending={rollback.isPending}
                            onRollback={(versionId) =>
                              rollback.mutate({ docId: doc.id, versionId })
                            }
                            onPreview={setPreviewTarget}
                            onDownload={handleDownload}
                          />
                        </Td>
                      </Tr>
                    )}
                  </Fragment>
                )
              })}
            </TBody>
          </Table>
        </TableWrap>
      )}

      {isAdmin && hiddenDocs.length > 0 && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setShowHiddenSection((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
          >
            {showHiddenSection ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
            Hidden & unlinked files ({hiddenDocs.length})
          </button>
          {showHiddenSection && (
            <ul className="mt-2 space-y-1.5">
              {hiddenDocs.map((doc) => {
                const latest = doc.latest_version
                return (
                  <li
                    key={doc.id}
                    className="flex items-center gap-2.5 rounded-control border border-border bg-surface-muted px-3.5 py-2.5 text-sm"
                  >
                    <Paperclip className="size-4 shrink-0 text-ink-muted" />
                    <span className="flex-1 truncate text-ink">{doc.title}</span>
                    <span className="text-ink-muted">{doc.case_title}</span>
                    {latest && (
                      <span className="text-ink-faint">
                        {doc.uploaded_by_name} · {formatDateTime(latest.uploaded_at)}
                      </span>
                    )}
                    <div className="flex gap-1">
                      {latest && (
                        <>
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
                            onClick={() => handleDownload(latest.storage_key)}
                          >
                            <Download className="size-4" />
                          </Button>
                        </>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Delete ${doc.title}`}
                        onClick={() => setDeleteTarget({ id: doc.id, title: doc.title })}
                      >
                        <Trash2 className="size-4 text-danger" />
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      <UploadDialog mode="new" open={uploadNew} onClose={() => setUploadNew(false)} />
      {versionFor && (
        <UploadDialog
          mode="version"
          documentId={versionFor.id}
          caseId={versionFor.caseId}
          open
          onClose={() => setVersionFor(null)}
        />
      )}

      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete file"
        description="This permanently removes the file and every version — it cannot be undone."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">
          Delete <span className="font-medium text-ink">{deleteTarget?.title}</span>?
        </p>
      </Dialog>

      <DocumentPreviewDialog
        open={!!previewTarget}
        onClose={() => setPreviewTarget(null)}
        target={previewTarget}
      />
    </div>
  )
}

/** Full version history - fetched lazily only once a row is actually expanded,
 * instead of every document's full version list riding along in the initial
 * GET /documents response whether anyone opens the row or not. */
export function VersionHistory({
  documentId,
  docTitle,
  isOpen,
  rollbackPending,
  onRollback,
  onPreview,
  onDownload,
}: {
  documentId: string
  docTitle: string
  isOpen: boolean
  rollbackPending: boolean
  onRollback: (versionId: string) => void
  onPreview: (target: PreviewTarget) => void
  onDownload: (storageKey: string) => void
}) {
  const { data, isLoading } = useQuery({
    queryKey: qk.documentDetail(documentId),
    queryFn: () => getDocument(documentId),
    enabled: isOpen,
  })

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-2 text-sm text-ink-muted">
        <Spinner /> Loading version history…
      </div>
    )
  }

  const versions = [...(data?.versions ?? [])].sort((a, b) => b.version_number - a.version_number)

  return (
    <>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
        Version history
      </p>
      <ul className="space-y-1.5">
        {versions.map((v, idx) => (
          <li
            key={v.id}
            className="flex flex-wrap items-center gap-3 rounded-control bg-surface px-3 py-2 text-sm"
          >
            <Badge tone={idx === 0 ? 'brand' : 'neutral'}>v{v.version_number}</Badge>
            <span className="text-ink-muted">{formatBytes(v.file_size_bytes)}</span>
            <span className="text-ink-muted">{v.uploaded_by_name}</span>
            <span className="text-ink-faint">{formatDateTime(v.uploaded_at)}</span>
            {v.change_note && <span className="text-ink-muted">· {v.change_note}</span>}
            <div className="ml-auto flex gap-1">
              <Button
                size="icon"
                variant="ghost"
                aria-label={`View version ${v.version_number}`}
                onClick={() =>
                  onPreview({
                    load: () => loadDocumentBlob(v.storage_key),
                    mimeType: v.mime_type,
                    title: `${docTitle} (v${v.version_number})`,
                  })
                }
              >
                <Eye className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Download version ${v.version_number}`}
                onClick={() => onDownload(v.storage_key)}
              >
                <Download className="size-4" />
              </Button>
              {idx !== 0 && (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Roll back to version ${v.version_number}`}
                  loading={rollbackPending}
                  onClick={() => onRollback(v.id)}
                >
                  <RotateCcw className="size-4" />
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
