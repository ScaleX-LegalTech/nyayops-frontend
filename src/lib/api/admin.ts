import type { Branch, Permission, Role, RolePreviewResponse, User } from '@/types'
import { del, get, patch, post, put } from './client'

// Branches ---------------------------------------------------------------------

export interface BranchPayload {
  name: string
}

export function listBranches(): Promise<Branch[]> {
  return get<Branch[]>('/branches')
}

export function createBranch(payload: BranchPayload): Promise<Branch> {
  return post<Branch>('/branches', payload)
}

export function updateBranch(branchId: string, payload: Partial<BranchPayload>): Promise<Branch> {
  return patch<Branch>(`/branches/${branchId}`, payload)
}

export function deleteBranch(branchId: string): Promise<void> {
  return del<void>(`/branches/${branchId}`)
}

// Users ----------------------------------------------------------------------

export interface InviteUserPayload {
  email: string
  full_name: string
  phone?: string
  branch_id?: string | null
  is_branch_admin?: boolean
}

export interface UpdateUserPayload {
  full_name?: string
  phone?: string
  is_org_admin?: boolean
  branch_id?: string | null
  is_branch_admin?: boolean
  is_restricted?: boolean
}

export function listUsers(): Promise<User[]> {
  return get<User[]>('/users')
}

export function getUser(userId: string): Promise<User> {
  return get<User>(`/users/${userId}`)
}

export function inviteUser(payload: InviteUserPayload): Promise<User> {
  return post<User>('/users/invite', payload)
}

export function updateUser(userId: string, payload: UpdateUserPayload): Promise<User> {
  return put<User>(`/users/${userId}`, payload)
}

export function deleteUser(userId: string): Promise<void> {
  return del<void>(`/users/${userId}`)
}

export function assignRoles(userId: string, roleIds: string[]): Promise<User> {
  return post<User>(`/users/${userId}/roles`, { role_ids: roleIds })
}

export function adminResetPassword(userId: string): Promise<void> {
  return post<void>(`/users/${userId}/reset-password`, undefined)
}

// Roles ----------------------------------------------------------------------

export interface RolePayload {
  name: string
  description?: string
  permissions: Permission[]
}

export function listRoles(): Promise<Role[]> {
  return get<Role[]>('/roles')
}

export function createRole(payload: RolePayload): Promise<Role> {
  return post<Role>('/roles', payload)
}

export function updateRole(roleId: string, payload: Partial<RolePayload>): Promise<Role> {
  return patch<Role>(`/roles/${roleId}`, payload)
}

export function deleteRole(roleId: string): Promise<void> {
  return del<void>(`/roles/${roleId}`)
}

export function previewRole(permissions: Permission[]): Promise<RolePreviewResponse> {
  return post<RolePreviewResponse>('/roles/preview', { permissions })
}

// Permissions ----------------------------------------------------------------

export function listPermissions(): Promise<Permission[]> {
  return get<Permission[]>('/permissions')
}
