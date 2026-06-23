import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { updateCase } from '@/lib/api/cases'
import { invalidateCaseScopes } from '@/lib/queryKeys'
import { useMutationWithToast } from '@/lib/useMutationWithToast'
import { useToast } from '@/components/ui/Toast'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import type { Case, CaseCreateRequest } from '@/types'

const PRIORITIES = ['low', 'medium', 'high', 'urgent']

export function EditCaseDialog({
  open,
  onClose,
  caseRecord,
}: {
  open: boolean
  onClose: () => void
  caseRecord: Case
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [form, setForm] = useState<Partial<CaseCreateRequest>>({
    title: caseRecord.title,
    case_type: caseRecord.case_type,
    client_name: caseRecord.client_name,
    court_jurisdiction: caseRecord.court_jurisdiction,
    region: caseRecord.region,
    priority: caseRecord.priority,
    description: caseRecord.description ?? '',
    filing_date: caseRecord.filing_date ?? '',
    hearing_date: caseRecord.hearing_date ?? '',
  })

  function set<K extends keyof CaseCreateRequest>(key: K, value: CaseCreateRequest[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const mutation = useMutationWithToast({
    mutationFn: () =>
      updateCase(caseRecord.id, {
        ...form,
        filing_date: form.filing_date || null,
        hearing_date: form.hearing_date || null,
        description: form.description || null,
      }),
    onSuccess: () => {
      invalidateCaseScopes(queryClient)
      toast('Case updated.', 'success')
      onClose()
    },
    errorFallback: 'Update failed.',
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    mutation.mutate()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Edit case"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="edit-case-form" loading={mutation.isPending}>
            Save changes
          </Button>
        </>
      }
    >
      <form id="edit-case-form" onSubmit={submit} className="space-y-4">
        <Field label="Title">
          <Input value={form.title ?? ''} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Case type">
            <Input value={form.case_type ?? ''} onChange={(e) => set('case_type', e.target.value)} />
          </Field>
          <Field label="Client name">
            <Input
              value={form.client_name ?? ''}
              onChange={(e) => set('client_name', e.target.value)}
            />
          </Field>
          <Field label="Court / jurisdiction">
            <Input
              value={form.court_jurisdiction ?? ''}
              onChange={(e) => set('court_jurisdiction', e.target.value)}
            />
          </Field>
          <Field label="Region">
            <Input value={form.region ?? ''} onChange={(e) => set('region', e.target.value)} />
          </Field>
          <Field label="Filing date">
            <Input
              type="date"
              value={form.filing_date ?? ''}
              onChange={(e) => set('filing_date', e.target.value)}
            />
          </Field>
          <Field label="Hearing date">
            <Input
              type="date"
              value={form.hearing_date ?? ''}
              onChange={(e) => set('hearing_date', e.target.value)}
            />
          </Field>
          <Field label="Priority">
            <Select
              value={form.priority ?? 'medium'}
              onChange={(e) => set('priority', e.target.value)}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p[0].toUpperCase() + p.slice(1)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Description">
          <Textarea
            value={form.description ?? ''}
            onChange={(e) => set('description', e.target.value)}
            rows={3}
          />
        </Field>
      </form>
    </Dialog>
  )
}
