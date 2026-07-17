import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { deleteRole, listRoles } from '@/lib/api/admin'
import { qk } from '@/lib/queryKeys'
import { humanize } from '@/lib/format'
import { useMutationWithToast } from '@/lib/useMutationWithToast'
import { useCanManageRoles } from '@/lib/usePermissions'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/Feedback'
import type { Role } from '@/types'

export default function RolesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { canManageRoles } = useCanManageRoles()
  const [deleting, setDeleting] = useState<Role | null>(null)
  const [viewing, setViewing] = useState<Role | null>(null)

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
          canManageRoles ? (
            <Button onClick={() => navigate('new')}>
              <Plus className="size-4" /> New role
            </Button>
          ) : undefined
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
            description={
              canManageRoles
                ? 'Create a role and grant it permissions.'
                : 'No roles have been created for this organization yet.'
            }
            action={
              canManageRoles ? (
                <Button onClick={() => navigate('new')}>
                  <Plus className="size-4" /> New role
                </Button>
              ) : undefined
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
                  canManageRoles ? (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" aria-label={`Edit ${role.name}`} onClick={() => navigate(role.id)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" aria-label={`Delete ${role.name}`} onClick={() => setDeleting(role)}>
                        <Trash2 className="size-4 text-danger" />
                      </Button>
                    </div>
                  ) : (
                    <Button size="icon" variant="ghost" aria-label={`View ${role.name} permissions`} onClick={() => setViewing(role)}>
                      <Eye className="size-4" />
                    </Button>
                  )
                }
              />
              <CardBody className="border-t border-border">
                <p className="mb-2 text-xs uppercase tracking-wide text-ink-faint">
                  {role.permissions.length} permission{role.permissions.length === 1 ? '' : 's'}
                  {(role.name_prefix || role.name_suffix) && (
                    <>
                      {' · '}
                      {role.name_prefix && `Prefix "${role.name_prefix}"`}
                      {role.name_prefix && role.name_suffix && ' · '}
                      {role.name_suffix && `Suffix "${role.name_suffix}"`}
                    </>
                  )}
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

      <Dialog
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing ? `${viewing.name} — permissions` : ''}
        description={viewing?.description ?? undefined}
      >
        {viewing && (
          <div className="space-y-4">
            {Object.entries(
              viewing.permissions.reduce<Record<string, typeof viewing.permissions>>((acc, p) => {
                ;(acc[p.resource] ??= []).push(p)
                return acc
              }, {}),
            )
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([resource, perms]) => (
                <div key={resource}>
                  <p className="mb-1.5 text-sm font-semibold text-ink">{humanize(resource)}</p>
                  <div className="space-y-2">
                    {perms.map((p, i) => (
                      <div key={i}>
                        <Badge tone="neutral">
                          {humanize(p.action)} · {p.scope}
                        </Badge>
                        {p.description && (
                          <p className="mt-1 text-sm text-ink-muted">{p.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </Dialog>
    </div>
  )
}
