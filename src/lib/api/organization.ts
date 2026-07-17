import type { Organization } from '@/types'
import { get, patch } from './client'

export function getOrganization(): Promise<Organization> {
  return get<Organization>('/organization')
}

/** Every tenant member can call this (unlike getOrganization, which is org-admin-only) -
 * it's the firm name for the sidebar wordmark, plus is_frozen/frozen_by so the shell can
 * show a paused-org banner (worded differently for the org admin) without a second
 * request. */
export function getOrganizationName(): Promise<{
  name: string
  is_frozen: boolean
  frozen_by: string | null
}> {
  return get('/organization/name')
}

export function setOrganizationFreeze(isFrozen: boolean): Promise<Organization> {
  return patch<Organization>('/organization/freeze', { is_frozen: isFrozen })
}
