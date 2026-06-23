import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createCase } from '@/lib/api/cases'
import { invalidateCaseScopes } from '@/lib/queryKeys'
import { useMutationWithToast } from '@/lib/useMutationWithToast'
import { useToast } from '@/components/ui/Toast'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { UserMultiSelect } from '@/components/ui/UserMultiSelect'
import type { CaseCreateRequest } from '@/types'

const PRIORITIES = ['low', 'medium', 'high', 'urgent']

export function CaseFormDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [form, setForm] = useState<CaseCreateRequest>({
    title: '',
    case_type: '',
    client_name: '',
    court_jurisdiction: '',
    region: '',
    priority: 'medium',
    description: '',
    filing_date: '',
    hearing_date: '',
    assigned_user_ids: [],
  })

  function set<K extends keyof CaseCreateRequest>(key: K, value: CaseCreateRequest[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const mutation = useMutationWithToast({
    mutationFn: () =>
      createCase({
        ...form,
        filing_date: form.filing_date || null,
        hearing_date: form.hearing_date || null,
        description: form.description || null,
      }),
    onSuccess: () => {
      invalidateCaseScopes(queryClient)
      toast('Case created.', 'success')
      onClose()
    },
    errorFallback: 'Could not create case.',
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    mutation.mutate()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New case"
      description="Open a new matter and optionally assign it."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="case-form" loading={mutation.isPending}>
            Create case
          </Button>
        </>
      }
    >
      <form id="case-form" onSubmit={submit} className="space-y-4">
        <Field label="Title" required htmlFor="title">
          <Input
            id="title"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            required
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Case type" required>
            <Input
              value={form.case_type}
              onChange={(e) => set('case_type', e.target.value)}
              placeholder="Civil, Criminal, IP…"
              required
            />
          </Field>
          <Field label="Client name" required>
            <Input
              value={form.client_name}
              onChange={(e) => set('client_name', e.target.value)}
              required
            />
          </Field>
          <Field label="Court / jurisdiction" required>
            <Input
              value={form.court_jurisdiction}
              onChange={(e) => set('court_jurisdiction', e.target.value)}
              placeholder="Delhi High Court"
              required
            />
          </Field>
          <Field label="Region" required>
            <Input
              value={form.region}
              onChange={(e) => set('region', e.target.value)}
              placeholder="Delhi"
              required
            />
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
            <Select value={form.priority} onChange={(e) => set('priority', e.target.value)}>
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
        <Field label="Assign to" hint="Assigning moves the case to “assigned”.">
          <UserMultiSelect
            selected={form.assigned_user_ids ?? []}
            onChange={(ids) => set('assigned_user_ids', ids)}
            emptyHint="You don't have permission to list users for assignment."
          />
        </Field>
      </form>
    </Dialog>
  )
}
