import type { BranchAdminPermissions, BranchAdminPermissionsUpdate } from '@/types'
import { get, patch } from './client'

export function listBranchAdmins(): Promise<BranchAdminPermissions[]> {
  return get<BranchAdminPermissions[]>('/branch-admins')
}

export function getBranchAdminPermissions(userId: string): Promise<BranchAdminPermissions> {
  return get<BranchAdminPermissions>(`/branch-admins/${userId}`)
}

export function updateBranchAdminPermissions(
  userId: string,
  payload: BranchAdminPermissionsUpdate,
): Promise<BranchAdminPermissions> {
  return patch<BranchAdminPermissions>(`/branch-admins/${userId}/permissions`, payload)
}
