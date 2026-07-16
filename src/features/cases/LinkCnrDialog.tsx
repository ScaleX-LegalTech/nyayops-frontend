import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { linkCaseCnr } from '@/lib/api/cases'
import { invalidateCaseScopes, qk } from '@/lib/queryKeys'
import { useMutationWithToast } from '@/lib/useMutationWithToast'
import { useToast } from '@/components/ui/Toast'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import type { DocumentCard } from '@/types'

export function LinkCnrDialog({
  open,
  onClose,
  caseId,
  documents = [],
}: {
  open: boolean
  onClose: () => void
  caseId: string
  /** For the "no filing document on file yet" nudge below - not enforced, just a
   * heads-up (see OPTIONAL_DOC_TYPE_FOR). Optional prop so existing call sites
   * that don't have this handy don't need to change. */
  documents?: DocumentCard[]
}) {
  const missingFilingDocument = !documents.some((d) => d.doc_type === 'filing_document')
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [cnr, setCnr] = useState('')
  const [courtType, setCourtType] = useState('')
  const [pendingJobId, setPendingJobId] = useState<string | null>(null)

  function reset() {
    setCnr('')
    setCourtType('')
    setPendingJobId(null)
  }

  function closeAndReset() {
    reset()
    onClose()
  }

  const mutation = useMutationWithToast({
    mutationFn: () => linkCaseCnr(caseId, { cnr, court_type: courtType || null }),
    onSuccess: (resp) => {
      if (resp.status === 'pending') {
        setPendingJobId(resp.job_id)
        toast('Still fetching from the court portal — check again shortly.', 'info')
        return
      }
      invalidateCaseScopes(queryClient)
      queryClient.invalidateQueries({ queryKey: qk.caseDetail(caseId) })
      toast('CNR linked.', 'success')
      closeAndReset()
    },
    errorFallback: 'Could not link CNR.',
  })

  return (
    <Dialog
      open={open}
      onClose={closeAndReset}
      title="Link CNR"
      description="Once the court assigns a CNR, link it here to pull the full portal record."
      footer={
        <>
          <Button variant="secondary" onClick={closeAndReset}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="link-cnr-form"
            loading={mutation.isPending}
            disabled={!cnr.trim()}
          >
            {pendingJobId ? 'Check again' : 'Link CNR'}
          </Button>
        </>
      }
    >
      <form
        id="link-cnr-form"
        onSubmit={(e: FormEvent) => {
          e.preventDefault()
          mutation.mutate()
        }}
        className="space-y-4"
      >
        {missingFilingDocument && (
          <p className="rounded-control border border-dashed border-border bg-surface-muted px-3 py-2 text-xs text-ink-muted">
            No filing document on file yet — you can still link the CNR, or upload one from the
            case page first.
          </p>
        )}
        <Field label="CNR number" required>
          <Input
            value={cnr}
            onChange={(e) => setCnr(e.target.value.toUpperCase())}
            placeholder="HCBM010289472025"
            required
          />
        </Field>
        <Field label="Court type" hint="Leave blank to auto-detect from the CNR.">
          <Select value={courtType} onChange={(e) => setCourtType(e.target.value)}>
            <option value="">Auto-detect</option>
            <option value="high_court">High Court</option>
            <option value="district_court">District Court</option>
          </Select>
        </Field>
        {pendingJobId && (
          <p className="text-sm text-ink-muted">
            Still fetching from the court portal (this can take a little while, especially for
            district courts). Click "Check again" in a moment.
          </p>
        )}
        <p className="text-xs text-ink-muted">
          Whatever the CNR returns is stored and shown exactly as-is — nothing is added or
          changed.
        </p>
      </form>
    </Dialog>
  )
}
