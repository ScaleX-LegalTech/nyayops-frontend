import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Pencil, Plus, Trash2 } from 'lucide-react'
import { deleteBranch, listBranches } from '@/lib/api/admin'
import { qk } from '@/lib/queryKeys'
import { useMutationWithToast } from '@/lib/useMutationWithToast'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/Feedback'
import { BranchFormDialog } from './BranchFormDialog'
import type { Branch } from '@/types'

export default function BranchesPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Branch | null>(null)
  const [deleting, setDeleting] = useState<Branch | null>(null)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: qk.branches,
    queryFn: listBranches,
  })

  const remove = useMutationWithToast({
    mutationFn: (id: string) => deleteBranch(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.branches })
      toast('Branch deleted.', 'success')
      setDeleting(null)
    },
    errorFallback: 'Delete failed.',
  })

  const branches = data ?? []

  return (
    <div className="animate-rise">
      <PageHeader
        title="Branches"
        description="Regions your organization operates in. Assign an Admin to each from the Users page."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" /> New branch
          </Button>
        }
      />

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : branches.length === 0 ? (
        <Card>
          <EmptyState
            icon={Building2}
            title="No branches yet"
            description="Create a branch, then assign a Regional Director to manage it."
            action={
              <Button onClick={() => setCreating(true)}>
                <Plus className="size-4" /> New branch
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {branches.map((branch) => (
            <Card key={branch.id}>
              <CardHeader
                title={branch.name}
                action={
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(branch)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleting(branch)}>
                      <Trash2 className="size-4 text-danger" />
                    </Button>
                  </div>
                }
              />
            </Card>
          ))}
        </div>
      )}

      {creating && <BranchFormDialog open onClose={() => setCreating(false)} />}
      {editing && <BranchFormDialog open branch={editing} onClose={() => setEditing(null)} />}

      <Dialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete branch"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() => deleting && remove.mutate(deleting.id)}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">
          Delete <span className="font-medium text-ink">{deleting?.name}</span>? This fails if
          users or cases are still assigned to it.
        </p>
      </Dialog>
    </div>
  )
}
