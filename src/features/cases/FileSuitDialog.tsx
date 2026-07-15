import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { addCaseDetails } from '@/lib/api/cases'
import { invalidateCaseScopes, qk } from '@/lib/queryKeys'
import { useMutationWithToast } from '@/lib/useMutationWithToast'
import { useToast } from '@/components/ui/Toast'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { DatePicker } from '@/components/ui/DatePicker'

export function FileSuitDialog({
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
  const [caseType, setCaseType] = useState('')
  const [courtJurisdiction, setCourtJurisdiction] = useState('')
  const [region, setRegion] = useState('')
  const [courtType, setCourtType] = useState('')
  const [filingDate, setFilingDate] = useState('')
  const [hearingDate, setHearingDate] = useState('')

  function reset() {
    setCaseType('')
    setCourtJurisdiction('')
    setRegion('')
    setCourtType('')
    setFilingDate('')
    setHearingDate('')
  }

  function closeAndReset() {
    reset()
    onClose()
  }

  const mutation = useMutationWithToast({
    mutationFn: () =>
      addCaseDetails(caseId, {
        case_type: caseType,
        court_jurisdiction: courtJurisdiction,
        region,
        court_type: courtType || null,
        filing_date: filingDate || null,
        hearing_date: hearingDate || null,
      }),
    onSuccess: () => {
      invalidateCaseScopes(queryClient)
      queryClient.invalidateQueries({ queryKey: qk.caseDetail(caseId) })
      toast('Suit filed.', 'success')
      closeAndReset()
    },
    errorFallback: 'Could not save filing details.',
  })

  return (
    <Dialog
      open={open}
      onClose={closeAndReset}
      title="File suit"
      description="Record the court and case type once the suit is actually filed."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={closeAndReset}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="file-suit-form"
            loading={mutation.isPending}
            disabled={!caseType.trim() || !courtJurisdiction.trim() || !region.trim()}
          >
            Save
          </Button>
        </>
      }
    >
      <form
        id="file-suit-form"
        onSubmit={(e: FormEvent) => {
          e.preventDefault()
          mutation.mutate()
        }}
        className="space-y-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Case type" required>
            <Input
              value={caseType}
              onChange={(e) => setCaseType(e.target.value)}
              placeholder="Civil, Criminal, IP…"
              required
            />
          </Field>
          <Field label="Court / jurisdiction" required>
            <Input
              value={courtJurisdiction}
              onChange={(e) => setCourtJurisdiction(e.target.value)}
              placeholder="Delhi High Court"
              required
            />
          </Field>
          <Field label="Region" required>
            <Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Delhi" required />
          </Field>
          <Field label="Court type" hint="Optional.">
            <Select value={courtType} onChange={(e) => setCourtType(e.target.value)}>
              <option value="">Unspecified</option>
              <option value="high_court">High Court</option>
              <option value="district_court">District Court</option>
            </Select>
          </Field>
          <Field label="Filing date" hint="Optional.">
            <DatePicker value={filingDate} onChange={setFilingDate} />
          </Field>
          <Field label="Hearing date" hint="Optional.">
            <DatePicker value={hearingDate} onChange={setHearingDate} />
          </Field>
        </div>
        <p className="text-xs text-ink-muted">
          The court only assigns a CNR days after filing — link it from the case page once you
          have it.
        </p>
      </form>
    </Dialog>
  )
}
