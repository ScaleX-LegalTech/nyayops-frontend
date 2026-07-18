import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createUploadUrl, uploadFileBytes, confirmUpload } from '@/lib/api/documents'
import { raiseBill } from '@/lib/api/bills'
import { getCase } from '@/lib/api/cases'
import { listBillTypes } from '@/lib/api/billTypes'
import { invalidateCaseScopes, qk } from '@/lib/queryKeys'
import { useMutationWithToast } from '@/lib/useMutationWithToast'
import { useToast } from '@/components/ui/Toast'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { DatePicker } from '@/components/ui/DatePicker'
import { UserMultiSelect } from '@/components/ui/UserMultiSelect'
import {
  BillLineItemsTable,
  emptyLineItem,
  sumLineItems,
  type BillLineItemRow,
} from '@/features/bills/BillLineItemsTable'
import type { BillCaseTypeCategory, BillFlowDirection, BillPaymentDestinationType } from '@/types'

const OTHER_BILL_TYPE = '__other__'

const CASE_TYPE_CATEGORY_OPTIONS: { value: BillCaseTypeCategory; label: string }[] = [
  { value: 'tsr_apf', label: 'TSR / APF' },
  { value: 'suit', label: 'Suit' },
  { value: 'demand_notice', label: 'Demand Notice' },
  { value: 'other', label: 'Other' },
]

const PAYMENT_DESTINATION_OPTIONS: { value: BillPaymentDestinationType; label: string }[] = [
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
]

export function RaiseBillDialog({
  open,
  onClose,
  caseId,
}: {
  open: boolean
  onClose: () => void
  caseId: string
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const billTypesQuery = useQuery({ queryKey: qk.billTypes(), queryFn: () => listBillTypes() })
  const billTypes = billTypesQuery.data ?? []
  // Almost always cache-warm - the case detail page (the only place this dialog opens
  // from) already fetched this under the same key.
  const caseQuery = useQuery({ queryKey: qk.caseDetail(caseId), queryFn: () => getCase(caseId) })

  // `associateId` only holds an explicit user choice - until they touch the picker, the
  // case owner is used as the default (derived, not synced via effect: they're always on
  // the case, so raising your own bill as the owner needs no picking, and anyone else
  // raising it still sees the owner pre-selected - and can change it - rather than an
  // empty required field with no obvious right answer).
  const [associateId, setAssociateId] = useState('')
  const effectiveAssociateId = associateId || caseQuery.data?.created_by || ''
  const [billTypeChoice, setBillTypeChoice] = useState('')
  const [customTypeLabel, setCustomTypeLabel] = useState('')
  const [saveAsReusable, setSaveAsReusable] = useState(false)
  const [caseTypeCategory, setCaseTypeCategory] = useState<BillCaseTypeCategory | ''>('')
  const [flowDirection, setFlowDirection] = useState<BillFlowDirection>('collection')
  const [itemize, setItemize] = useState(false)
  const [amount, setAmount] = useState('')
  const [lineItems, setLineItems] = useState<BillLineItemRow[]>([emptyLineItem()])
  const [dueStage, setDueStage] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [destinationType, setDestinationType] = useState<BillPaymentDestinationType>('upi')
  const [destinationValue, setDestinationValue] = useState('')
  const [paymentInfoFile, setPaymentInfoFile] = useState<File | null>(null)

  const isCustomType = billTypeChoice === OTHER_BILL_TYPE

  function reset() {
    setAssociateId('')
    setBillTypeChoice('')
    setCustomTypeLabel('')
    setSaveAsReusable(false)
    setCaseTypeCategory('')
    setFlowDirection('collection')
    setItemize(false)
    setAmount('')
    setLineItems([emptyLineItem()])
    setDueStage('')
    setDueDate('')
    setDestinationType('upi')
    setDestinationValue('')
    setPaymentInfoFile(null)
  }

  function closeAndReset() {
    reset()
    onClose()
  }

  function selectBillType(value: string) {
    setBillTypeChoice(value)
    if (value !== OTHER_BILL_TYPE) {
      const preset = billTypes.find((t) => t.id === value)
      if (preset) setFlowDirection(preset.default_direction)
    }
  }

  const mutation = useMutationWithToast({
    mutationFn: async () => {
      let paymentInfoDocumentId: string | undefined
      if (paymentInfoFile) {
        const uploadMeta = {
          case_id: caseId,
          title: paymentInfoFile.name,
          doc_type: 'bill_payment_info',
          filename: paymentInfoFile.name,
          mime_type: paymentInfoFile.type || 'application/octet-stream',
          file_size_bytes: paymentInfoFile.size,
        }
        const res = await createUploadUrl(uploadMeta)
        await uploadFileBytes(res.upload_url, paymentInfoFile)
        await confirmUpload(res.document_id, crypto.randomUUID())
        paymentInfoDocumentId = res.document_id
      }

      return raiseBill(caseId, {
        associate_id: effectiveAssociateId,
        bill_type_id: isCustomType ? undefined : billTypeChoice || undefined,
        custom_type_label: isCustomType ? customTypeLabel : undefined,
        flow_direction: flowDirection,
        amount: itemize ? undefined : Number(amount) || undefined,
        line_items: itemize
          ? lineItems
              .filter((item) => item.description.trim() && Number(item.amount) > 0)
              .map((item) => ({ description: item.description, amount: Number(item.amount) }))
          : undefined,
        due_stage: dueStage || undefined,
        due_date: dueDate || undefined,
        payment_destination_type: destinationType,
        payment_destination_value: destinationValue,
        payment_info_document_id: paymentInfoDocumentId,
        save_as_reusable_type: isCustomType && saveAsReusable,
        case_type_category:
          isCustomType && saveAsReusable && caseTypeCategory ? caseTypeCategory : undefined,
      })
    },
    onSuccess: () => {
      invalidateCaseScopes(queryClient)
      queryClient.invalidateQueries({ queryKey: qk.caseBills(caseId) })
      queryClient.invalidateQueries({ queryKey: qk.billTypes() })
      toast('Bill raised.', 'success')
      closeAndReset()
    },
    errorFallback: 'Could not raise the bill.',
  })

  const hasBillType = isCustomType ? !!customTypeLabel.trim() : !!billTypeChoice
  const reusableTypeValid = !saveAsReusable || !!caseTypeCategory
  const valid =
    !!effectiveAssociateId &&
    hasBillType &&
    reusableTypeValid &&
    !!destinationValue.trim() &&
    (itemize ? sumLineItems(lineItems) > 0 : true)

  return (
    <Dialog
      open={open}
      onClose={closeAndReset}
      title="Raise bill"
      description="Raise a bill or refund against this case and route it to an associate to collect."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={closeAndReset}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="raise-bill-form"
            loading={mutation.isPending}
            disabled={!valid}
          >
            Raise bill
          </Button>
        </>
      }
    >
      <form
        id="raise-bill-form"
        onSubmit={(e: FormEvent) => {
          e.preventDefault()
          mutation.mutate()
        }}
        className="space-y-4"
      >
        <Field label="Associate" required hint="Defaults to the case owner — change it to route this bill to someone else.">
          <UserMultiSelect
            caseIds={[caseId]}
            source="case-people"
            selected={effectiveAssociateId ? [effectiveAssociateId] : []}
            onChange={(ids) => setAssociateId(ids[ids.length - 1] ?? '')}
            emptyHint="No one is assigned to this case yet."
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bill type" required>
            <Select value={billTypeChoice} onChange={(e) => selectBillType(e.target.value)} required>
              <option value="">Select a type…</option>
              {billTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
              <option value={OTHER_BILL_TYPE}>Other (type your own)</option>
            </Select>
          </Field>
          {isCustomType && (
            <Field label="Custom bill type" required>
              <Input
                value={customTypeLabel}
                onChange={(e) => setCustomTypeLabel(e.target.value)}
                placeholder="Bank Processing Fee…"
                required
              />
            </Field>
          )}
        </div>

        {isCustomType && (
          <div className="space-y-2 rounded-control border border-dashed border-border bg-surface-muted px-3 py-2.5">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={saveAsReusable}
                onChange={(e) => setSaveAsReusable(e.target.checked)}
              />
              Save this as a reusable bill type for the organization
            </label>
            {saveAsReusable && (
              <Field label="Case-type category" required hint="Used to filter the dropdown by case type later.">
                <Select
                  value={caseTypeCategory}
                  onChange={(e) => setCaseTypeCategory(e.target.value as BillCaseTypeCategory)}
                  required
                >
                  <option value="">Select a category…</option>
                  {CASE_TYPE_CATEGORY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
        )}

        <Field label="Flow direction" required>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={flowDirection === 'collection' ? 'primary' : 'secondary'}
              onClick={() => setFlowDirection('collection')}
            >
              Collection
            </Button>
            <Button
              type="button"
              size="sm"
              variant={flowDirection === 'refund' ? 'primary' : 'secondary'}
              onClick={() => setFlowDirection('refund')}
            >
              Refund
            </Button>
          </div>
        </Field>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={itemize} onChange={(e) => setItemize(e.target.checked)} />
            Itemize instead of a flat amount
          </label>
          {itemize ? (
            <BillLineItemsTable items={lineItems} onChange={setLineItems} />
          ) : (
            <Field label="Amount">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </Field>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Due stage" hint="Optional — e.g. 'at examination-in-chief'.">
            <Input value={dueStage} onChange={(e) => setDueStage(e.target.value)} />
          </Field>
          <Field label="Due date" hint="Optional.">
            <DatePicker value={dueDate} onChange={setDueDate} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Where the client should pay" required>
            <Select
              value={destinationType}
              onChange={(e) => setDestinationType(e.target.value as BillPaymentDestinationType)}
              required
            >
              {PAYMENT_DESTINATION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Payment details" required>
            <Input
              value={destinationValue}
              onChange={(e) => setDestinationValue(e.target.value)}
              placeholder="UPI ID, account no. / IFSC, or instructions"
              required
            />
          </Field>
        </div>

        <Field label="Attach invoice / payment info" hint="Optional — you can also just call the client.">
          <input
            type="file"
            onChange={(e) => setPaymentInfoFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-control file:border file:border-border file:bg-surface-muted file:px-3 file:py-1.5 file:text-sm"
          />
        </Field>
      </form>
    </Dialog>
  )
}
