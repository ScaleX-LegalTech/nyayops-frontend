import { Fragment, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ChevronDown,
  ChevronRight,
  Download,
  FilePlus2,
  FileText,
  Plus,
  RotateCcw,
} from 'lucide-react'
import { downloadDocument, listDocuments, rollbackVersion } from '@/lib/api/documents'
import { listCases } from '@/lib/api/cases'
import { qk } from '@/lib/queryKeys'
import { formatBytes, formatDateTime, humanize } from '@/lib/format'
import { useUsers } from '@/lib/useUsers'
import { useMutationWithToast } from '@/lib/useMutationWithToast'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { Badge, type Tone } from '@/components/ui/Badge'
import { Table, TBody, Td, Th, THead, TableWrap, Tr } from '@/components/ui/Table'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/Feedback'
import { UploadDialog } from './UploadDialog'

const SCAN_TONE: Record<string, Tone> = {
  clean: 'success',
  pending: 'warning',
  infected: 'danger',
}

export default function DocumentsPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { nameOf } = useUsers()
  const [caseId, setCaseId] = useState('')
  const [title, setTitle] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [uploadNew, setUploadNew] = useState(false)
  const [versionFor, setVersionFor] = useState<{ id: string; caseId: string } | null>(null)

  const filters = useMemo(
    () => ({ case_id: caseId || undefined, title: title || undefined }),
    [caseId, title],
  )

  const casesQuery = useQuery({ queryKey: qk.cases(), queryFn: () => listCases() })
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

  async function handleDownload(storageKey: string) {
    try {
      await downloadDocument(storageKey)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Download failed.', 'error')
    }
  }

  const docs = data ?? []
  const caseTitle = (id: string) => casesQuery.data?.find((c) => c.id === id)?.title ?? id.slice(0, 8)

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
        <Select value={caseId} onChange={(e) => setCaseId(e.target.value)} className="sm:w-64">
          <option value="">All cases</option>
          {(casesQuery.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </Select>
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
                const latest = doc.versions[doc.versions.length - 1]
                const isOpen = expanded === doc.id
                return (
                  <Fragment key={doc.id}>
                    <Tr className="hover:bg-surface-muted">
                      <Td>
                        <button
                          onClick={() => setExpanded(isOpen ? null : doc.id)}
                          className="text-ink-muted hover:text-ink"
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
                      <Td className="text-ink-muted">{caseTitle(doc.case_id)}</Td>
                      <Td className="tabular text-ink-muted">{doc.versions.length}</Td>
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
                            size="sm"
                            variant="ghost"
                            onClick={() => setVersionFor({ id: doc.id, caseId: doc.case_id })}
                          >
                            <FilePlus2 className="size-4" />
                          </Button>
                          {latest && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDownload(latest.storage_key)}
                            >
                              <Download className="size-4" />
                            </Button>
                          )}
                        </div>
                      </Td>
                    </Tr>
                    {isOpen && (
                      <Tr className="bg-surface-muted/50">
                        <Td colSpan={7} className="px-4 py-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                            Version history
                          </p>
                          <ul className="space-y-1.5">
                            {[...doc.versions]
                              .sort((a, b) => b.version_number - a.version_number)
                              .map((v, idx) => (
                                <li
                                  key={v.id}
                                  className="flex flex-wrap items-center gap-3 rounded-control bg-surface px-3 py-2 text-sm"
                                >
                                  <Badge tone={idx === 0 ? 'brand' : 'neutral'}>
                                    v{v.version_number}
                                  </Badge>
                                  <span className="text-ink-muted">{formatBytes(v.file_size_bytes)}</span>
                                  <span className="text-ink-muted">{nameOf(v.uploaded_by)}</span>
                                  <span className="text-ink-faint">{formatDateTime(v.uploaded_at)}</span>
                                  {v.change_note && (
                                    <span className="text-ink-muted">· {v.change_note}</span>
                                  )}
                                  <div className="ml-auto flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDownload(v.storage_key)}
                                    >
                                      <Download className="size-4" />
                                    </Button>
                                    {idx !== 0 && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        loading={rollback.isPending}
                                        onClick={() =>
                                          rollback.mutate({ docId: doc.id, versionId: v.id })
                                        }
                                      >
                                        <RotateCcw className="size-4" />
                                      </Button>
                                    )}
                                  </div>
                                </li>
                              ))}
                          </ul>
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
    </div>
  )
}
