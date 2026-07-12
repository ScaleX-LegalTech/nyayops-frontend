import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Paperclip, X } from 'lucide-react'
import { setManualDocument } from '@/lib/api/cases'
import { confirmUpload, createUploadUrl, loadDocumentBlob, uploadFileBytes } from '@/lib/api/documents'
import { qk } from '@/lib/queryKeys'
import { useMutationWithToast } from '@/lib/useMutationWithToast'
import { useToast } from '@/components/ui/Toast'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { DatePicker } from '@/components/ui/DatePicker'
import { DocumentPreviewDialog, type PreviewTarget } from '@/components/ui/DocumentPreviewDialog'
import type { ManualActRow, ManualCaseDocument, ManualOrderRow, ManualSubMatterRow } from '@/types'

const EMPTY: ManualCaseDocument = {
  filing_number: null,
  registration_number: null,
  registration_date: null,
  first_hearing_date: null,
  decision_date: null,
  nature_of_disposal: null,
  court_number_and_judge: null,
  acts: [],
  sub_matters: [],
  final_orders: [],
}

export function ManualDocumentDialog({
  caseId,
  open,
  onClose,
  initial,
}: {
  caseId: string
  open: boolean
  onClose: () => void
  initial: ManualCaseDocument | null
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [filingNumber, setFilingNumber] = useState('')
  const [registrationNumber, setRegistrationNumber] = useState('')
  const [registrationDate, setRegistrationDate] = useState('')
  const [firstHearingDate, setFirstHearingDate] = useState('')
  const [decisionDate, setDecisionDate] = useState('')
  const [natureOfDisposal, setNatureOfDisposal] = useState('')
  const [courtNumberAndJudge, setCourtNumberAndJudge] = useState('')
  const [acts, setActs] = useState<ManualActRow[]>([])
  const [subMatters, setSubMatters] = useState<ManualSubMatterRow[]>([])
  const [finalOrders, setFinalOrders] = useState<ManualOrderRow[]>([])

  const [actInput, setActInput] = useState('')
  const [sectionInput, setSectionInput] = useState('')
  const [subMatterInput, setSubMatterInput] = useState('')
  const [orderDateInput, setOrderDateInput] = useState('')
  const [orderTitleInput, setOrderTitleInput] = useState('')
  const [orderAttachment, setOrderAttachment] = useState<{ id: string; title: string } | null>(null)
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget | null>(null)
  const orderFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const doc = initial ?? EMPTY
    setFilingNumber(doc.filing_number ?? '')
    setRegistrationNumber(doc.registration_number ?? '')
    setRegistrationDate(doc.registration_date ?? '')
    setFirstHearingDate(doc.first_hearing_date ?? '')
    setDecisionDate(doc.decision_date ?? '')
    setNatureOfDisposal(doc.nature_of_disposal ?? '')
    setCourtNumberAndJudge(doc.court_number_and_judge ?? '')
    setActs(doc.acts)
    setSubMatters(doc.sub_matters)
    setFinalOrders(doc.final_orders)
    setActInput('')
    setSectionInput('')
    setSubMatterInput('')
    setOrderDateInput('')
    setOrderTitleInput('')
    setOrderAttachment(null)
  }, [open, initial])

  const orderAttachMutation = useMutationWithToast({
    mutationFn: async (file: File) => {
      const res = await createUploadUrl({
        case_id: caseId,
        title: file.name,
        doc_type: 'final_order_attachment',
        filename: file.name,
        mime_type: file.type || 'application/octet-stream',
        file_size_bytes: file.size,
      })
      await uploadFileBytes(res.upload_url, file)
      await confirmUpload(res.document_id, crypto.randomUUID())
      return { id: res.document_id, title: file.name }
    },
    onSuccess: (attachment) => setOrderAttachment(attachment),
    errorFallback: 'Could not attach file.',
  })

  const mutation = useMutationWithToast({
    mutationFn: () =>
      setManualDocument(caseId, {
        filing_number: filingNumber || null,
        registration_number: registrationNumber || null,
        registration_date: registrationDate || null,
        first_hearing_date: firstHearingDate || null,
        decision_date: decisionDate || null,
        nature_of_disposal: natureOfDisposal || null,
        court_number_and_judge: courtNumberAndJudge || null,
        acts,
        sub_matters: subMatters,
        // document_title/mime_type/storage_key are resolved server-side from
        // document_id on read - don't round-trip stale copies into the stored blob.
        final_orders: finalOrders.map((o) => ({
          order_date: o.order_date,
          title: o.title,
          document_id: o.document_id,
          document_title: null,
          document_mime_type: null,
          document_storage_key: null,
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.caseFullDetails(caseId) })
      toast('Case document saved.', 'success')
      onClose()
    },
    errorFallback: 'Could not save the case document.',
  })

  function addAct() {
    if (!actInput.trim()) return
    setActs((prev) => [...prev, { act: actInput.trim(), section: sectionInput.trim() || null }])
    setActInput('')
    setSectionInput('')
  }

  function addSubMatter() {
    if (!subMatterInput.trim()) return
    setSubMatters((prev) => [...prev, { case_number: subMatterInput.trim() }])
    setSubMatterInput('')
  }

  function addOrder() {
    if (!orderTitleInput.trim()) return
    setFinalOrders((prev) => [
      ...prev,
      {
        order_date: orderDateInput || null,
        title: orderTitleInput.trim(),
        document_id: orderAttachment?.id ?? null,
        document_title: orderAttachment?.title ?? null,
        document_mime_type: null,
        document_storage_key: null,
      },
    ])
    setOrderDateInput('')
    setOrderTitleInput('')
    setOrderAttachment(null)
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Case document"
      description="Optional fallback for when the CNR portal can't be scraped — captured by hand instead."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={mutation.isPending} onClick={() => mutation.mutate()}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <div>
          <p className="mb-2 text-sm font-medium text-ink">Case details</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Filing number">
              <Input value={filingNumber} onChange={(e) => setFilingNumber(e.target.value)} />
            </Field>
            <Field label="Registration number">
              <Input value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} />
            </Field>
            <Field label="Registration date">
              <DatePicker value={registrationDate} onChange={setRegistrationDate} />
            </Field>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-ink">Case status</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="First hearing date">
              <DatePicker value={firstHearingDate} onChange={setFirstHearingDate} />
            </Field>
            <Field label="Decision date">
              <DatePicker value={decisionDate} onChange={setDecisionDate} />
            </Field>
            <Field label="Nature of disposal">
              <Input value={natureOfDisposal} onChange={(e) => setNatureOfDisposal(e.target.value)} />
            </Field>
            <Field label="Court number and judge">
              <Input value={courtNumberAndJudge} onChange={(e) => setCourtNumberAndJudge(e.target.value)} />
            </Field>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-ink">Acts {acts.length > 0 && `(${acts.length})`}</p>
          {acts.length > 0 && (
            <ul className="mb-2 space-y-1">
              {acts.map((a, i) => (
                <li key={i} className="flex items-center justify-between text-sm text-ink-muted">
                  <span>
                    {a.act}
                    {a.section && ` · Section ${a.section}`}
                  </span>
                  <button type="button" onClick={() => setActs((prev) => prev.filter((_, j) => j !== i))}>
                    <X className="size-3.5 text-ink-faint hover:text-danger" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-2 sm:grid-cols-[2fr_1fr_auto]">
            <Input placeholder="Act" value={actInput} onChange={(e) => setActInput(e.target.value)} />
            <Input placeholder="Section" value={sectionInput} onChange={(e) => setSectionInput(e.target.value)} />
            <Button type="button" size="sm" variant="secondary" disabled={!actInput.trim()} onClick={addAct}>
              Add
            </Button>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-ink">
            Sub matters {subMatters.length > 0 && `(${subMatters.length})`}
          </p>
          {subMatters.length > 0 && (
            <ul className="mb-2 space-y-1">
              {subMatters.map((m, i) => (
                <li key={i} className="flex items-center justify-between text-sm text-ink-muted">
                  <span>{m.case_number}</span>
                  <button type="button" onClick={() => setSubMatters((prev) => prev.filter((_, j) => j !== i))}>
                    <X className="size-3.5 text-ink-faint hover:text-danger" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-2 sm:grid-cols-[2fr_auto]">
            <Input
              placeholder="Case number"
              value={subMatterInput}
              onChange={(e) => setSubMatterInput(e.target.value)}
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!subMatterInput.trim()}
              onClick={addSubMatter}
            >
              Add
            </Button>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-ink">
            Final orders / judgements {finalOrders.length > 0 && `(${finalOrders.length})`}
          </p>
          {finalOrders.length > 0 && (
            <ul className="mb-2 space-y-1.5">
              {finalOrders.map((o, i) => (
                <li key={i} className="rounded-control border border-border bg-surface-muted px-3 py-2">
                  <div className="flex items-center justify-between gap-2 text-sm text-ink-muted">
                    <span>
                      {o.order_date ?? '—'} — {o.title}
                    </span>
                    <button
                      type="button"
                      aria-label="Remove order"
                      onClick={() => setFinalOrders((prev) => prev.filter((_, j) => j !== i))}
                    >
                      <X className="size-3.5 text-ink-faint hover:text-danger" />
                    </button>
                  </div>
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
                      className="mt-1.5 inline-flex items-center gap-1.5 rounded-control border border-border bg-surface px-2 py-1 text-xs text-ink-muted enabled:hover:text-ink disabled:opacity-60"
                      title={o.document_storage_key ? 'View' : 'Available after saving'}
                    >
                      <Paperclip className="size-3" /> {o.document_title}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <DatePicker value={orderDateInput} onChange={setOrderDateInput} placeholder="Order date" />
            <Input
              placeholder="Title"
              value={orderTitleInput}
              onChange={(e) => setOrderTitleInput(e.target.value)}
            />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              loading={orderAttachMutation.isPending}
              onClick={() => orderFileRef.current?.click()}
            >
              <Paperclip className="size-4" /> {orderAttachment ? orderAttachment.title : 'Attach'}
            </Button>
            <input
              ref={orderFileRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) orderAttachMutation.mutate(file)
                e.target.value = ''
              }}
            />
            {orderAttachment && (
              <button
                type="button"
                aria-label="Remove attachment"
                onClick={() => setOrderAttachment(null)}
                className="text-ink-faint hover:text-danger"
              >
                <X className="size-3.5" />
              </button>
            )}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="ml-auto"
              disabled={!orderTitleInput.trim() || orderAttachMutation.isPending}
              onClick={addOrder}
            >
              Add
            </Button>
          </div>
        </div>
      </div>

      <DocumentPreviewDialog
        open={!!previewTarget}
        onClose={() => setPreviewTarget(null)}
        target={previewTarget}
      />
    </Dialog>
  )
}
