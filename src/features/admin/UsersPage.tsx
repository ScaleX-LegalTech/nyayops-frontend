import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Building2,
  KeyRound,
  Lock,
  MoreVertical,
  Pencil,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react'
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
import { useMutationWithToast } from '@/lib/useMutationWithToast'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select } from '@/components/ui/Field'
import { Badge } from '@/components/ui/Badge'
import { PersonAvatar } from '@/components/ui/Avatar'
import { Table, TBody, Td, Th, THead, TableWrap, Tr } from '@/components/ui/Table'
import { EmptyState, ErrorState, LoadingState, Spinner } from '@/components/ui/Feedback'
import { cn } from '@/lib/cn'
import type { Branch, User } from '@/types'

const PAGE_SIZE = 50

export default function UsersPage() {
  const queryClient = useQueryClient()
  const { isManagingDirector } = useAuth()
  const [inviting, setInviting] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [managingRoles, setManagingRoles] = useState<User | null>(null)
  const [deleting, setDeleting] = useState<User | null>(null)
  const [resettingPassword, setResettingPassword] = useState<User | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: qk.usersPage(),
    queryFn: ({ pageParam }) => listUsers({ limit: PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.has_more ? allPages.reduce((sum, page) => sum + page.items.length, 0) : undefined,
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

  const users = data?.pages.flatMap((page) => page.items) ?? []
  const roleName = (id: string) => rolesQuery.data?.find((r) => r.id === id)?.name ?? id.slice(0, 6)
  const branchName = (id: string | null) =>
    id ? branchesQuery.data?.find((b) => b.id === id)?.name ?? id.slice(0, 6) : 'Org-wide'

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { rootMargin: '400px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

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
        <>
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
                      <PersonAvatar label={u.full_name} size="sm" />
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
                    <div className="flex justify-end">
                      <RowActionsMenu
                        onManageRoles={() => setManagingRoles(u)}
                        onResetPassword={() => setResettingPassword(u)}
                        onEdit={() => setEditing(u)}
                        onDelete={() => setDeleting(u)}
                      />
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableWrap>
        <div ref={sentinelRef} className="flex justify-center py-4">
          {isFetchingNextPage && <Spinner />}
        </div>
        </>
      )}

      {inviting && (
        <InviteDialog
          branches={branchesQuery.data ?? []}
          roles={(rolesQuery.data ?? []).map((r) => ({ id: r.id, name: r.name }))}
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

function RowActionsMenu({
  onManageRoles,
  onResetPassword,
  onEdit,
  onDelete,
}: {
  onManageRoles: () => void
  onResetPassword: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  function toggle() {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    }
    setOpen((v) => !v)
  }

  function run(action: () => void) {
    setOpen(false)
    action()
  }

  return (
    <>
      <Button size="icon" variant="ghost" ref={triggerRef} onClick={toggle} aria-label="Open actions">
        <MoreVertical className="size-4" />
      </Button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed w-48 overflow-hidden rounded-card border border-border bg-surface shadow-pop animate-rise"
            style={{ top: pos.top, right: pos.right, zIndex: 'var(--z-dropdown)' }}
          >
          <button
            onClick={() => run(onManageRoles)}
            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-ink hover:bg-surface-muted"
          >
            <ShieldCheck className="size-4 text-ink-muted" /> Manage roles
          </button>
          <button
            onClick={() => run(onResetPassword)}
            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-ink hover:bg-surface-muted"
          >
            <KeyRound className="size-4 text-ink-muted" /> Reset password
          </button>
          <button
            onClick={() => run(onEdit)}
            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-ink hover:bg-surface-muted"
          >
            <Pencil className="size-4 text-ink-muted" /> Edit user
          </button>
          <button
            onClick={() => run(onDelete)}
            className="flex w-full items-center gap-2.5 border-t border-border px-3.5 py-2.5 text-left text-sm text-danger hover:bg-danger-soft"
          >
            <Trash2 className="size-4" /> Remove user
          </button>
          </div>,
          document.body,
        )}
    </>
  )
}

function InviteDialog({
  branches,
  roles,
  isManagingDirector,
  onClose,
  onDone,
}: {
  branches: Branch[]
  roles: { id: string; name: string }[]
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
  const [roleIds, setRoleIds] = useState<string[]>([])
  function toggleRole(id: string) {
    setRoleIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }
  const mutation = useMutationWithToast({
    mutationFn: () =>
      inviteUser({
        email,
        full_name: fullName,
        phone: phone || undefined,
        role_ids: roleIds,
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
        <Field label="Roles" hint="Without a role the user will be locked out of most pages.">
          {roles.length === 0 ? (
            <p className="text-sm text-ink-muted">No roles defined yet.</p>
          ) : (
            <div className="space-y-1">
              {roles.map((r) => {
                const checked = roleIds.includes(r.id)
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggleRole(r.id)}
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
        </Field>
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
