export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL
/** Origin without the /api/v1 suffix — used for storage upload/download URLs. */
export const API_ORIGIN: string = API_BASE_URL.replace(/\/api\/v1\/?$/, '')

/** Broadcast a forced logout so the auth layer can redirect to /login. */
export const AUTH_LOGOUT_EVENT = 'nyayops:logout'

export class ApiError extends Error {
  status: number
  code?: string

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

function emitLogout(): void {
  window.dispatchEvent(new Event(AUTH_LOGOUT_EVENT))
}

/** FastAPI's default 422 shape: { detail: [{ loc: ['body', 'field'], msg, type }, ...] }. */
function describeValidationErrors(issues: unknown[]): string {
  return issues
    .map((issue) => {
      if (typeof issue !== 'object' || issue === null) return String(issue)
      const { loc, msg } = issue as { loc?: unknown[]; msg?: string }
      const field = Array.isArray(loc) ? String(loc[loc.length - 1]) : undefined
      const label = field ? field.replace(/_/g, ' ') : undefined
      return label && msg ? `${label}: ${msg}` : (msg ?? JSON.stringify(issue))
    })
    .join('; ')
}

async function parseError(response: Response): Promise<ApiError> {
  let detail = response.statusText
  let code: string | undefined
  try {
    const body = await response.json()
    if (typeof body.detail === 'string') {
      detail = body.detail
    } else if (Array.isArray(body.detail)) {
      detail = describeValidationErrors(body.detail)
    } else if (body.detail) {
      detail = JSON.stringify(body.detail)
    }
    code = body.code
  } catch {
    // no JSON body
  }
  return new ApiError(response.status, detail, code)
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  /** Internal: prevent infinite refresh recursion. */
  _retried?: boolean
}

type RefreshOutcome = 'success' | 'invalidToken' | 'transientError'

let refreshInFlight: Promise<RefreshOutcome> | null = null

/** Attempt a single token refresh, deduplicated across concurrent 401s. Only
 * a 401 from the refresh endpoint itself means the refresh token is actually
 * dead - anything else (network error, timeout, 5xx) is transient and
 * shouldn't cost the user their session (see the Flutter app's api_client.dart
 * for the same fix, made first).
 *
 * Neither token is read or sent by this client at all anymore - both the
 * access and refresh tokens live in httpOnly cookies the browser attaches on
 * its own via `credentials: 'include'` and the server rotates via its own
 * `Set-Cookie` response headers. Whether a session exists at all is
 * something only the server can answer now (a 401 means "no valid cookie"),
 * not something this client can short-circuit by checking local storage
 * first. The response body (still containing access_token/refresh_token, an
 * API-contract detail Flutter relies on) is irrelevant to web and ignored. */
export async function refreshTokens(): Promise<RefreshOutcome> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        })
        return res.ok ? 'success' : res.status === 401 ? 'invalidToken' : 'transientError'
      } catch {
        return 'transientError'
      } finally {
        refreshInFlight = null
      }
    })()
  }
  return refreshInFlight
}

/** Best-effort: blocklists the refresh cookie server-side and clears it.
 * Bypasses apiFetch (like refreshTokens above) since this is a cookie-
 * authenticated endpoint, not a Bearer-authenticated one - it must still
 * "succeed" (from the caller's point of view) even if the network call
 * itself fails, since local state gets cleared regardless. */
export async function logout(): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST', credentials: 'include' })
  } catch {
    // ignore - caller clears local state either way
  }
}

/** Core JSON fetch wrapper (cookie-authenticated) with one-shot 401 refresh+retry. */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, _retried, ...rest } = options
  const finalHeaders: Record<string, string> = { ...(headers as Record<string, string>) }

  let payload: BodyInit | undefined
  if (body !== undefined) {
    finalHeaders['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    credentials: 'include',
    headers: finalHeaders,
    body: payload,
  })

  if (response.status === 401 && !_retried) {
    // No local signal to check anymore (the refresh token isn't
    // client-readable) - just try; the server's own response tells us
    // whether there was ever a cookie to refresh from.
    const outcome = await refreshTokens()
    if (outcome === 'success') {
      return apiFetch<T>(path, { ...options, _retried: true })
    }
    if (outcome === 'invalidToken') {
      emitLogout()
      throw new ApiError(401, 'Your session has expired. Please sign in again.')
    }
    // Transient failure (network/5xx) refreshing - the stored refresh token
    // may still be good, so don't wipe it and force a logout over what could
    // just be a dropped connection. Fail this one request; the next one gets
    // to try refreshing again.
    throw new ApiError(0, 'Could not reach the server. Please try again.')
  }

  if (!response.ok) {
    throw await parseError(response)
  }

  if (response.status === 204) return undefined as T
  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export const get = <T>(path: string) => apiFetch<T>(path)
export const post = <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'POST', body })
export const patch = <T>(path: string, body?: unknown) =>
  apiFetch<T>(path, { method: 'PATCH', body })
export const put = <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'PUT', body })
export const del = <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' })

/** For endpoints that return raw bytes (a file), not JSON - apiFetch always tries to
 * JSON-parse the body, which doesn't work here. */
export async function getBlob(path: string): Promise<Blob> {
  const res = await fetch(`${API_BASE_URL}${path}`, { credentials: 'include' })
  if (!res.ok) {
    throw new ApiError(res.status, `Request failed (${res.status})`)
  }
  return res.blob()
}

/** Build a query string from a filters object, skipping empty values. */
export function toQuery<T extends object>(params: T): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  }
  const str = search.toString()
  return str ? `?${str}` : ''
}
