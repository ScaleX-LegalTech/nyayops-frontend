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
  /** Already-assigned users to pre-tick - only meaningful for a single-case
   * dialog (the case page's Assign button); bulk assign from the list has no
   * single shared assignee set, so callers there just omit it. */
  initialSelected?: string[]
  onDone: () => void
}

export function AssignDialog({
  open,
  onClose,
  caseIds,
  initialSelected = [],
  onDone,
}: AssignDialogProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [selected, setSelected] = useState<string[]>(initialSelected)
  // Re-seed `selected` from `initialSelected` each time the dialog opens - the
  // documented "adjust state during render" pattern (no effect needed) since
  // this dialog stays mounted with `open` just toggling visibility.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setSelected(initialSelected)
  }

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
        <UserMultiSelect caseIds={caseIds} selected={selected} onChange={setSelected} />
      </Field>
    </Dialog>
  )
}
