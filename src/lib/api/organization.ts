import type { Organization } from '@/types'
import { get, patch } from './client'

export function getOrganization(): Promise<Organization> {
  return get<Organization>('/organization')
}

/** Every tenant member can call this (unlike getOrganization, which is org-admin-only) -
 * it's just the firm name, for the sidebar wordmark. */
export function getOrganizationName(): Promise<{ name: string }> {
  return get<{ name: string }>('/organization/name')
}

export function setOrganizationFreeze(isFrozen: boolean): Promise<Organization> {
  return patch<Organization>('/organization/freeze', { is_frozen: isFrozen })
}
