import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ShieldCheck } from 'lucide-react'
import { listBranchAdmins } from '@/lib/api/branchAdmins'
import { qk } from '@/lib/queryKeys'
import { PageHeader } from '@/components/ui/PageHeader'
import { PersonAvatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/Feedback'
import { cn } from '@/lib/cn'
import { BranchAdminPermissionsDialog } from './BranchAdminPermissionsDialog'
import type { BranchAdminPermissions } from '@/types'

const TOGGLE_LABELS: [keyof BranchAdminPermissions, string][] = [
  ['case_reassignment', 'Reassign'],
  ['fee_milestone_setting', 'Fee milestones'],
  ['precedent_sharing', 'Precedents'],
  ['invite_team_members', 'Invites'],
  ['document_access_full', 'Sealed docs'],
]

export default function BranchAdminsPage() {
  const [editing, setEditing] = useState<BranchAdminPermissions | null>(null)
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: qk.branchAdmins,
    queryFn: listBranchAdmins,
  })

  const admins = data ?? []

  return (
    <div className="animate-rise">
      <PageHeader
        title="Branch Admin Management"
        description="Control what each Branch Admin can do within their branch."
      />

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : admins.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No Branch Admins yet"
          description="Invite someone as a Branch Admin from the Users page, then manage their permissions here."
        />
      ) : (
        <div className="rounded-card border border-border bg-surface">
          {admins.map((admin) => (
            <div
              key={admin.user_id}
              className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-0"
            >
              <PersonAvatar label={admin.full_name} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{admin.full_name}</p>
                <p className="text-xs text-ink-muted">
                  {admin.email} · {admin.branch_name ?? 'No branch assigned'}
                </p>
              </div>
              <div className="hidden flex-wrap items-center gap-3 sm:flex">
                {TOGGLE_LABELS.map(([key, label]) => (
                  <span key={key} className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
                    <span
                      className={cn('dot', admin[key] ? 'bg-success' : 'bg-ink-faint')}
                      aria-hidden
                    />
                    {label}
                  </span>
                ))}
              </div>
              <Button size="sm" variant="secondary" onClick={() => setEditing(admin)}>
                Edit permissions
              </Button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <BranchAdminPermissionsDialog
          open
          admin={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
