import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { bulkAssignCases } from '@/lib/api/cases'
import { invalidateCaseScopes } from '@/lib/queryKeys'
import { useMutationWithToast } from '@/lib/useMutationWithToast'
import { useToast } from '@/components/ui/Toast'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { UserMultiSelect } from '@/components/ui/UserMultiSelect'

interface AssignDialogProps {
  open: boolean
  onClose: () => void
  caseIds: string[]
  onDone: () => void
}

export function AssignDialog({ open, onClose, caseIds, onDone }: AssignDialogProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [selected, setSelected] = useState<string[]>([])

  const mutation = useMutationWithToast({
    mutationFn: () => bulkAssignCases(caseIds, selected),
    onSuccess: () => {
      invalidateCaseScopes(queryClient)
      toast(`Assigned ${caseIds.length} case${caseIds.length > 1 ? 's' : ''}.`, 'success')
      setSelected([])
      onDone()
      onClose()
    },
    errorFallback: 'Assignment failed.',
  })

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Assign cases"
      description={`Assign ${caseIds.length} selected case${caseIds.length > 1 ? 's' : ''} to team members.`}
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
            Assign
          </Button>
        </>
      }
    >
      <Field label="Assignees">
        <UserMultiSelect selected={selected} onChange={setSelected} />
      </Field>
    </Dialog>
  )
}
