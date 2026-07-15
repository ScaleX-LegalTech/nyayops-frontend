import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye } from 'lucide-react'
import { createRole, listPermissions, listRoles, previewRole, updateRole } from '@/lib/api/admin'
import { qk } from '@/lib/queryKeys'
import { humanize } from '@/lib/format'
import { useMutationWithToast } from '@/lib/useMutationWithToast'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Field, Input } from '@/components/ui/Field'
import { Badge } from '@/components/ui/Badge'
import { LoadingState } from '@/components/ui/Feedback'
import type { Permission, RolePreviewResponse } from '@/types'

const keyOf = (p: Permission) => `${p.resource}:${p.action}:${p.scope}`

// Short, plain-English framing per resource group - the individual permission
// descriptions (from the backend catalog) cover the specifics.
const RESOURCE_BLURBS: Record<string, string> = {
  cases: 'Casework: creating, editing, assigning, and reviewing cases.',
  documents: 'Uploading, editing, sealing, and deleting case documents.',
  users: 'Managing who has an account in the organization.',
  roles: 'Managing roles and what they can do.',
  reports: 'Organization-wide reporting.',
  audit: "Visibility into the organization's audit trail.",
  issues: 'Flagging and resolving blockers raised on a case.',
  payment_milestones: 'Tracking fee milestones on a case.',
  precedents: 'Sharing and viewing precedent documents.',
}

export default function RoleEditPage() {
  const { roleId } = useParams<{ roleId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const rolesQuery = useQuery({ queryKey: qk.roles, queryFn: listRoles, enabled: !!roleId })
  const role = roleId ? rolesQuery.data?.find((r) => r.id === roleId) : undefined

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [preview, setPreview] = useState<RolePreviewResponse | null>(null)

  // Hydrate the form once the role loads, per React's documented pattern for
  // adjusting state in response to changed data during render (not an effect) -
  // see https://react.dev/learn/you-might-not-need-an-effect.
  const [hydratedFor, setHydratedFor] = useState<string | undefined>(undefined)
  if (role && hydratedFor !== role.id) {
    setHydratedFor(role.id)
    setName(role.name)
    setDescription(role.description ?? '')
    setSelected(new Set(role.permissions.map(keyOf)))
  }

  const permsQuery = useQuery({ queryKey: qk.permissions, queryFn: listPermissions })
  const allPerms = useMemo(() => permsQuery.data ?? [], [permsQuery.data])

  const grouped = useMemo(() => {
    const map = new Map<string, Permission[]>()
    for (const p of allPerms) {
      const list = map.get(p.resource) ?? []
      list.push(p)
      map.set(p.resource, list)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [allPerms])

  const chosen = useMemo(() => allPerms.filter((p) => selected.has(keyOf(p))), [allPerms, selected])

  function toggle(p: Permission) {
    setPreview(null)
    setSelected((prev) => {
      const next = new Set(prev)
      const k = keyOf(p)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  const save = useMutationWithToast({
    mutationFn: () => {
      const payload = { name, description: description || undefined, permissions: chosen }
      return role ? updateRole(role.id, payload) : createRole(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.roles })
      toast(role ? 'Role updated.' : 'Role created.', 'success')
      navigate(-1)
    },
    errorFallback: 'Could not save role.',
  })

  const runPreview = useMutationWithToast({
    mutationFn: () => previewRole(chosen),
    onSuccess: (data) => setPreview(data),
    errorFallback: 'Preview failed.',
  })

  if (roleId && rolesQuery.isLoading) return <LoadingState />

  return (
    <div className="animate-rise max-w-3xl">
      <PageHeader
        title={role ? `Edit role — ${role.name}` : 'New role'}
        description="Define what this role can see and do. Each permission below shows exactly what it grants."
      />

      <Card>
        <CardBody className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Role name" required>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field label="Description">
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-ink">Permissions ({chosen.length})</p>
              <Button
                size="sm"
                variant="secondary"
                loading={runPreview.isPending}
                disabled={chosen.length === 0}
                onClick={() => runPreview.mutate()}
              >
                <Eye className="size-4" /> Preview access
              </Button>
            </div>

            {permsQuery.isLoading ? (
              <p className="text-sm text-ink-muted">Loading permissions…</p>
            ) : (
              <div className="space-y-5">
                {grouped.map(([resource, perms]) => (
                  <div key={resource} className="rounded-card border border-border">
                    <div className="border-b border-border bg-surface-muted px-4 py-2.5">
                      <p className="text-sm font-semibold text-ink">{humanize(resource)}</p>
                      {RESOURCE_BLURBS[resource] && (
                        <p className="text-xs text-ink-muted">{RESOURCE_BLURBS[resource]}</p>
                      )}
                    </div>
                    <div className="divide-y divide-border">
                      {perms.map((p) => {
                        const k = keyOf(p)
                        const active = selected.has(k)
                        return (
                          <label
                            key={k}
                            className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-surface-muted"
                          >
                            <input
                              type="checkbox"
                              checked={active}
                              onChange={() => toggle(p)}
                              className="mt-0.5 size-4 shrink-0 accent-brand"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-ink">
                                {humanize(p.action)}
                                <span className="ml-1.5 font-normal text-ink-faint">· {p.scope}</span>
                              </p>
                              {p.description && (
                                <p className="mt-0.5 text-xs text-ink-muted">{p.description}</p>
                              )}
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {preview && (
            <div className="rounded-card border border-brand/20 bg-brand-soft/50 p-3">
              <p className="mb-2 flex items-center gap-2 text-sm font-medium text-brand-strong">
                Effective access
                <Badge tone={preview.can_manage_documents ? 'success' : 'neutral'}>
                  {preview.can_manage_documents ? 'Can manage documents' : 'No document management'}
                </Badge>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {preview.effective_permissions.map((p) => (
                  <Badge key={keyOf(p)} tone="neutral">
                    {humanize(p.resource)}:{humanize(p.action)} · {p.scope}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={() => navigate(-1)}>
          Cancel
        </Button>
        <Button loading={save.isPending} disabled={!name} onClick={() => save.mutate()}>
          {role ? 'Save role' : 'Create role'}
        </Button>
      </div>
    </div>
  )
}
