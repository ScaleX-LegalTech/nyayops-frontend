import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { linkCaseCnr } from '@/lib/api/cases'
import { invalidateCaseScopes, qk } from '@/lib/queryKeys'
import { useMutationWithToast } from '@/lib/useMutationWithToast'
import { useToast } from '@/components/ui/Toast'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import type { DocumentCard } from '@/types'

// The extractor fetches a newly-linked CNR lazily (queued on first request) - poll
// instead of making the user click "Check again" themselves. Bounded so a genuinely
// stuck/slow portal fetch still ends in a real error, not an infinite spinner.
const LINK_POLL_TIMEOUT_MS = 25_000
const LINK_POLL_INTERVAL_MS = 3_000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

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
  const [polling, setPolling] = useState(false)

  function reset() {
    setCnr('')
    setCourtType('')
    setPolling(false)
  }

  function closeAndReset() {
    reset()
    onClose()
  }

  const mutation = useMutationWithToast({
    mutationFn: async () => {
      const deadline = Date.now() + LINK_POLL_TIMEOUT_MS
      let resp = await linkCaseCnr(caseId, { cnr, court_type: courtType || null })
      if (resp.status === 'pending') setPolling(true)
      while (resp.status === 'pending' && Date.now() < deadline) {
        await sleep(LINK_POLL_INTERVAL_MS)
        resp = await linkCaseCnr(caseId, { cnr, court_type: courtType || null })
      }
      if (resp.status === 'pending') {
        throw new Error(
          'Still fetching from the court portal after a while — try again in a minute.',
        )
      }
      return resp
    },
    onSuccess: () => {
      invalidateCaseScopes(queryClient)
      queryClient.invalidateQueries({ queryKey: qk.caseDetail(caseId) })
      toast('CNR linked.', 'success')
      closeAndReset()
    },
    onError: () => setPolling(false),
    errorFallback: (err) => (err instanceof Error ? err.message : 'Could not link CNR.'),
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
            {polling ? 'Fetching…' : 'Link CNR'}
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
        {polling && (
          <p className="flex items-center gap-2 text-sm text-ink-muted">
            <Loader2 className="size-4 animate-spin" />
            Still fetching from the court portal (this can take a little while, especially for
            district courts)…
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
