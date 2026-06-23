import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createBranch, updateBranch } from '@/lib/api/admin'
import { qk } from '@/lib/queryKeys'
import { useMutationWithToast } from '@/lib/useMutationWithToast'
import { useToast } from '@/components/ui/Toast'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import type { Branch } from '@/types'

export function BranchFormDialog({
  open,
  onClose,
  branch,
}: {
  open: boolean
  onClose: () => void
  branch?: Branch
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [name, setName] = useState(branch?.name ?? '')

  const save = useMutationWithToast({
    mutationFn: () => (branch ? updateBranch(branch.id, { name }) : createBranch({ name })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.branches })
      toast(branch ? 'Branch updated.' : 'Branch created.', 'success')
      onClose()
    },
    errorFallback: 'Could not save branch.',
  })

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={branch ? 'Edit branch' : 'New branch'}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={save.isPending} disabled={!name} onClick={() => save.mutate()}>
            {branch ? 'Save branch' : 'Create branch'}
          </Button>
        </>
      }
    >
      <Field label="Branch name" required>
        <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </Field>
    </Dialog>
  )
}
