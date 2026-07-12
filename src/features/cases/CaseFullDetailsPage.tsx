import { Fragment, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ChevronDown, ChevronRight, Download, Eye, Loader2, RefreshCw } from 'lucide-react'
import {
  downloadCnrOrder,
  getCaseFullDetails,
  getCnrBusinessDetail,
  loadCnrOrderBlob,
  refreshCaseCnr,
} from '@/lib/api/cases'
import { loadDocumentBlob } from '@/lib/api/documents'
import { qk } from '@/lib/queryKeys'
import { formatDate } from '@/lib/format'
import { useMutationWithToast } from '@/lib/useMutationWithToast'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ErrorState, LoadingState } from '@/components/ui/Feedback'
import { DocumentPreviewDialog, type PreviewTarget } from '@/components/ui/DocumentPreviewDialog'
import { ManualDocumentDialog } from './ManualDocumentDialog'
import { cn } from '@/lib/cn'

function cellValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-card border border-border">
      <div className="border-b border-border px-4 py-2.5">
        <p className="text-sm font-semibold text-brand-strong">{title}</p>
      </div>
      <div className="px-4 py-3.5">{children}</div>
    </div>
  )
}

/** Renders a list of raw eCourts rows as a table - columns come from whatever keys
 * the rows actually carry, so any court type's section shape "just works" without
 * hardcoding column names. */
function RawRowsTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (rows.length === 0) return <p className="text-sm text-ink-muted">No rows.</p>
  const columns = Object.keys(rows[0])
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-ink-faint">
            {columns.map((c) => (
              <th key={c} className="py-1.5 pr-4 font-medium">
                {c.replace(/_/g, ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/60 last:border-0 hover:bg-surface-muted/60">
              {columns.map((c) => (
                <td key={c} className="py-1.5 pr-4 align-top text-ink-muted">
                  {cellValue(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function KeyValueSection({ rows }: { rows: Record<string, unknown>[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-3">
      {rows.map((row, i) => (
        <div key={i}>
          <dt className="text-xs uppercase tracking-wide text-ink-faint">{String(row.label ?? '')}</dt>
          <dd className="mt-0.5 text-sm text-ink">{cellValue(row.value)}</dd>
        </div>
      ))}
    </dl>
  )
}

function GridSection({ columns, rows }: { columns: string[]; rows: unknown[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-ink-faint">
            {columns.map((c, i) => (
              <th key={i} className="py-1.5 pr-4 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/60 last:border-0 hover:bg-surface-muted/60">
              {row.map((cell, j) => (
                <td key={j} className="py-1.5 pr-4 text-ink-muted">
                  {cellValue(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Orders never show their order_id - it's an internal handle the extractor uses to
 * resolve a fresh download URL, not something a user needs to see. Clicking Download
 * calls through nyayops (which holds the extractor's bearer token) rather than
 * exposing that token to the browser. */
function OrdersSection({
  caseId,
  rows,
  onPreview,
}: {
  caseId: string
  rows: Record<string, unknown>[]
  onPreview: (target: PreviewTarget) => void
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const downloadMutation = useMutationWithToast({
    mutationFn: (orderId: string) => downloadCnrOrder(caseId, orderId),
    onSuccess: (resp) => {
      if (resp.status === 'ready' && resp.download_url) {
        window.open(resp.download_url, '_blank', 'noopener')
        // The "downloaded" flag just flipped server-side - refetch so the badge/label
        // reflect it instead of showing stale "Not downloaded" until a page reload.
        queryClient.invalidateQueries({ queryKey: qk.caseFullDetails(caseId) })
      } else {
        toast('The court portal is still preparing this PDF — try again shortly.', 'info')
      }
    },
    errorFallback: 'Could not fetch this order.',
  })

  if (rows.length === 0) return <p className="text-sm text-ink-muted">No orders.</p>

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-ink-faint">
            <th className="py-1.5 pr-4 font-medium">Order date</th>
            <th className="py-1.5 pr-4 font-medium">Title</th>
            <th className="py-1.5 pr-4 font-medium">Status</th>
            <th className="py-1.5 pr-4 font-medium" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/60 last:border-0 hover:bg-surface-muted/60">
              <td className="py-1.5 pr-4 text-ink-muted">{cellValue(row.order_date)}</td>
              <td className="py-1.5 pr-4 text-ink">{cellValue(row.order_title)}</td>
              <td className="py-1.5 pr-4">
                <Badge tone={row.downloaded ? 'success' : 'neutral'}>
                  {row.downloaded ? 'Downloaded' : 'Not downloaded'}
                </Badge>
              </td>
              <td className="py-1.5 pr-4">
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      onPreview({
                        load: () => loadCnrOrderBlob(caseId, row.order_id as string),
                        mimeType: 'application/pdf',
                        title: cellValue(row.order_title),
                      })
                    }
                  >
                    <Eye className="size-3.5" /> View
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={downloadMutation.isPending && downloadMutation.variables === row.order_id}
                    onClick={() => downloadMutation.mutate(row.order_id as string)}
                  >
                    <Download className="size-3.5" /> Download
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Skip fields that just repeat what's already shown at the top of the page or in
 * this same row - the business text itself and the hearing/coram fields are the only
 * new information a business-detail expansion adds. */
const BUSINESS_DETAIL_SKIP_FIELDS = new Set([
  'cnr_number',
  'court_name',
  'petitioner',
  'respondent',
  'case_number',
])

function BusinessDetailFields({ detail }: { detail: Record<string, unknown> }) {
  const entries = Object.entries(detail).filter(([key]) => !BUSINESS_DETAIL_SKIP_FIELDS.has(key))
  if (entries.length === 0) {
    return <p className="text-sm text-ink-muted">No business detail recorded for this hearing.</p>
  }
  return (
    <dl className="space-y-2.5">
      {entries.map(([key, value]) => (
        <div key={key}>
          <dt className="text-xs uppercase tracking-wide text-ink-faint">{key.replace(/_/g, ' ')}</dt>
          <dd className="mt-0.5 whitespace-pre-line text-sm text-ink">{cellValue(value)}</dd>
        </div>
      ))}
    </dl>
  )
}

/** A response this fast (a plain HTTP round trip) flashing "still fetching, try again"
 * the instant you click reads as broken, even though it's technically accurate - so
 * hold the spinner for a minimum stretch before revealing any result, queued or not. */
const MIN_SPINNER_MS = 2500

function BusinessDetailPanel({ caseId, sectionKey, row }: { caseId: string; sectionKey: string; row: number }) {
  const queryClient = useQueryClient()
  const queryKey = qk.cnrBusinessDetail(caseId, sectionKey, row)
  const [attempt, setAttempt] = useState(0)
  // Skip the artificial delay when we already fetched this exact row earlier in the
  // session (collapsing and re-expanding shouldn't feel like a fresh fetch each time).
  const [minDelayDone, setMinDelayDone] = useState(() => queryClient.getQueryData(queryKey) !== undefined)
  const { data, isFetching, isError, refetch } = useQuery({
    queryKey,
    queryFn: () => getCnrBusinessDetail(caseId, sectionKey, row),
    // Once fetched (ready, queued, or failed), don't silently re-hit the extractor
    // just because the row was collapsed and re-expanded - only "Check again" should.
    staleTime: Infinity,
  })

  useEffect(() => {
    // A no-op if minDelayDone is already true (cache hit on mount) - only a genuinely
    // fresh fetch (attempt 0, nothing cached) or an explicit "Check again" needs this.
    const timer = setTimeout(() => setMinDelayDone(true), MIN_SPINNER_MS)
    return () => clearTimeout(timer)
  }, [attempt])

  function checkAgain() {
    setMinDelayDone(false)
    setAttempt((a) => a + 1)
    refetch()
  }

  if (isFetching || !minDelayDone) {
    return (
      <div className="flex items-center gap-2 text-sm text-ink-muted">
        <Loader2 className="size-4 animate-spin" /> Fetching business detail…
      </div>
    )
  }
  if (isError) {
    return <p className="text-sm text-danger">Could not fetch business detail.</p>
  }
  if (data?.status === 'queued') {
    return (
      <div className="flex items-center justify-between gap-3 text-sm text-ink-muted">
        <span>The court portal is still fetching this — try again in a moment.</span>
        <Button size="sm" variant="secondary" onClick={checkAgain}>
          Check again
        </Button>
      </div>
    )
  }
  if (data?.status === 'failed') {
    return (
      <div className="flex items-center justify-between gap-3 text-sm text-ink-muted">
        <span>No business detail is available for this hearing right now.</span>
        {data.error?.retryable && (
          <Button size="sm" variant="secondary" onClick={checkAgain}>
            Check again
          </Button>
        )}
      </div>
    )
  }
  const detail = data?.business_detail
  if (!detail || Object.keys(detail).length === 0) {
    return <p className="text-sm text-ink-muted">No business detail recorded for this hearing.</p>
  }
  return <BusinessDetailFields detail={(detail.parsed as Record<string, unknown>) ?? detail} />
}

/** History rows with a Daily Status link are expandable - clicking fetches the
 * per-hearing business detail from the extractor on demand (it isn't included in the
 * case payload up front). */
function HistorySection({ caseId, sectionKey, rows }: { caseId: string; sectionKey: string; rows: Record<string, unknown>[] }) {
  const [expandedRow, setExpandedRow] = useState<number | null>(null)
  if (rows.length === 0) return <p className="text-sm text-ink-muted">No hearing history.</p>

  const HIDDEN_COLUMNS = new Set(['has_daily_status', 'business_detail', 'business_detail_error'])
  const columns = Object.keys(rows[0]).filter((c) => !HIDDEN_COLUMNS.has(c))

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-ink-faint">
            <th className="w-6 py-1.5" />
            {columns.map((c) => (
              <th key={c} className="py-1.5 pr-4 font-medium">
                {c.replace(/_/g, ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const clickable =
              Boolean(row.has_daily_status) ||
              (Boolean(row.business_detail) && typeof row.business_detail === 'object')
            const isExpanded = expandedRow === i
            return (
              <Fragment key={i}>
                <tr
                  onClick={() => clickable && setExpandedRow(isExpanded ? null : i)}
                  className={cn(
                    'border-b border-border/60 last:border-0',
                    clickable ? 'cursor-pointer hover:bg-surface-muted/60' : 'opacity-70',
                  )}
                >
                  <td className="py-1.5 pl-1 text-brand">
                    {clickable && (isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />)}
                  </td>
                  {columns.map((c) => (
                    <td key={c} className="py-1.5 pr-4 align-top text-ink-muted">
                      {cellValue(row[c])}
                    </td>
                  ))}
                </tr>
                {isExpanded && (
                  <tr className="border-b border-border/60 last:border-0">
                    <td colSpan={columns.length + 1} className="px-4 py-3">
                      {row.business_detail && typeof row.business_detail === 'object' ? (
                        <BusinessDetailFields
                          detail={
                            ((row.business_detail as Record<string, unknown>).parsed as
                              | Record<string, unknown>
                              | undefined) ?? (row.business_detail as Record<string, unknown>)
                          }
                        />
                      ) : (
                        <BusinessDetailPanel caseId={caseId} sectionKey={sectionKey} row={i} />
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function RawSection({
  caseId,
  section,
  onPreview,
}: {
  caseId: string
  section: Record<string, unknown>
  onPreview: (target: PreviewTarget) => void
}) {
  const type = section.type as string
  const title = (section.title as string) || (section.key as string)
  const rows = (section.rows as Record<string, unknown>[]) || []

  return (
    <SectionCard title={title}>
      {type === 'key_value' ? (
        <KeyValueSection rows={rows} />
      ) : type === 'grid' ? (
        <GridSection columns={(section.columns as string[]) || []} rows={(section.rows as unknown[][]) || []} />
      ) : type === 'orders' ? (
        <OrdersSection caseId={caseId} rows={rows} onPreview={onPreview} />
      ) : type === 'history' ? (
        <HistorySection caseId={caseId} sectionKey={section.key as string} rows={rows} />
      ) : (
        <RawRowsTable rows={rows} />
      )}
    </SectionCard>
  )
}

export default function CaseFullDetailsPage() {
  const { caseId = '' } = useParams()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [manualDocOpen, setManualDocOpen] = useState(false)
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget | null>(null)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: qk.caseFullDetails(caseId),
    queryFn: () => getCaseFullDetails(caseId),
  })

  const refreshMutation = useMutationWithToast({
    mutationFn: () => refreshCaseCnr(caseId),
    onSuccess: (resp) => {
      if (resp.status === 'pending') {
        toast('Still fetching from the court portal — try again shortly.', 'info')
        return
      }
      queryClient.invalidateQueries({ queryKey: qk.caseFullDetails(caseId) })
      queryClient.invalidateQueries({ queryKey: qk.caseDetail(caseId) })
      toast('Refreshed from the court portal.', 'success')
    },
    errorFallback: 'Could not refresh from CNR.',
  })

  return (
    <div className="animate-rise">
      <Link
        to={`/cases/${caseId}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-brand"
      >
        <ArrowLeft className="size-4" /> Case
      </Link>

      <PageHeader
        title="Case details"
        description={
          data?.source === 'cnr'
            ? 'Exactly as fetched from the court portal.'
            : 'Entered manually for this organization.'
        }
        actions={
          data?.source === 'cnr' && (
            <Button
              variant="secondary"
              loading={refreshMutation.isPending}
              onClick={() => refreshMutation.mutate()}
            >
              <RefreshCw className="size-4" /> Refresh from CNR
            </Button>
          )
        }
      />

      {isLoading ? (
        <LoadingState />
      ) : isError || !data ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : data.source === 'cnr' && data.raw ? (
        <div className="mx-auto max-w-5xl space-y-5">
          <div className="rounded-card border border-brand/20 bg-brand-soft px-5 py-4">
            <p className="text-base font-semibold text-brand-strong">
              {cellValue(data.raw.case_type)} · {cellValue(data.raw.registration_number)}
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-4">
              <div>
                <dt className="text-xs uppercase tracking-wide text-brand-strong/70">CNR</dt>
                <dd className="mt-0.5 text-sm text-ink">{cellValue(data.raw.cnr)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-brand-strong/70">Court type</dt>
                <dd className="mt-0.5 text-sm text-ink">{cellValue(data.raw.court_type)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-brand-strong/70">Status</dt>
                <dd className="mt-0.5 text-sm text-ink">
                  {cellValue(data.raw.current_status)}
                  {data.raw.current_stage ? ` (${cellValue(data.raw.current_stage)})` : ''}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-brand-strong/70">Judge</dt>
                <dd className="mt-0.5 text-sm text-ink">{cellValue(data.raw.current_judge)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-brand-strong/70">Filing date</dt>
                <dd className="mt-0.5 text-sm text-ink">{formatDate(data.raw.filing_date as string | null)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-brand-strong/70">Next hearing</dt>
                <dd className="mt-0.5 text-sm text-ink">
                  {formatDate(data.raw.next_hearing_date as string | null)}
                </dd>
              </div>
            </dl>
          </div>

          {((data.raw.document as Record<string, unknown> | undefined)?.sections as
            | Record<string, unknown>[]
            | undefined)?.map((section, i) => (
            <RawSection key={i} caseId={caseId} section={section} onPreview={setPreviewTarget} />
          )) ?? <p className="text-sm text-ink-muted">No portal document captured yet.</p>}
        </div>
      ) : data.manual ? (
        <div className="mx-auto max-w-5xl space-y-5">
          <div className="rounded-card border border-brand/20 bg-brand-soft px-5 py-4">
            <p className="text-base font-semibold text-brand-strong">
              {data.manual.case_type} · {data.manual.court_jurisdiction}
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-4">
              <div>
                <dt className="text-xs uppercase tracking-wide text-brand-strong/70">Client</dt>
                <dd className="mt-0.5 text-sm text-ink">{data.manual.client_name}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-brand-strong/70">Region</dt>
                <dd className="mt-0.5 text-sm text-ink">{data.manual.region}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-brand-strong/70">Court type</dt>
                <dd className="mt-0.5 text-sm text-ink">{cellValue(data.manual.court_type)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-brand-strong/70">Status</dt>
                <dd className="mt-0.5 text-sm text-ink">{cellValue(data.manual.case_stage)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-brand-strong/70">Filing date</dt>
                <dd className="mt-0.5 text-sm text-ink">{formatDate(data.manual.filing_date)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-brand-strong/70">Hearing date</dt>
                <dd className="mt-0.5 text-sm text-ink">{formatDate(data.manual.hearing_date)}</dd>
              </div>
            </dl>
          </div>

          <SectionCard title={`Parties${data.manual.parties.length ? ` (${data.manual.parties.length})` : ''}`}>
            {data.manual.parties.length === 0 ? (
              <p className="text-sm text-ink-muted">None added yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {data.manual.parties.map((p) => (
                  <li key={p.id} className="text-sm text-ink-muted">
                    <span className="font-medium text-ink">{p.name}</span> — {p.role}
                    {p.advocate_name && ` (adv. ${p.advocate_name})`}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title={`Hearing history${data.manual.history.length ? ` (${data.manual.history.length})` : ''}`}>
            {data.manual.history.length === 0 ? (
              <p className="text-sm text-ink-muted">None added yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {data.manual.history.map((h) => (
                  <li key={h.id} className="text-sm text-ink-muted">
                    {formatDate(h.hearing_date)} — {h.purpose || 'Hearing'}
                    {h.judge && ` · ${h.judge}`}
                    {h.next_hearing_date && ` (next: ${formatDate(h.next_hearing_date)})`}
                    {h.is_disposal && (
                      <>
                        {' '}
                        <Badge tone="neutral">disposed</Badge>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">
              Extra portal-style detail{data.manual.document ? '' : ' (none added yet)'}
            </p>
            <Button variant="secondary" size="sm" onClick={() => setManualDocOpen(true)}>
              {data.manual.document ? 'Edit' : 'Add'} case document
            </Button>
          </div>
          <p className="text-xs text-ink-muted">
            Optional fallback for when the CNR portal can't be scraped — Case Details, Case
            Status, Acts, Sub Matters, and Final Orders, entered by hand.
          </p>
          {data.manual.document_sections.map((section, i) => (
            <RawSection key={i} caseId={caseId} section={section} onPreview={setPreviewTarget} />
          ))}

          {data.manual.document && data.manual.document.final_orders.length > 0 && (
            <SectionCard
              title={`Final orders / judgements (${data.manual.document.final_orders.length})`}
            >
              <ul className="space-y-1.5">
                {data.manual.document.final_orders.map((o, i) => (
                  <li key={i} className="flex items-center justify-between text-sm text-ink-muted">
                    <span>
                      {formatDate(o.order_date)} — {o.title}
                    </span>
                    {o.document_title && (
                      <button
                        type="button"
                        disabled={!o.document_storage_key}
                        onClick={() => {
                          const storageKey = o.document_storage_key
                          if (!storageKey) return
                          setPreviewTarget({
                            load: () => loadDocumentBlob(storageKey),
                            mimeType: o.document_mime_type,
                            title: o.document_title!,
                          })
                        }}
                        className="inline-flex items-center gap-1.5 rounded-control border border-border bg-surface px-2 py-1 text-xs text-ink-muted enabled:hover:text-ink disabled:opacity-60"
                        title={o.document_storage_key ? 'View' : 'Available after saving'}
                      >
                        <Eye className="size-3.5" /> {o.document_title}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          <ManualDocumentDialog
            caseId={caseId}
            open={manualDocOpen}
            onClose={() => setManualDocOpen(false)}
            initial={data.manual.document}
          />

          <DocumentPreviewDialog
            open={!!previewTarget}
            onClose={() => setPreviewTarget(null)}
            target={previewTarget}
          />
        </div>
      ) : (
        <p className="text-sm text-ink-muted">No details added yet.</p>
      )}
    </div>
  )
}
