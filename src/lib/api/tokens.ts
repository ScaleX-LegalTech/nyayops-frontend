// Device-token storage. Both the access and refresh tokens now live in
// httpOnly cookies the browser manages on its own - invisible to JS by
// design, never readable or writable from here.

const DEVICE_KEY = 'nyayops.deviceToken'

let deviceToken: string | null = localStorage.getItem(DEVICE_KEY)

// Device token: identifies a browser as "known" so first-login email-OTP
// challenges are skipped on subsequent logins. Deliberately NOT cleared on
// logout - it must survive a logout/login cycle on the same browser.
export function getDeviceToken(): string | null {
  return deviceToken
}

export function setDeviceToken(token: string | null): void {
  deviceToken = token
  if (token) localStorage.setItem(DEVICE_KEY, token)
  else localStorage.removeItem(DEVICE_KEY)
}
