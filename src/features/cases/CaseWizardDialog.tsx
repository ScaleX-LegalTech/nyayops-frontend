import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/auth/AuthContext'
import { assignCase, createCase } from '@/lib/api/cases'
import { listBranches } from '@/lib/api/admin'
import { qk } from '@/lib/queryKeys'
import { invalidateCaseScopes } from '@/lib/queryKeys'
import { useMutationWithToast } from '@/lib/useMutationWithToast'
import { useToast } from '@/components/ui/Toast'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { UserMultiSelect } from '@/components/ui/UserMultiSelect'
import type { Case } from '@/types'

const PRIORITIES = ['low', 'medium', 'high', 'urgent']

/** Only title/client/description/priority are knowable when a case is created - an
 * associate has just heard about a defaulter from the bank, nothing has been
 * collected/scrutinized/filed yet. Filing details (case_type/court/region) come later
 * via the "File suit" action on the case page, once scrutiny is done; CNR later still
 * via "Link CNR"; parties/hearing history later still, from "View case details". */
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
  const { isManagingDirector } = useAuth()

  const [step, setStep] = useState<1 | 2>(1)
  const [caseRecord, setCaseRecord] = useState<Case | null>(null)

  // Step 1
  const [title, setTitle] = useState('')
  const [clientName, setClientName] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [branchId, setBranchId] = useState('')

  // Only the MD has no branch of their own - every case must belong to one
  // (backend rejects a branch-less create), so the MD picks it here; everyone
  // else's own branch is used automatically server-side.
  const branchesQuery = useQuery({
    queryKey: qk.branches,
    queryFn: listBranches,
    enabled: isManagingDirector && open,
  })

  // Step 2
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([])

  function resetAll() {
    setStep(1)
    setCaseRecord(null)
    setTitle('')
    setClientName('')
    setDescription('')
    setPriority('medium')
    setBranchId('')
    setAssignedUserIds([])
  }

  function closeAndReset() {
    resetAll()
    onClose()
  }

  const step1Mutation = useMutationWithToast({
    mutationFn: () =>
      createCase({
        title,
        client_name: clientName,
        description: description || null,
        priority,
        branch_id: isManagingDirector ? branchId : undefined,
      }),
    onSuccess: (created) => {
      setCaseRecord(created)
      setStep(2)
    },
    errorFallback: 'Could not create case.',
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
    toast('Case created.', 'success')
    const id = finalCase.id
    closeAndReset()
    onFinished?.(id)
  }

  return (
    <Dialog
      open={open}
      onClose={closeAndReset}
      title={`New case — step ${step} of 2`}
      description={
        step === 1
          ? 'Start with the basics — everything else (filing, CNR, parties) comes later from the case page.'
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
              disabled={
                !title.trim() || !clientName.trim() || (isManagingDirector && !branchId)
              }
            >
              Next
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => setStep(1)}>
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
          {isManagingDirector && (
            <Field
              label="Branch"
              required
              htmlFor="wiz-branch"
              hint="Every case belongs to a branch — pick which one this one is for."
            >
              <Select
                id="wiz-branch"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                required
              >
                <option value="" disabled>
                  {branchesQuery.isLoading ? 'Loading branches…' : 'Select a branch'}
                </option>
                {branchesQuery.data?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </form>
      )}

      {step === 2 && (
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
