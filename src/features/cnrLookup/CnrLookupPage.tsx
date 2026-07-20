import { useState, type FormEvent } from 'react'
import {
  downloadCnrLookupOrder,
  getCnrLookupBusinessDetail,
  loadCnrLookupOrderBlob,
  lookupCnr,
} from '@/lib/api/cnrLookup'
import { qk } from '@/lib/queryKeys'
import { useMutationWithToast } from '@/lib/useMutationWithToast'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { EmptyState } from '@/components/ui/Feedback'
import { DocumentPreviewDialog, type PreviewTarget } from '@/components/ui/DocumentPreviewDialog'
import { formatDate } from '@/lib/format'
import {
  cellValue,
  RawSection,
  type BusinessDetailActions,
  type OrderActions,
} from '@/features/cases/CaseDocumentSections'
import type { CnrLookupResponse } from '@/types'

export default function CnrLookupPage() {
  const [cnr, setCnr] = useState('')
  const [courtType, setCourtType] = useState('')
  const [result, setResult] = useState<CnrLookupResponse | null>(null)
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget | null>(null)

  const mutation = useMutationWithToast({
    mutationFn: () => lookupCnr(cnr.trim().toUpperCase(), courtType || undefined),
    onSuccess: (resp) => setResult(resp),
    errorFallback: 'Could not look up this CNR.',
  })

  const raw = result?.case
  const sections = (raw?.document as Record<string, unknown> | undefined)?.sections as
    | Record<string, unknown>[]
    | undefined
  const resolvedCnr = (raw?.cnr as string | undefined) ?? cnr

  const orderActions: OrderActions = {
    download: downloadCnrLookupOrder,
    loadBlob: loadCnrLookupOrderBlob,
  }
  const businessDetailActions: BusinessDetailActions = {
    queryKey: (section, row) => qk.cnrLookupBusinessDetail(resolvedCnr, section, row),
    fetch: (section, row) => getCnrLookupBusinessDetail(resolvedCnr, section, row),
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="CNR lookup"
        description="Look up any case by its CNR, straight from the court portal - not linked to any of your cases."
      />
      <Card>
        <CardBody>
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault()
              mutation.mutate()
            }}
            className="flex flex-wrap items-end gap-4"
          >
            <Field label="CNR number" required className="min-w-[240px] flex-1">
              <Input
                value={cnr}
                onChange={(e) => setCnr(e.target.value.toUpperCase())}
                placeholder="HCBM010289472025"
                required
              />
            </Field>
            <Field label="Court type" hint="Leave blank to auto-detect." className="w-48">
              <Select value={courtType} onChange={(e) => setCourtType(e.target.value)}>
                <option value="">Auto-detect</option>
                <option value="high_court">High Court</option>
                <option value="district_court">District Court</option>
              </Select>
            </Field>
            <Button type="submit" loading={mutation.isPending} disabled={!cnr.trim()}>
              {result?.status === 'queued' ? 'Check again' : 'Look up'}
            </Button>
          </form>
        </CardBody>
      </Card>

      {result?.status === 'queued' && (
        <p className="text-sm text-ink-muted">
          Still fetching from the court portal (this can take a little while, especially for
          district courts). Click "Check again" in a moment.
        </p>
      )}

      {result?.status === 'fresh' && raw && (
        <div className="mx-auto max-w-5xl space-y-5">
          <div className="rounded-card border border-brand/20 bg-brand-soft px-5 py-4">
            <p className="text-base font-semibold text-brand-strong">
              {cellValue(raw.case_type)} · {cellValue(raw.registration_number)}
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-4">
              <div>
                <dt className="text-xs uppercase tracking-wide text-brand-strong/70">CNR</dt>
                <dd className="mt-0.5 text-sm text-ink">{cellValue(raw.cnr)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-brand-strong/70">Court type</dt>
                <dd className="mt-0.5 text-sm text-ink">{cellValue(raw.court_type)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-brand-strong/70">Status</dt>
                <dd className="mt-0.5 text-sm text-ink">
                  {cellValue(raw.current_status)}
                  {raw.current_stage ? ` (${cellValue(raw.current_stage)})` : ''}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-brand-strong/70">Judge</dt>
                <dd className="mt-0.5 text-sm text-ink">{cellValue(raw.current_judge)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-brand-strong/70">Filing date</dt>
                <dd className="mt-0.5 text-sm text-ink">
                  {formatDate(raw.filing_date as string | null)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-brand-strong/70">Next hearing</dt>
                <dd className="mt-0.5 text-sm text-ink">
                  {formatDate(raw.next_hearing_date as string | null)}
                </dd>
              </div>
            </dl>
          </div>

          {sections?.length ? (
            sections.map((section, i) => (
              <RawSection
                key={i}
                section={section}
                onPreview={setPreviewTarget}
                orderActions={orderActions}
                businessDetailActions={businessDetailActions}
              />
            ))
          ) : (
            <p className="text-sm text-ink-muted">No portal document captured.</p>
          )}
        </div>
      )}

      {!result && (
        <EmptyState
          title="Enter a CNR to look it up"
          description="Works for any case, whether or not it's tracked in NyayOps."
        />
      )}

      <DocumentPreviewDialog
        open={!!previewTarget}
        onClose={() => setPreviewTarget(null)}
        target={previewTarget}
      />
    </div>
  )
}
