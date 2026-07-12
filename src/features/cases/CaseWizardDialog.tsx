import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import {
  addCaseDetails,
  addCaseHistory,
  addCaseParty,
  assignCase,
  createCase,
  deleteCaseHistory,
  deleteCaseParty,
} from '@/lib/api/cases'
import { invalidateCaseScopes } from '@/lib/queryKeys'
import { useMutationWithToast } from '@/lib/useMutationWithToast'
import { useToast } from '@/components/ui/Toast'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { DatePicker } from '@/components/ui/DatePicker'
import { UserMultiSelect } from '@/components/ui/UserMultiSelect'
import { Badge } from '@/components/ui/Badge'
import { courtLabel } from '@/lib/format'
import type { Case } from '@/types'

const PRIORITIES = ['low', 'medium', 'high', 'urgent']

type DetailsMode = 'cnr' | 'manual'

export function CaseWizardDialog({
  open,
  onClose,
  onFinished,
}: {
  open: boolean
  onClose: () => void
  onFinished?: (caseId: string) => void
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [caseRecord, setCaseRecord] = useState<Case | null>(null)

  // Step 1
  const [title, setTitle] = useState('')
  const [clientName, setClientName] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')

  // Step 2
  const [mode, setMode] = useState<DetailsMode>('cnr')
  const [cnr, setCnr] = useState('')
  const [courtType, setCourtType] = useState('')
  const [caseType, setCaseType] = useState('')
  const [courtJurisdiction, setCourtJurisdiction] = useState('')
  const [region, setRegion] = useState('')
  const [filingDate, setFilingDate] = useState('')
  const [hearingDate, setHearingDate] = useState('')
  const [pendingJobId, setPendingJobId] = useState<string | null>(null)

  const [partyRole, setPartyRole] = useState('petitioner')
  const [partyName, setPartyName] = useState('')
  const [partyAdvocate, setPartyAdvocate] = useState('')

  const [historyPurpose, setHistoryPurpose] = useState('')
  const [historyDate, setHistoryDate] = useState('')
  const [historyNextDate, setHistoryNextDate] = useState('')
  const [historyJudge, setHistoryJudge] = useState('')
  const [historyDisposal, setHistoryDisposal] = useState(false)

  // Step 3
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([])

  function resetAll() {
    setStep(1)
    setCaseRecord(null)
    setTitle('')
    setClientName('')
    setDescription('')
    setPriority('medium')
    setMode('cnr')
    setCnr('')
    setCourtType('')
    setCaseType('')
    setCourtJurisdiction('')
    setRegion('')
    setFilingDate('')
    setHearingDate('')
    setPendingJobId(null)
    setPartyRole('petitioner')
    setPartyName('')
    setPartyAdvocate('')
    setHistoryPurpose('')
    setHistoryDate('')
    setHistoryNextDate('')
    setHistoryJudge('')
    setHistoryDisposal(false)
    setAssignedUserIds([])
  }

  function closeAndReset() {
    resetAll()
    onClose()
  }

  const step1Mutation = useMutationWithToast({
    mutationFn: () => createCase({ title, client_name: clientName, description: description || null, priority }),
    onSuccess: (created) => {
      setCaseRecord(created)
      setStep(2)
    },
    errorFallback: 'Could not create case.',
  })

  const detailsMutation = useMutationWithToast({
    mutationFn: () =>
      addCaseDetails(caseRecord!.id, {
        mode,
        cnr: mode === 'cnr' ? cnr : undefined,
        court_type: courtType || null,
        case_type: mode === 'manual' ? caseType : undefined,
        court_jurisdiction: mode === 'manual' ? courtJurisdiction : undefined,
        region: mode === 'manual' ? region : undefined,
        filing_date: mode === 'manual' ? filingDate || null : undefined,
        hearing_date: mode === 'manual' ? hearingDate || null : undefined,
      }),
    onSuccess: (resp) => {
      if (resp.status === 'pending') {
        setPendingJobId(resp.job_id)
        toast('Still fetching from the court portal — check again shortly.', 'info')
        return
      }
      setPendingJobId(null)
      setCaseRecord(resp.case)
      invalidateCaseScopes(queryClient)
      toast('Case details saved.', 'success')
    },
    errorFallback: 'Could not save case details.',
  })

  const partyMutation = useMutationWithToast({
    mutationFn: () =>
      addCaseParty(caseRecord!.id, {
        role: partyRole,
        name: partyName,
        advocate_name: partyAdvocate || null,
      }),
    onSuccess: (updated) => {
      setCaseRecord(updated)
      setPartyName('')
      setPartyAdvocate('')
    },
    errorFallback: 'Could not add party.',
  })

  const deletePartyMutation = useMutationWithToast({
    mutationFn: (partyId: string) => deleteCaseParty(caseRecord!.id, partyId),
    onSuccess: (updated) => setCaseRecord(updated),
    errorFallback: 'Could not remove party.',
  })

  const historyMutation = useMutationWithToast({
    mutationFn: () =>
      addCaseHistory(caseRecord!.id, {
        purpose: historyPurpose || null,
        hearing_date: historyDate || null,
        next_hearing_date: historyNextDate || null,
        judge: historyJudge || null,
        is_disposal: historyDisposal,
      }),
    onSuccess: (updated) => {
      setCaseRecord(updated)
      setHistoryPurpose('')
      setHistoryDate('')
      setHistoryNextDate('')
      setHistoryJudge('')
      setHistoryDisposal(false)
    },
    errorFallback: 'Could not add hearing.',
  })

  const deleteHistoryMutation = useMutationWithToast({
    mutationFn: (historyId: string) => deleteCaseHistory(caseRecord!.id, historyId),
    onSuccess: (updated) => setCaseRecord(updated),
    errorFallback: 'Could not remove hearing entry.',
  })

  const assignMutation = useMutationWithToast({
    mutationFn: () => assignCase(caseRecord!.id, assignedUserIds),
    onSuccess: (updated) => {
      finish(updated)
    },
    errorFallback: 'Could not assign case.',
  })

  function finish(finalCase: Case) {
    invalidateCaseScopes(queryClient)
    toast('Case ready.', 'success')
    const id = finalCase.id
    closeAndReset()
    onFinished?.(id)
  }

  const detailsReady = caseRecord && caseRecord.status !== 'draft'

  return (
    <Dialog
      open={open}
      onClose={closeAndReset}
      title={`New case — step ${step} of 3`}
      description={
        step === 1
          ? 'Start with the basics.'
          : step === 2
            ? 'Pull details from the CNR, or enter them manually.'
            : 'Optionally assign someone else to this case.'
      }
      size="lg"
      footer={
        step === 1 ? (
          <>
            <Button variant="secondary" onClick={closeAndReset}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="wizard-step1"
              loading={step1Mutation.isPending}
              disabled={!title.trim() || !clientName.trim()}
            >
              Next
            </Button>
          </>
        ) : step === 2 ? (
          <>
            <Button variant="secondary" onClick={() => setStep(1)}>
              Back
            </Button>
            {!detailsReady ? (
              <Button
                type="submit"
                form="wizard-step2"
                loading={detailsMutation.isPending}
                disabled={mode === 'cnr' ? !cnr.trim() : !caseType.trim() || !courtJurisdiction.trim() || !region.trim()}
              >
                {pendingJobId ? 'Check again' : 'Save details'}
              </Button>
            ) : (
              <Button onClick={() => setStep(3)}>Next</Button>
            )}
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button variant="secondary" onClick={() => caseRecord && finish(caseRecord)}>
              Skip
            </Button>
            <Button
              loading={assignMutation.isPending}
              disabled={assignedUserIds.length === 0}
              onClick={() => assignMutation.mutate()}
            >
              Assign & finish
            </Button>
          </>
        )
      }
    >
      {step === 1 && (
        <form
          id="wizard-step1"
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            step1Mutation.mutate()
          }}
          className="space-y-4"
        >
          <Field label="Title" required htmlFor="wiz-title">
            <Input id="wiz-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </Field>
          <Field label="Client name" required htmlFor="wiz-client" hint="Who the org is filing for.">
            <Input
              id="wiz-client"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              required
            />
          </Field>
          <Field label="Description" hint="Optional.">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </Field>
          <Field label="Priority">
            <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p[0].toUpperCase() + p.slice(1)}
                </option>
              ))}
            </Select>
          </Field>
        </form>
      )}

      {step === 2 && caseRecord && (
        <div className="space-y-5">
          {!detailsReady && (
            <>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode('cnr')}
                  className={`flex-1 rounded-control border px-3 py-2 text-sm font-medium ${mode === 'cnr' ? 'border-brand bg-brand-soft text-brand-strong' : 'border-border text-ink-muted'}`}
                >
                  From CNR
                </button>
                <button
                  type="button"
                  onClick={() => setMode('manual')}
                  className={`flex-1 rounded-control border px-3 py-2 text-sm font-medium ${mode === 'manual' ? 'border-brand bg-brand-soft text-brand-strong' : 'border-border text-ink-muted'}`}
                >
                  Enter manually
                </button>
              </div>

              <form
                id="wizard-step2"
                onSubmit={(e: FormEvent) => {
                  e.preventDefault()
                  detailsMutation.mutate()
                }}
                className="space-y-4"
              >
                {mode === 'cnr' ? (
                  <div className="grid gap-4 sm:grid-cols-2">
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
                      <p className="sm:col-span-2 text-sm text-ink-muted">
                        Still fetching from the court portal (this can take a little while,
                        especially for district courts). Click "Check again" in a moment.
                      </p>
                    )}
                    <p className="sm:col-span-2 text-xs text-ink-muted">
                      Whatever the CNR returns is stored and shown exactly as-is — nothing is
                      added or changed. You'll be able to view the full portal detail from the
                      case page.
                    </p>
                  </div>
                ) : (
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
                )}
              </form>
            </>
          )}

          {detailsReady && caseRecord.source === 'cnr' && (
            <div className="rounded-card border border-border bg-surface-muted px-4 py-3 text-sm">
              <p className="font-medium text-ink">
                {caseRecord.case_type} · {courtLabel(caseRecord.court_jurisdiction)}
              </p>
              <p className="mt-1 text-ink-muted">
                CNR {caseRecord.cnr}
                {caseRecord.case_stage && (
                  <>
                    {' · '}
                    <Badge tone={caseRecord.case_stage === 'disposed' ? 'neutral' : 'success'}>
                      {caseRecord.case_stage}
                    </Badge>
                  </>
                )}
              </p>
              <p className="mt-2 text-xs text-ink-muted">
                Fetched from the court portal as-is. Open "View case details" from the case page
                to see the full record.
              </p>
            </div>
          )}

          {detailsReady && caseRecord.source === 'manual' && (
            <div className="space-y-5">
              <div className="rounded-card border border-border bg-surface-muted px-4 py-3 text-sm">
                <p className="font-medium text-ink">
                  {caseRecord.case_type} · {courtLabel(caseRecord.court_jurisdiction)}
                </p>
                <p className="mt-1 text-ink-muted">Entered manually</p>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-ink">
                  Parties {caseRecord.parties.length > 0 && `(${caseRecord.parties.length})`}
                </p>
                {caseRecord.parties.length > 0 && (
                  <ul className="mb-3 space-y-1.5">
                    {caseRecord.parties.map((p) => (
                      <li key={p.id} className="flex items-center justify-between text-sm text-ink-muted">
                        <span>
                          <span className="font-medium text-ink">{p.name}</span> — {p.role}
                          {p.advocate_name && ` (adv. ${p.advocate_name})`}
                        </span>
                        <button
                          type="button"
                          aria-label={`Remove ${p.name}`}
                          disabled={deletePartyMutation.isPending}
                          onClick={() => deletePartyMutation.mutate(p.id)}
                          className="text-ink-faint hover:text-danger"
                        >
                          <X className="size-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="grid gap-2 sm:grid-cols-[1fr_1.5fr_1.5fr_auto]">
                  <Select value={partyRole} onChange={(e) => setPartyRole(e.target.value)}>
                    <option value="petitioner">Petitioner</option>
                    <option value="respondent">Respondent</option>
                    <option value="objector">Objector</option>
                    <option value="other">Other</option>
                  </Select>
                  <Input
                    placeholder="Party name"
                    value={partyName}
                    onChange={(e) => setPartyName(e.target.value)}
                  />
                  <Input
                    placeholder="Advocate (optional)"
                    value={partyAdvocate}
                    onChange={(e) => setPartyAdvocate(e.target.value)}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={!partyName.trim()}
                    loading={partyMutation.isPending}
                    onClick={() => partyMutation.mutate()}
                  >
                    Add
                  </Button>
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-ink">
                  Hearing history {caseRecord.history.length > 0 && `(${caseRecord.history.length})`}
                </p>
                {caseRecord.history.length > 0 && (
                  <ul className="mb-3 space-y-1.5">
                    {caseRecord.history.map((h) => (
                      <li key={h.id} className="flex items-center justify-between text-sm text-ink-muted">
                        <span>
                          {h.hearing_date ?? '—'} — {h.purpose || 'Hearing'}
                          {h.judge && ` · ${h.judge}`}
                          {h.next_hearing_date && ` (next: ${h.next_hearing_date})`}
                          {h.is_disposal && ' · disposed'}
                        </span>
                        <button
                          type="button"
                          aria-label="Remove hearing entry"
                          disabled={deleteHistoryMutation.isPending}
                          onClick={() => deleteHistoryMutation.mutate(h.id)}
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
                    value={historyPurpose}
                    onChange={(e) => setHistoryPurpose(e.target.value)}
                  />
                  <Input
                    placeholder="Judge (optional)"
                    value={historyJudge}
                    onChange={(e) => setHistoryJudge(e.target.value)}
                  />
                  <DatePicker value={historyDate} onChange={setHistoryDate} placeholder="Hearing date" />
                  <DatePicker value={historyNextDate} onChange={setHistoryNextDate} placeholder="Next date" />
                  <label className="flex items-center gap-2 text-sm text-ink-muted">
                    <input
                      type="checkbox"
                      checked={historyDisposal}
                      onChange={(e) => setHistoryDisposal(e.target.checked)}
                    />
                    Case disposed at this hearing
                  </label>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="mt-2"
                  loading={historyMutation.isPending}
                  onClick={() => historyMutation.mutate()}
                >
                  Add hearing entry
                </Button>
              </div>

              <p className="text-xs text-ink-muted">
                Orders and other documents can be attached from the case page after creation.
              </p>
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <Field label="Assign to" hint="Optional — you're already the owner of this case.">
          <UserMultiSelect
            selected={assignedUserIds}
            onChange={setAssignedUserIds}
            emptyHint="You don't have permission to list users for assignment."
          />
        </Field>
      )}
    </Dialog>
  )
}
