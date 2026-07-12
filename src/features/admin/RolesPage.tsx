import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { deleteRole, listRoles } from '@/lib/api/admin'
import { qk } from '@/lib/queryKeys'
import { humanize } from '@/lib/format'
import { useMutationWithToast } from '@/lib/useMutationWithToast'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/Feedback'
import { RoleFormDialog } from './RoleFormDialog'
import type { Role } from '@/types'

export default function RolesPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Role | null>(null)
  const [deleting, setDeleting] = useState<Role | null>(null)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: qk.roles,
    queryFn: listRoles,
  })

  const remove = useMutationWithToast({
    mutationFn: (id: string) => deleteRole(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.roles })
      toast('Role deleted.', 'success')
      setDeleting(null)
    },
    errorFallback: 'Delete failed.',
  })

  const roles = data ?? []

  return (
    <div className="animate-rise">
      <PageHeader
        title="Roles"
        description="Define what teams can see and do."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" /> New role
          </Button>
        }
      />

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : roles.length === 0 ? (
        <Card>
          <EmptyState
            icon={ShieldCheck}
            title="No roles yet"
            description="Create a role and grant it permissions."
            action={
              <Button onClick={() => setCreating(true)}>
                <Plus className="size-4" /> New role
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {roles.map((role) => (
            <Card key={role.id}>
              <CardHeader
                title={role.name}
                description={role.description ?? 'No description'}
                action={
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" aria-label={`Edit ${role.name}`} onClick={() => setEditing(role)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label={`Delete ${role.name}`} onClick={() => setDeleting(role)}>
                      <Trash2 className="size-4 text-danger" />
                    </Button>
                  </div>
                }
              />
              <CardBody className="border-t border-border">
                <p className="mb-2 text-xs uppercase tracking-wide text-ink-faint">
                  {role.permissions.length} permission{role.permissions.length === 1 ? '' : 's'}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {role.permissions.slice(0, 8).map((p, i) => (
                    <Badge key={i} tone="neutral">
                      {humanize(p.resource)}:{humanize(p.action)}
                    </Badge>
                  ))}
                  {role.permissions.length > 8 && (
                    <Badge tone="brand">+{role.permissions.length - 8}</Badge>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {creating && <RoleFormDialog open onClose={() => setCreating(false)} />}
      {editing && <RoleFormDialog open role={editing} onClose={() => setEditing(null)} />}

      <Dialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete role"
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
          Delete <span className="font-medium text-ink">{deleting?.name}</span>? This fails if users
          are still assigned to it.
        </p>
      </Dialog>
    </div>
  )
}
