import { Fragment, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Download, Eye, Loader2 } from 'lucide-react'
import { useMutationWithToast } from '@/lib/useMutationWithToast'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { PreviewTarget } from '@/components/ui/DocumentPreviewDialog'
import type { CnrBusinessDetailResponse, CnrOrderDownloadResponse } from '@/types'
import { cn } from '@/lib/cn'

/** Generic renderer for the extractor's "section document" shape (key_value/grid/
 * orders/history/raw) - shared by CaseFullDetailsPage (a linked case) and
 * CnrLookupPage (standalone, no case). Neither hardcodes an API call: the order-
 * download/business-detail data access is supplied by the caller via
 * OrderActions/BusinessDetailActions, since the two pages hit different (case-scoped
 * vs standalone) backend routes for the same interaction. Omitting an actions prop
 * degrades that section type to a plain read-only table. */

// eslint-disable-next-line react-refresh/only-export-components
export function cellValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export interface OrderActions {
  download: (orderId: string) => Promise<CnrOrderDownloadResponse>
  loadBlob: (orderId: string) => Promise<Blob>
  /** Fired after a successful download - lets the caller invalidate whatever query
   * caches a "downloaded" flag for this order (only CaseFullDetailsPage has one). */
  onDownloaded?: () => void
}

export interface BusinessDetailActions {
  queryKey: (sectionKey: string, row: number) => readonly unknown[]
  fetch: (sectionKey: string, row: number) => Promise<CnrBusinessDetailResponse>
}

export function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
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
  rows,
  onPreview,
  actions,
}: {
  rows: Record<string, unknown>[]
  onPreview: (target: PreviewTarget) => void
  actions: OrderActions
}) {
  const { toast } = useToast()
  const downloadMutation = useMutationWithToast({
    mutationFn: (orderId: string) => actions.download(orderId),
    onSuccess: (resp) => {
      if (resp.status === 'ready' && resp.download_url) {
        window.open(resp.download_url, '_blank', 'noopener')
        // The "downloaded" flag just flipped server-side - refetch so the badge/label
        // reflect it instead of showing stale "Not downloaded" until a page reload.
        actions.onDownloaded?.()
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
                        load: () => actions.loadBlob(row.order_id as string),
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

function BusinessDetailPanel({
  sectionKey,
  row,
  actions,
}: {
  sectionKey: string
  row: number
  actions: BusinessDetailActions
}) {
  const queryClient = useQueryClient()
  const queryKey = actions.queryKey(sectionKey, row)
  const [attempt, setAttempt] = useState(0)
  // Skip the artificial delay when we already fetched this exact row earlier in the
  // session (collapsing and re-expanding shouldn't feel like a fresh fetch each time).
  const [minDelayDone, setMinDelayDone] = useState(() => queryClient.getQueryData(queryKey) !== undefined)
  const { data, isFetching, isError, refetch } = useQuery({
    queryKey,
    queryFn: () => actions.fetch(sectionKey, row),
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
function HistorySection({
  sectionKey,
  rows,
  actions,
}: {
  sectionKey: string
  rows: Record<string, unknown>[]
  actions: BusinessDetailActions
}) {
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
                        <BusinessDetailPanel sectionKey={sectionKey} row={i} actions={actions} />
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

/** orderActions/businessDetailActions/onPreview are optional: omit them and orders/
 * history sections fall back to a plain read-only table (e.g. a caller with no
 * download/preview affordance to offer yet). */
export function RawSection({
  section,
  onPreview,
  orderActions,
  businessDetailActions,
}: {
  section: Record<string, unknown>
  onPreview?: (target: PreviewTarget) => void
  orderActions?: OrderActions
  businessDetailActions?: BusinessDetailActions
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
      ) : type === 'orders' && orderActions && onPreview ? (
        <OrdersSection rows={rows} onPreview={onPreview} actions={orderActions} />
      ) : type === 'history' && businessDetailActions ? (
        <HistorySection sectionKey={section.key as string} rows={rows} actions={businessDetailActions} />
      ) : (
        <RawRowsTable rows={rows} />
      )}
    </SectionCard>
  )
}
