import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Eye, RefreshCw, X } from 'lucide-react'
import {
  addCaseHistory,
  addCaseParty,
  deleteCaseHistory,
  deleteCaseParty,
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
import { Input, Select } from '@/components/ui/Field'
import { DatePicker } from '@/components/ui/DatePicker'
import { ErrorState, LoadingState } from '@/components/ui/Feedback'
import { DocumentPreviewDialog, type PreviewTarget } from '@/components/ui/DocumentPreviewDialog'
import {
  cellValue,
  RawSection,
  SectionCard,
  type BusinessDetailActions,
  type OrderActions,
} from './CaseDocumentSections'
import { ManualDocumentDialog } from './ManualDocumentDialog'
import type { CaseHistoryEntry, CaseParty } from '@/types'

/** Manual cases have nothing to show here until a party/hearing is added by hand - this
 * page (not the creation wizard) is where that happens, any time after filing, since
 * neither is known until the suit actually exists. */
function PartiesSection({ caseId, parties }: { caseId: string; parties: CaseParty[] }) {
  const queryClient = useQueryClient()
  const [role, setRole] = useState('petitioner')
  const [name, setName] = useState('')
  const [advocate, setAdvocate] = useState('')

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: qk.caseFullDetails(caseId) })
    queryClient.invalidateQueries({ queryKey: qk.caseDetail(caseId) })
  }

  const addMutation = useMutationWithToast({
    mutationFn: () => addCaseParty(caseId, { role, name, advocate_name: advocate || null }),
    onSuccess: () => {
      invalidate()
      setName('')
      setAdvocate('')
    },
    errorFallback: 'Could not add party.',
  })

  const deleteMutation = useMutationWithToast({
    mutationFn: (partyId: string) => deleteCaseParty(caseId, partyId),
    onSuccess: invalidate,
    errorFallback: 'Could not remove party.',
  })

  return (
    <SectionCard title={`Parties${parties.length ? ` (${parties.length})` : ''}`}>
      {parties.length === 0 ? (
        <p className="mb-3 text-sm text-ink-muted">None added yet.</p>
      ) : (
        <ul className="mb-3 space-y-1.5">
          {parties.map((p) => (
            <li key={p.id} className="flex items-center justify-between text-sm text-ink-muted">
              <span>
                <span className="font-medium text-ink">{p.name}</span> — {p.role}
                {p.advocate_name && ` (adv. ${p.advocate_name})`}
              </span>
              <button
                type="button"
                aria-label={`Remove ${p.name}`}
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(p.id)}
                className="text-ink-faint hover:text-danger"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-2 sm:grid-cols-[1fr_1.5fr_1.5fr_auto]">
        <Select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="petitioner">Petitioner</option>
          <option value="respondent">Respondent</option>
          <option value="objector">Objector</option>
          <option value="other">Other</option>
        </Select>
        <Input placeholder="Party name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          placeholder="Advocate (optional)"
          value={advocate}
          onChange={(e) => setAdvocate(e.target.value)}
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={!name.trim()}
          loading={addMutation.isPending}
          onClick={() => addMutation.mutate()}
        >
          Add
        </Button>
      </div>
    </SectionCard>
  )
}

function ManualHistorySection({ caseId, history }: { caseId: string; history: CaseHistoryEntry[] }) {
  const queryClient = useQueryClient()
  const [purpose, setPurpose] = useState('')
  const [date, setDate] = useState('')
  const [nextDate, setNextDate] = useState('')
  const [judge, setJudge] = useState('')
  const [disposal, setDisposal] = useState(false)

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: qk.caseFullDetails(caseId) })
    queryClient.invalidateQueries({ queryKey: qk.caseDetail(caseId) })
  }

  const addMutation = useMutationWithToast({
    mutationFn: () =>
      addCaseHistory(caseId, {
        purpose: purpose || null,
        hearing_date: date || null,
        next_hearing_date: nextDate || null,
        judge: judge || null,
        is_disposal: disposal,
      }),
    onSuccess: () => {
      invalidate()
      setPurpose('')
      setDate('')
      setNextDate('')
      setJudge('')
      setDisposal(false)
    },
    errorFallback: 'Could not add hearing.',
  })

  const deleteMutation = useMutationWithToast({
    mutationFn: (historyId: string) => deleteCaseHistory(caseId, historyId),
    onSuccess: invalidate,
    errorFallback: 'Could not remove hearing entry.',
  })

  return (
    <SectionCard title={`Hearing history${history.length ? ` (${history.length})` : ''}`}>
      {history.length === 0 ? (
        <p className="mb-3 text-sm text-ink-muted">None added yet.</p>
      ) : (
        <ul className="mb-3 space-y-1.5">
          {history.map((h) => (
            <li key={h.id} className="flex items-center justify-between text-sm text-ink-muted">
              <span>
                {formatDate(h.hearing_date)} — {h.purpose || 'Hearing'}
                {h.judge && ` · ${h.judge}`}
                {h.next_hearing_date && ` (next: ${formatDate(h.next_hearing_date)})`}
                {h.is_disposal && (
                  <>
                    {' '}
                    <Badge tone="neutral">disposed</Badge>
                  </>
                )}
              </span>
              <button
                type="button"
                aria-label="Remove hearing entry"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(h.id)}
                className="text-ink-faint hover:text-danger"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          placeholder="Purpose (e.g. Arguments)"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
        />
        <Input placeholder="Judge (optional)" value={judge} onChange={(e) => setJudge(e.target.value)} />
        <DatePicker value={date} onChange={setDate} placeholder="Hearing date" />
        <DatePicker value={nextDate} onChange={setNextDate} placeholder="Next date" />
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          <input type="checkbox" checked={disposal} onChange={(e) => setDisposal(e.target.checked)} />
          Case disposed at this hearing
        </label>
      </div>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="mt-2"
        loading={addMutation.isPending}
        onClick={() => addMutation.mutate()}
      >
        Add hearing entry
      </Button>
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

  const orderActions: OrderActions = {
    download: (orderId) => downloadCnrOrder(caseId, orderId),
    loadBlob: (orderId) => loadCnrOrderBlob(caseId, orderId),
    onDownloaded: () => queryClient.invalidateQueries({ queryKey: qk.caseFullDetails(caseId) }),
  }
  const businessDetailActions: BusinessDetailActions = {
    queryKey: (section, row) => qk.cnrBusinessDetail(caseId, section, row),
    fetch: (section, row) => getCnrBusinessDetail(caseId, section, row),
  }

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
            <RawSection
              key={i}
              section={section}
              onPreview={setPreviewTarget}
              orderActions={orderActions}
              businessDetailActions={businessDetailActions}
            />
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

          <PartiesSection caseId={caseId} parties={data.manual.parties} />

          <ManualHistorySection caseId={caseId} history={data.manual.history} />

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
            <RawSection
              key={i}
              section={section}
              onPreview={setPreviewTarget}
              orderActions={orderActions}
              businessDetailActions={businessDetailActions}
            />
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
        </div>
      ) : (
        <p className="text-sm text-ink-muted">No details added yet.</p>
      )}

      {/* Shared across both the CNR and manual branches above - was previously mounted
          only inside the manual branch, so "View" on a CNR case's orders/history set
          previewTarget with nothing rendering it. */}
      <DocumentPreviewDialog
        open={!!previewTarget}
        onClose={() => setPreviewTarget(null)}
        target={previewTarget}
      />
    </div>
  )
}
