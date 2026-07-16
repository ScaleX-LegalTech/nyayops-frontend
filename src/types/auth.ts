export interface LoginResponse {
  access_token: string | null
  refresh_token: string | null
  token_type: string
  mfa_required: boolean
  mfa_token: string | null
  otp_required: boolean
  otp_token: string | null
  device_token: string | null
}

export interface MfaEnrollResponse {
  secret: string
  otp_uri: string
}

export interface TenantRegistrationResponse {
  tenant_id: string
  tenant_slug: string
  admin_user_id: string
  otp_required: boolean
  otp_token: string | null
  access_token: string | null
  refresh_token: string | null
  token_type: string
}

export interface DecodedToken {
  sub: string
  tid: string
  is_org_admin?: boolean
  bid?: string | null
  is_branch_admin?: boolean
  email?: string
  exp: number
  iat: number
}
