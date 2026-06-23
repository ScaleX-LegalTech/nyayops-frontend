// Token storage: keep access + refresh tokens in memory, mirrored to localStorage.

const ACCESS_KEY = 'nyayops.accessToken'
const REFRESH_KEY = 'nyayops.refreshToken'
const DEVICE_KEY = 'nyayops.deviceToken'

let accessToken: string | null = localStorage.getItem(ACCESS_KEY)
let refreshToken: string | null = localStorage.getItem(REFRESH_KEY)
let deviceToken: string | null = localStorage.getItem(DEVICE_KEY)

export function getAccessToken(): string | null {
  return accessToken
}

export function getRefreshToken(): string | null {
  return refreshToken
}

export function setTokens(access: string | null, refresh: string | null): void {
  accessToken = access
  refreshToken = refresh
  if (access) localStorage.setItem(ACCESS_KEY, access)
  else localStorage.removeItem(ACCESS_KEY)
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh)
  else localStorage.removeItem(REFRESH_KEY)
}

export function clearTokens(): void {
  setTokens(null, null)
}

// Device token: identifies a browser as "known" so first-login email-OTP
// challenges are skipped on subsequent logins. Deliberately NOT cleared by
// clearTokens()/logout() - it must survive a logout/login cycle on the same browser.
export function getDeviceToken(): string | null {
  return deviceToken
}

export function setDeviceToken(token: string | null): void {
  deviceToken = token
  if (token) localStorage.setItem(DEVICE_KEY, token)
  else localStorage.removeItem(DEVICE_KEY)
}
