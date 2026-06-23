import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, KeyRound, Lock, Pencil, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react'
import {
  adminResetPassword,
  assignRoles,
  deleteUser,
  inviteUser,
  listBranches,
  listRoles,
  listUsers,
  updateUser,
} from '@/lib/api/admin'
import { qk } from '@/lib/queryKeys'
import { initials } from '@/lib/format'
import { useMutationWithToast } from '@/lib/useMutationWithToast'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select } from '@/components/ui/Field'
import { Badge } from '@/components/ui/Badge'
import { Table, TBody, Td, Th, THead, TableWrap, Tr } from '@/components/ui/Table'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/Feedback'
import { cn } from '@/lib/cn'
import type { Branch, User } from '@/types'

export default function UsersPage() {
  const queryClient = useQueryClient()
  const { isManagingDirector } = useAuth()
  const [inviting, setInviting] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [managingRoles, setManagingRoles] = useState<User | null>(null)
  const [deleting, setDeleting] = useState<User | null>(null)
  const [resettingPassword, setResettingPassword] = useState<User | null>(null)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: qk.users,
    queryFn: listUsers,
  })
  const rolesQuery = useQuery({ queryKey: qk.roles, queryFn: listRoles })
  const branchesQuery = useQuery({
    queryKey: qk.branches,
    queryFn: listBranches,
    enabled: isManagingDirector,
  })

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: qk.users })
  }

  const users = data ?? []
  const roleName = (id: string) => rolesQuery.data?.find((r) => r.id === id)?.name ?? id.slice(0, 6)
  const branchName = (id: string | null) =>
    id ? branchesQuery.data?.find((b) => b.id === id)?.name ?? id.slice(0, 6) : 'Org-wide'

  return (
    <div className="animate-rise">
      <PageHeader
        title="Users"
        description="People in your organization and their roles."
        actions={
          <Button onClick={() => setInviting(true)}>
            <UserPlus className="size-4" /> Invite user
          </Button>
        }
      />

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : users.length === 0 ? (
        <TableWrap>
          <EmptyState icon={Users} title="No users yet" />
        </TableWrap>
      ) : (
        <TableWrap>
          <Table>
            <THead>
              <Tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Branch</Th>
                <Th>Roles</Th>
                <Th>Access</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {users.map((u) => (
                <Tr key={u.id} className="hover:bg-surface-muted">
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <span className="grid size-8 place-items-center rounded-full bg-shell text-xs font-semibold text-white">
                        {initials(u.full_name)}
                      </span>
                      <span className="font-medium text-ink">{u.full_name}</span>
                    </div>
                  </Td>
                  <Td className="text-ink-muted">{u.email}</Td>
                  <Td className="text-ink-muted">{branchName(u.branch_id)}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {u.role_ids.length === 0 ? (
                        <span className="text-ink-faint">—</span>
                      ) : (
                        u.role_ids.map((id) => (
                          <Badge key={id} tone="neutral">
                            {roleName(id)}
                          </Badge>
                        ))
                      )}
                    </div>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap items-center gap-1">
                      {u.is_org_admin ? (
                        <Badge tone="brand">
                          <ShieldCheck className="size-3.5" /> Managing Director
                        </Badge>
                      ) : u.is_branch_admin ? (
                        <Badge tone="brand">
                          <Building2 className="size-3.5" /> Branch Admin
                        </Badge>
                      ) : (
                        <span className="text-ink-faint">Member</span>
                      )}
                      {!u.is_active && <Badge tone="neutral">Pending</Badge>}
                      {u.is_restricted && (
                        <Badge tone="warning">
                          <Lock className="size-3.5" /> Read-only
                        </Badge>
                      )}
                    </div>
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setManagingRoles(u)}>
                        <ShieldCheck className="size-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setResettingPassword(u)}>
                        <KeyRound className="size-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(u)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleting(u)}>
                        <Trash2 className="size-4 text-danger" />
                      </Button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      )}

      {inviting && (
        <InviteDialog
          branches={branchesQuery.data ?? []}
          isManagingDirector={isManagingDirector}
          onClose={() => setInviting(false)}
          onDone={invalidate}
        />
      )}
      {editing && (
        <EditUserDialog
          user={editing}
          branches={branchesQuery.data ?? []}
          isManagingDirector={isManagingDirector}
          onClose={() => setEditing(null)}
          onDone={invalidate}
        />
      )}
      {managingRoles && (
        <RolesDialog
          user={managingRoles}
          roles={(rolesQuery.data ?? []).map((r) => ({ id: r.id, name: r.name }))}
          onClose={() => setManagingRoles(null)}
          onDone={invalidate}
        />
      )}
      <Dialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Remove user"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <DeleteButton user={deleting} onDone={() => { invalidate(); setDeleting(null) }} />
          </>
        }
      >
        <p className="text-sm text-ink-muted">
          Remove <span className="font-medium text-ink">{deleting?.full_name}</span> from the
          organization?
        </p>
      </Dialog>
      <Dialog
        open={!!resettingPassword}
        onClose={() => setResettingPassword(null)}
        title="Reset password"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setResettingPassword(null)}>
              Cancel
            </Button>
            <ResetPasswordButton
              user={resettingPassword}
              onDone={() => setResettingPassword(null)}
            />
          </>
        }
      >
        <p className="text-sm text-ink-muted">
          Send a password reset link to{' '}
          <span className="font-medium text-ink">{resettingPassword?.full_name}</span>?
        </p>
      </Dialog>
    </div>
  )
}

function InviteDialog({
  branches,
  isManagingDirector,
  onClose,
  onDone,
}: {
  branches: Branch[]
  isManagingDirector: boolean
  onClose: () => void
  onDone: () => void
}) {
  const { toast } = useToast()
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [branchId, setBranchId] = useState('')
  const [isBranchAdmin, setIsBranchAdmin] = useState(false)
  const mutation = useMutationWithToast({
    mutationFn: () =>
      inviteUser({
        email,
        full_name: fullName,
        phone: phone || undefined,
        ...(isManagingDirector
          ? { branch_id: branchId || null, is_branch_admin: isBranchAdmin }
          : {}),
      }),
    onSuccess: () => {
      toast('Invitation sent.', 'success')
      onDone()
      onClose()
    },
    errorFallback: 'Invite failed.',
  })
  return (
    <Dialog
      open
      onClose={onClose}
      title="Invite user"
      description="They'll receive an email to set up their account."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="invite-form" loading={mutation.isPending}>
            Send invite
          </Button>
        </>
      }
    >
      <form
        id="invite-form"
        onSubmit={(e: FormEvent) => {
          e.preventDefault()
          mutation.mutate()
        }}
        className="space-y-4"
      >
        <Field label="Full name" required>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </Field>
        <Field label="Email" required>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Phone" hint="Optional">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        {isManagingDirector && (
          <>
            <Field label="Branch" hint="Leave unset for an org-wide user.">
              <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="">Org-wide (no branch)</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
            <label className="flex items-center gap-2.5 text-sm text-ink">
              <input
                type="checkbox"
                checked={isBranchAdmin}
                onChange={(e) => setIsBranchAdmin(e.target.checked)}
                disabled={!branchId}
              />
              Branch Admin (manages only the selected branch)
            </label>
          </>
        )}
      </form>
    </Dialog>
  )
}

function EditUserDialog({
  user,
  branches,
  isManagingDirector,
  onClose,
  onDone,
}: {
  user: User
  branches: Branch[]
  isManagingDirector: boolean
  onClose: () => void
  onDone: () => void
}) {
  const { toast } = useToast()
  const [fullName, setFullName] = useState(user.full_name)
  const [phone, setPhone] = useState(user.phone ?? '')
  const [isAdmin, setIsAdmin] = useState(user.is_org_admin)
  const [branchId, setBranchId] = useState(user.branch_id ?? '')
  const [isBranchAdmin, setIsBranchAdmin] = useState(user.is_branch_admin)
  const [isRestricted, setIsRestricted] = useState(user.is_restricted)
  const mutation = useMutationWithToast({
    mutationFn: () =>
      updateUser(user.id, {
        full_name: fullName,
        phone: phone || undefined,
        is_org_admin: isAdmin,
        ...(isManagingDirector
          ? { branch_id: branchId || null, is_branch_admin: isBranchAdmin, is_restricted: isRestricted }
          : {}),
      }),
    onSuccess: () => {
      toast('User updated.', 'success')
      onDone()
      onClose()
    },
    errorFallback: 'Update failed.',
  })
  return (
    <Dialog
      open
      onClose={onClose}
      title="Edit user"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="edit-user-form" loading={mutation.isPending}>
            Save
          </Button>
        </>
      }
    >
      <form
        id="edit-user-form"
        onSubmit={(e: FormEvent) => {
          e.preventDefault()
          mutation.mutate()
        }}
        className="space-y-4"
      >
        <Field label="Full name">
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field label="Phone">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <label className="flex items-center gap-2.5 text-sm text-ink">
          <input
            type="checkbox"
            checked={isAdmin}
            onChange={(e) => setIsAdmin(e.target.checked)}
          />
          Managing Director (organization-wide administrator)
        </label>
        {isManagingDirector && (
          <>
            <Field label="Branch" hint="Leave unset for an org-wide user.">
              <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="">Org-wide (no branch)</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
            <label className="flex items-center gap-2.5 text-sm text-ink">
              <input
                type="checkbox"
                checked={isBranchAdmin}
                onChange={(e) => setIsBranchAdmin(e.target.checked)}
                disabled={!branchId}
              />
              Branch Admin (manages only the selected branch)
            </label>
            <label className="flex items-center gap-2.5 text-sm text-ink">
              <input
                type="checkbox"
                checked={isRestricted}
                onChange={(e) => setIsRestricted(e.target.checked)}
              />
              Read-only access (can view but not make any changes)
            </label>
          </>
        )}
      </form>
    </Dialog>
  )
}

function RolesDialog({
  user,
  roles,
  onClose,
  onDone,
}: {
  user: User
  roles: { id: string; name: string }[]
  onClose: () => void
  onDone: () => void
}) {
  const { toast } = useToast()
  const [selected, setSelected] = useState<string[]>(user.role_ids)
  const mutation = useMutationWithToast({
    mutationFn: () => assignRoles(user.id, selected),
    onSuccess: () => {
      toast('Roles updated.', 'success')
      onDone()
      onClose()
    },
    errorFallback: 'Could not assign roles.',
  })
  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }
  return (
    <Dialog
      open
      onClose={onClose}
      title="Manage roles"
      description={user.full_name}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={mutation.isPending} onClick={() => mutation.mutate()}>
            Save roles
          </Button>
        </>
      }
    >
      {roles.length === 0 ? (
        <p className="text-sm text-ink-muted">No roles defined yet.</p>
      ) : (
        <div className="space-y-1">
          {roles.map((r) => {
            const checked = selected.includes(r.id)
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => toggle(r.id)}
                className={cn(
                  'flex w-full items-center justify-between rounded-control px-3 py-2.5 text-left text-sm',
                  checked ? 'bg-brand-soft text-brand-strong' : 'hover:bg-surface-muted',
                )}
              >
                {r.name}
                <span
                  className={cn(
                    'grid size-5 place-items-center rounded border text-xs',
                    checked ? 'border-brand bg-brand text-white' : 'border-border-strong',
                  )}
                >
                  {checked && '✓'}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </Dialog>
  )
}

function DeleteButton({ user, onDone }: { user: User | null; onDone: () => void }) {
  const { toast } = useToast()
  const mutation = useMutationWithToast({
    mutationFn: () => deleteUser(user!.id),
    onSuccess: () => {
      toast('User removed.', 'success')
      onDone()
    },
    errorFallback: 'Delete failed.',
  })
  return (
    <Button variant="danger" loading={mutation.isPending} onClick={() => mutation.mutate()}>
      Remove
    </Button>
  )
}

function ResetPasswordButton({ user, onDone }: { user: User | null; onDone: () => void }) {
  const { toast } = useToast()
  const mutation = useMutationWithToast({
    mutationFn: () => adminResetPassword(user!.id),
    onSuccess: () => {
      toast('Reset link sent.', 'success')
      onDone()
    },
    errorFallback: 'Could not send reset link.',
  })
  return (
    <Button loading={mutation.isPending} onClick={() => mutation.mutate()}>
      Send reset link
    </Button>
  )
}
