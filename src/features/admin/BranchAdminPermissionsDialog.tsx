import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listBranches } from '@/lib/api/admin'
import { updateBranchAdminPermissions } from '@/lib/api/branchAdmins'
import { qk } from '@/lib/queryKeys'
import { useMutationWithToast } from '@/lib/useMutationWithToast'
import { useToast } from '@/components/ui/Toast'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Select } from '@/components/ui/Field'
import { cn } from '@/lib/cn'
import type { BranchAdminPermissions } from '@/types'

const TOGGLES: {
  key: keyof Omit<
    BranchAdminPermissions,
    'user_id' | 'full_name' | 'email' | 'branch_id' | 'branch_name'
  >
  label: string
  onLabel: string
  offLabel: string
  description: string
}[] = [
  {
    key: 'case_reassignment',
    label: 'Case reassignment',
    onLabel: 'Can reassign',
    offLabel: 'View-only',
    description: 'Reassign cases among associates/advocates within this branch.',
  },
  {
    key: 'fee_milestone_setting',
    label: 'Fee milestone setting',
    onLabel: 'Can set milestones',
    offLabel: 'Track & remind only',
    description: 'Create new fee milestones, not just track and remind on existing ones.',
  },
  {
    key: 'precedent_sharing',
    label: 'Precedent sharing',
    onLabel: 'Can share',
    offLabel: 'MD-only',
    description: 'Attach past judgments/study material to an advocate or case.',
  },
  {
    key: 'invite_team_members',
    label: 'Invite team members',
    onLabel: 'Can invite',
    offLabel: 'MD-only',
    description: 'Invite Associates/Advocates into this branch.',
  },
  {
    key: 'document_access_full',
    label: 'Document access level',
    onLabel: 'Full access',
    offLabel: 'Restricted',
    description: "Sees sealed/certified documents, not just the branch's ordinary files.",
  },
]

export function BranchAdminPermissionsDialog({
  open,
  onClose,
  admin,
}: {
  open: boolean
  onClose: () => void
  admin: BranchAdminPermissions
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [branchId, setBranchId] = useState(admin.branch_id ?? '')
  const [toggles, setToggles] = useState(() => ({
    case_reassignment: admin.case_reassignment,
    fee_milestone_setting: admin.fee_milestone_setting,
    precedent_sharing: admin.precedent_sharing,
    invite_team_members: admin.invite_team_members,
    document_access_full: admin.document_access_full,
  }))

  const branchesQuery = useQuery({ queryKey: qk.branches, queryFn: listBranches, enabled: open })

  const mutation = useMutationWithToast({
    mutationFn: () =>
      updateBranchAdminPermissions(admin.user_id, { branch_id: branchId, ...toggles }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.branchAdmins })
      toast('Permissions updated.', 'success')
      onClose()
    },
    errorFallback: 'Could not update permissions.',
  })

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Permissions — ${admin.full_name}`}
      description="MD-only. Whatever's off is still visible to this Branch Admin as read-only."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={mutation.isPending} disabled={!branchId} onClick={() => mutation.mutate()}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Branch(es) assigned" htmlFor="branch-admin-branch">
          <Select id="branch-admin-branch" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">Select a branch…</option>
            {(branchesQuery.data ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>

        <div className="space-y-3">
          {TOGGLES.map((t) => {
            const enabled = toggles[t.key]
            return (
              <div
                key={t.key}
                className="flex items-center justify-between gap-4 rounded-control border border-border bg-surface-muted px-3.5 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{t.label}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">{t.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setToggles((prev) => ({ ...prev, [t.key]: !prev[t.key] }))}
                  className={cn(
                    'shrink-0 rounded-control border px-3 py-1.5 text-xs font-medium transition-colors',
                    enabled
                      ? 'border-brand/30 bg-brand-soft text-brand-strong'
                      : 'border-border-strong text-ink-muted hover:text-ink',
                  )}
                >
                  {enabled ? t.onLabel : t.offLabel}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </Dialog>
  )
}
