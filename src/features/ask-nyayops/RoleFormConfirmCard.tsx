import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, X } from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/auth/AuthContext'
import { qk } from '@/lib/queryKeys'
import { describeAskNyayOpsError, recordAssistantAuditEvent } from '@/lib/api/askNyayOps'
import { createRole, listPermissions, updateRole } from '@/lib/api/admin'
import { ActionCardHeader, VoiceTranscriptNote } from './actionCardKit'
import { PermissionAccordion } from './PermissionAccordion'
import { permissionKey } from './permissionKey'
import { idFromWouldAffect } from './pendingActionHandlers'
import type { PendingAction, Permission } from '@/types'

interface RoleFormConfirmCardProps {
  pendingAction: PendingAction
  onResolved: (message?: string) => void
  voiceTranscript?: string
}

/** role.create/role.update's dedicated confirm UI (redesign brief §6) - a
 * structured name/description form plus a collapsible permission accordion,
 * not the generic before/after diff that would otherwise dump a raw
 * permissions array as text. Confirm calls the same real createRole/
 * updateRole endpoints the standalone RoleEditPage form uses. */
export function RoleFormConfirmCard({ pendingAction, onResolved, voiceTranscript }: RoleFormConfirmCardProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const isUpdate = pendingAction.action_type === 'role.update'
  const after = pendingAction.after_state as {
    name: string
    description?: string | null
    permissions: { resource: string; action: string; scope: string }[]
  }
  const { data: catalog } = useQuery({ queryKey: qk.permissions, queryFn: listPermissions })
  const [name, setName] = useState(after.name)
  const [description, setDescription] = useState(after.description ?? '')
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(after.permissions.map(permissionKey)),
  )
  const [busy, setBusy] = useState(false)

  function toggle(p: Permission) {
    setSelected((prev) => {
      const next = new Set(prev)
      const k = permissionKey(p)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  const chosen = useMemo(
    () => (catalog ?? []).filter((p) => selected.has(permissionKey(p))),
    [catalog, selected],
  )

  async function handleConfirm() {
    setBusy(true)
    try {
      const payload = { name, description: description || undefined, permissions: chosen }
      const role = isUpdate
        ? await updateRole(idFromWouldAffect(pendingAction, 'role'), payload)
        : await createRole(payload)
      await recordAssistantAuditEvent({
        action_type: 'ASSISTANT_HITL_APPROVED',
        resource_id: role.id,
        new_state: {
          action_type: pendingAction.action_type,
          approved_by: user?.sub,
          name,
          permission_count: chosen.length,
        },
      })
      toast(isUpdate ? 'Role updated.' : 'Role created.', 'success')
      onResolved(`Done! ${isUpdate ? 'Updated' : 'Created'} the role "${name}".`)
    } catch (err) {
      toast(describeAskNyayOpsError(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="animate-message-in mt-2 border-border-strong shadow-sm">
      <ActionCardHeader
        actionType={pendingAction.action_type}
        tier={pendingAction.tier}
        title={isUpdate ? 'Update role' : 'Create role'}
        description="Ask NyayOps drafted this - review the permissions before confirming."
      />
      <CardBody className="flex flex-col gap-3">
        {voiceTranscript && <VoiceTranscriptNote text={voiceTranscript} />}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Role name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Description">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>
        <Field label={`Permissions (${chosen.length})`}>
          <PermissionAccordion selected={selected} onToggle={toggle} editable />
        </Field>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onResolved("Okay, I've discarded that - let me know if you'd like something else.")}
            disabled={busy}
          >
            <X className="size-4" /> Discard
          </Button>
          <Button size="sm" loading={busy} disabled={!name.trim()} onClick={handleConfirm}>
            <Check className="size-4" /> {isUpdate ? 'Save role' : 'Create role'}
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}
