import type { LoginResponse, MfaEnrollResponse, TenantRegistrationResponse } from '@/types'
import { post } from './client'

export interface RegisterTenantPayload {
  organization_name: string
  organization_slug: string
  admin_name: string
  admin_email: string
  admin_password: string
  data_region?: string
}

export function login(email: string, password: string, tenantSlug: string): Promise<LoginResponse> {
  return post<LoginResponse>('/auth/login', { email, password, tenant_slug: tenantSlug })
}

export function loginMfa(mfaToken: string, code: string): Promise<LoginResponse> {
  return post<LoginResponse>('/auth/login/mfa', { mfa_token: mfaToken, code })
}

export function registerTenant(
  payload: RegisterTenantPayload,
): Promise<TenantRegistrationResponse> {
  return post<TenantRegistrationResponse>('/auth/register-tenant', payload)
}

export function enrollMfa(): Promise<MfaEnrollResponse> {
  return post<MfaEnrollResponse>('/auth/mfa/enroll')
}

export function verifyMfa(code: string): Promise<{ mfa_enabled: boolean }> {
  return post<{ mfa_enabled: boolean }>('/auth/mfa/verify', { code })
}
