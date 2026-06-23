import type { DecodedToken } from '@/types'

/** Decode a JWT payload client-side (no verification — display only). */
export function decodeToken(token: string | null): DecodedToken | null {
  if (!token) return null
  try {
    const payload = token.split('.')[1]
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json) as DecodedToken
  } catch {
    return null
  }
}

export function isTokenExpired(decoded: DecodedToken | null): boolean {
  if (!decoded) return true
  return decoded.exp * 1000 <= Date.now()
}
