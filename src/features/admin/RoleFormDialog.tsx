import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye } from 'lucide-react'
import { createRole, listPermissions, previewRole, updateRole } from '@/lib/api/admin'
import { qk } from '@/lib/queryKeys'
import { humanize } from '@/lib/format'
import { useMutationWithToast } from '@/lib/useMutationWithToast'
import { useToast } from '@/components/ui/Toast'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'
import type { Permission, Role, RolePreviewResponse } from '@/types'

const keyOf = (p: Permission) => `${p.resource}:${p.action}:${p.scope}`

export function RoleFormDialog({
  open,
  onClose,
  role,
}: {
  open: boolean
  onClose: () => void
  role?: Role
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [name, setName] = useState(role?.name ?? '')
  const [description, setDescription] = useState(role?.description ?? '')
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set((role?.permissions ?? []).map(keyOf)),
  )
  const [preview, setPreview] = useState<RolePreviewResponse | null>(null)

  const permsQuery = useQuery({ queryKey: qk.permissions, queryFn: listPermissions, enabled: open })
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

  const chosen = useMemo(
    () => allPerms.filter((p) => selected.has(keyOf(p))),
    [allPerms, selected],
  )

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
      onClose()
    },
    errorFallback: 'Could not save role.',
  })

  const runPreview = useMutationWithToast({
    mutationFn: () => previewRole(chosen),
    onSuccess: (data) => setPreview(data),
    errorFallback: 'Preview failed.',
  })

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={role ? 'Edit role' : 'New role'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={save.isPending} disabled={!name} onClick={() => save.mutate()}>
            {role ? 'Save role' : 'Create role'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Role name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="Description">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
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
            <div className="max-h-72 space-y-4 overflow-y-auto rounded-card border border-border p-3 scrollbar-thin">
              {grouped.map(([resource, perms]) => (
                <div key={resource}>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                    {humanize(resource)}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {perms.map((p) => {
                      const active = selected.has(keyOf(p))
                      return (
                        <button
                          key={keyOf(p)}
                          type="button"
                          onClick={() => toggle(p)}
                          className={cn(
                            'rounded-control border px-2.5 py-1 text-xs font-medium transition-colors',
                            active
                              ? 'border-brand bg-brand text-white'
                              : 'border-border-strong text-ink-muted hover:border-brand hover:text-brand',
                          )}
                        >
                          {humanize(p.action)}
                          <span className="ml-1 opacity-70">· {p.scope}</span>
                        </button>
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
      </div>
    </Dialog>
  )
}
