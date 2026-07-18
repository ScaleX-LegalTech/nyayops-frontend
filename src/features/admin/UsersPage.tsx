import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Ban,
  Building2,
  KeyRound,
  Lock,
  MoreVertical,
  Pencil,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
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
import { useFloatingPanel, useOutsideClose } from '@/components/ui/useFloatingPanel'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select } from '@/components/ui/Field'
import { Badge } from '@/components/ui/Badge'
import { PersonAvatar } from '@/components/ui/Avatar'
import { Table, TBody, Td, Th, THead, TableWrap, Tr } from '@/components/ui/Table'
import { EmptyState, ErrorState, LoadingState, Spinner } from '@/components/ui/Feedback'
import { cn } from '@/lib/cn'
import { displayName } from '@/lib/formatName'
import type { Branch, SortDir, User, UserSearchFilters, UserSortBy, UserStatus } from '@/types'

const PAGE_SIZE = 50

const STATUS_OPTIONS: { value: UserStatus | ''; label: string }[] = [
  { value: '', label: 'Any status' },
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending invitation' },
  { value: 'suspended', label: 'Suspended' },
]

const SORT_COLUMNS: { key: UserSortBy; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'branch', label: 'Branch' },
  { key: 'joined_at', label: 'Joined' },
]

export default function UsersPage() {
  const queryClient = useQueryClient()
  const { user, isManagingDirector } = useAuth()
  const currentUserId = user?.sub
  const [inviting, setInviting] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [managingRoles, setManagingRoles] = useState<User | null>(null)
  const [deleting, setDeleting] = useState<User | null>(null)
  const [resettingPassword, setResettingPassword] = useState<User | null>(null)
  const [suspending, setSuspending] = useState<User | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [branchId, setBranchId] = useState('')
  const [roleId, setRoleId] = useState('')
  const [status, setStatus] = useState<UserStatus | ''>('')
  const [joinedFrom, setJoinedFrom] = useState('')
  const [joinedTo, setJoinedTo] = useState('')
  const [sortBy, setSortBy] = useState<UserSortBy>('joined_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q), 350)
    return () => clearTimeout(timer)
  }, [q])

  const filters: UserSearchFilters = useMemo(
    () => ({
      q: debouncedQ.trim() || undefined,
      branch_id: branchId || undefined,
      role_id: roleId || undefined,
      status: status || undefined,
      joined_from: joinedFrom || undefined,
      joined_to: joinedTo || undefined,
      sort_by: sortBy,
      sort_dir: sortDir,
    }),
    [debouncedQ, branchId, roleId, status, joinedFrom, joinedTo, sortBy, sortDir],
  )

  function toggleSort(col: UserSortBy) {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(col)
      setSortDir('asc')
    }
  }

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
    queryKey: qk.usersPage(filters),
    queryFn: ({ pageParam }) => listUsers({ ...filters, limit: PAGE_SIZE, offset: pageParam }),
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
  const hasFilters = Boolean(q || branchId || roleId || status || joinedFrom || joinedTo)

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

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-64 flex-1">
          <Field label="Search">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Name, email, branch, role or access..."
                className="pl-9"
              />
            </div>
          </Field>
        </div>
        {isManagingDirector && (
          <Field label="Branch" className="w-44">
            <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">All branches</option>
              {(branchesQuery.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Role" className="w-44">
          <Select value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            <option value="">All roles</option>
            {(rolesQuery.data ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" className="w-44">
          <Select value={status} onChange={(e) => setStatus(e.target.value as UserStatus | '')}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Joined from">
          <Input type="date" value={joinedFrom} onChange={(e) => setJoinedFrom(e.target.value)} />
        </Field>
        <Field label="Joined to">
          <Input type="date" value={joinedTo} onChange={(e) => setJoinedTo(e.target.value)} />
        </Field>
        {hasFilters && (
          <Button
            variant="ghost"
            onClick={() => {
              setQ('')
              setDebouncedQ('')
              setBranchId('')
              setRoleId('')
              setStatus('')
              setJoinedFrom('')
              setJoinedTo('')
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

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
                {SORT_COLUMNS.map((col) => (
                  <Th key={col.key}>
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className="flex items-center gap-1 hover:text-ink"
                    >
                      {col.label}
                      {sortBy === col.key ? (
                        sortDir === 'asc' ? (
                          <ArrowUp className="size-3.5" />
                        ) : (
                          <ArrowDown className="size-3.5" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3.5 opacity-40" />
                      )}
                    </button>
                  </Th>
                ))}
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
                      <span className="font-medium text-ink">{displayName(u)}</span>
                    </div>
                  </Td>
                  <Td className="text-ink-muted">{u.email}</Td>
                  <Td className="text-ink-muted">{branchName(u.branch_id)}</Td>
                  <Td className="text-ink-muted">
                    {new Date(u.created_at).toLocaleDateString()}
                  </Td>
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
                      {u.status === 'pending' && <Badge tone="neutral">Pending</Badge>}
                      {u.status === 'suspended' && (
                        <Badge tone="danger">
                          <Ban className="size-3.5" /> Suspended
                        </Badge>
                      )}
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
                        isSelf={u.id === currentUserId}
                        isAdminRow={u.is_org_admin || u.is_branch_admin}
                        canSuspend={isManagingDirector}
                        status={u.status}
                        onManageRoles={() => setManagingRoles(u)}
                        onResetPassword={() => setResettingPassword(u)}
                        onEdit={() => setEditing(u)}
                        onSuspend={() => setSuspending(u)}
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
      <Dialog
        open={!!suspending}
        onClose={() => setSuspending(null)}
        title={suspending?.status === 'suspended' ? 'Reinstate user' : 'Suspend user'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSuspending(null)}>
              Cancel
            </Button>
            <SuspendButton
              user={suspending}
              onDone={() => { invalidate(); setSuspending(null) }}
            />
          </>
        }
      >
        <p className="text-sm text-ink-muted">
          {suspending?.status === 'suspended' ? (
            <>
              Reinstate <span className="font-medium text-ink">{suspending?.full_name}</span>'s
              login access?
            </>
          ) : (
            <>
              Suspend <span className="font-medium text-ink">{suspending?.full_name}</span>'s
              login access? They will not be able to sign in until reinstated.
            </>
          )}
        </p>
      </Dialog>
    </div>
  )
}

function RowActionsMenu({
  isSelf,
  isAdminRow,
  canSuspend: canSuspendAtAll,
  status,
  onManageRoles,
  onResetPassword,
  onEdit,
  onSuspend,
  onDelete,
}: {
  isSelf: boolean
  isAdminRow: boolean
  /** Only the Managing Director can suspend/reinstate login access - a Branch Admin
   * calling PUT /users/{id} with is_active silently has it dropped server-side
   * (UserService.update_user), so hide the action entirely rather than showing a
   * false-success toast that changed nothing. */
  canSuspend: boolean
  status: UserStatus
  onManageRoles: () => void
  onResetPassword: () => void
  onEdit: () => void
  onSuspend: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const { triggerRef, panelRef, pos } = useFloatingPanel<HTMLButtonElement>(open)
  useOutsideClose(open, [triggerRef, panelRef], () => setOpen(false))

  // A user can't manage their own account-level access (delete/suspend) - doing so
  // from the row they're viewing would either lock them out or need a UI for
  // "are you sure you want to delete yourself", neither of which is sound. Org admins
  // and branch admins already sit above role-based access, so per-role assignment to
  // them is blocked (backend enforces this too - see UserService.assign_roles).
  const canManageRoles = !isAdminRow
  const canSuspend = canSuspendAtAll && !isSelf
  const canDelete = !isSelf

  if (!canManageRoles && !canSuspend && !canDelete) {
    return (
      <Button size="icon" variant="ghost" disabled aria-label="No actions available">
        <MoreVertical className="size-4" />
      </Button>
    )
  }

  function run(action: () => void) {
    setOpen(false)
    action()
  }

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        aria-label="Open actions"
      >
        <MoreVertical className="size-4" />
      </Button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed w-48 overflow-hidden rounded-card border border-border bg-surface shadow-pop animate-rise"
            style={{ top: pos.top, left: pos.left, zIndex: 'var(--z-dropdown)' }}
          >
          {canManageRoles && (
            <button
              onClick={() => run(onManageRoles)}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-ink hover:bg-surface-muted"
            >
              <ShieldCheck className="size-4 text-ink-muted" /> Manage roles
            </button>
          )}
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
          {canSuspend && (
            <button
              onClick={() => run(onSuspend)}
              className="flex w-full items-center gap-2.5 border-t border-border px-3.5 py-2.5 text-left text-sm text-ink hover:bg-surface-muted"
            >
              {status === 'suspended' ? (
                <>
                  <UserCheck className="size-4 text-ink-muted" /> Reinstate user
                </>
              ) : (
                <>
                  <Ban className="size-4 text-ink-muted" /> Suspend user
                </>
              )}
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => run(onDelete)}
              className="flex w-full items-center gap-2.5 border-t border-border px-3.5 py-2.5 text-left text-sm text-danger hover:bg-danger-soft"
            >
              <Trash2 className="size-4" /> Remove user
            </button>
          )}
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
  const [namePrefix, setNamePrefix] = useState('')
  const [nameSuffix, setNameSuffix] = useState('')
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
        name_prefix: namePrefix || undefined,
        name_suffix: nameSuffix || undefined,
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
        <Field label="Name prefix" hint='Optional, e.g. "Adv."'>
          <Input value={namePrefix} onChange={(e) => setNamePrefix(e.target.value)} />
        </Field>
        <Field label="Name suffix" hint='Optional, e.g. "(Intern)"'>
          <Input value={nameSuffix} onChange={(e) => setNameSuffix(e.target.value)} />
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
  const [namePrefix, setNamePrefix] = useState(user.name_prefix ?? '')
  const [nameSuffix, setNameSuffix] = useState(user.name_suffix ?? '')
  const [isAdmin, setIsAdmin] = useState(user.is_org_admin)
  const [branchId, setBranchId] = useState(user.branch_id ?? '')
  const [isBranchAdmin, setIsBranchAdmin] = useState(user.is_branch_admin)
  const [isRestricted, setIsRestricted] = useState(user.is_restricted)
  const mutation = useMutationWithToast({
    mutationFn: () =>
      updateUser(user.id, {
        full_name: fullName,
        phone: phone || undefined,
        name_prefix: namePrefix || undefined,
        name_suffix: nameSuffix || undefined,
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
        <Field label="Name prefix" hint='Optional, e.g. "Adv."'>
          <Input value={namePrefix} onChange={(e) => setNamePrefix(e.target.value)} />
        </Field>
        <Field label="Name suffix" hint='Optional, e.g. "(Intern)"'>
          <Input value={nameSuffix} onChange={(e) => setNameSuffix(e.target.value)} />
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

function SuspendButton({ user, onDone }: { user: User | null; onDone: () => void }) {
  const { toast } = useToast()
  const reinstating = user?.status === 'suspended'
  const mutation = useMutationWithToast({
    mutationFn: () => updateUser(user!.id, { is_active: reinstating }),
    onSuccess: () => {
      toast(reinstating ? 'User reinstated.' : 'User suspended.', 'success')
      onDone()
    },
    errorFallback: reinstating ? 'Could not reinstate user.' : 'Could not suspend user.',
  })
  return (
    <Button
      variant={reinstating ? 'primary' : 'danger'}
      loading={mutation.isPending}
      onClick={() => mutation.mutate()}
    >
      {reinstating ? 'Reinstate' : 'Suspend'}
    </Button>
  )
}
