import type { LoginResponse, MfaEnrollResponse, TenantRegistrationResponse } from '@/types'
import { post } from './client'
import { getDeviceToken } from './tokens'

export interface RegisterTenantPayload {
  organization_name: string
  organization_slug: string
  admin_name: string
  admin_email: string
  admin_password: string
  data_region?: string
}

export function login(email: string, password: string, tenantSlug: string): Promise<LoginResponse> {
  return post<LoginResponse>('/auth/login', {
    email,
    password,
    tenant_slug: tenantSlug,
    device_token: getDeviceToken(),
  })
}

export function loginMfa(mfaToken: string, code: string): Promise<LoginResponse> {
  return post<LoginResponse>('/auth/login/mfa', { mfa_token: mfaToken, code })
}

export function requestMfaEmailFallback(mfaToken: string): Promise<LoginResponse> {
  return post<LoginResponse>('/auth/login/mfa/email-fallback', { mfa_token: mfaToken })
}

export function loginOtp(otpToken: string, code: string): Promise<LoginResponse> {
  return post<LoginResponse>('/auth/login/otp', { otp_token: otpToken, code })
}

export function acceptInvite(inviteToken: string, newPassword: string): Promise<void> {
  return post<void>('/auth/accept-invite', { invite_token: inviteToken, new_password: newPassword })
}

export function forgotPassword(email: string, tenantSlug: string): Promise<{ message: string }> {
  return post<{ message: string }>('/auth/forgot-password', { email, tenant_slug: tenantSlug })
}

export function resetPassword(resetToken: string, newPassword: string): Promise<void> {
  return post<void>('/auth/reset-password', { reset_token: resetToken, new_password: newPassword })
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
