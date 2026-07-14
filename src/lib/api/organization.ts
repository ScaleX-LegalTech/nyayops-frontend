import type { Organization } from '@/types'
import { get, patch } from './client'

export function getOrganization(): Promise<Organization> {
  return get<Organization>('/organization')
}

export function setOrganizationFreeze(isFrozen: boolean): Promise<Organization> {
  return patch<Organization>('/organization/freeze', { is_frozen: isFrozen })
}
