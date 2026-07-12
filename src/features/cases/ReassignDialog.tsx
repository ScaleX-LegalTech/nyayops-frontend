import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { reassignCase } from '@/lib/api/cases'
import { invalidateCaseScopes } from '@/lib/queryKeys'
import { useMutationWithToast } from '@/lib/useMutationWithToast'
import { useToast } from '@/components/ui/Toast'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Textarea } from '@/components/ui/Field'
import { UserMultiSelect } from '@/components/ui/UserMultiSelect'

interface ReassignDialogProps {
  open: boolean
  onClose: () => void
  caseId: string
  onDone: () => void
}

export function ReassignDialog({ open, onClose, caseId, onDone }: ReassignDialogProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [selected, setSelected] = useState<string[]>([])
  const [comment, setComment] = useState('')

  const mutation = useMutationWithToast({
    mutationFn: () => reassignCase(caseId, selected, comment || undefined),
    onSuccess: () => {
      invalidateCaseScopes(queryClient)
      toast('Case reassigned.', 'success')
      setSelected([])
      setComment('')
      onDone()
      onClose()
    },
    errorFallback: 'Reassignment failed.',
  })

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Reassign case"
      description="Move this case to different assignees."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={selected.length === 0}
          >
            Reassign
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Assign to" error={selected.length === 0 ? 'Select at least one user.' : undefined}>
          <UserMultiSelect selected={selected} onChange={setSelected} />
        </Field>
        <Field label="Comment" hint="Optional, recorded with the reassignment.">
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
        </Field>
      </div>
    </Dialog>
  )
}
