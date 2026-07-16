import { clearTokens, getAccessToken, getRefreshToken, setTokens } from './tokens'

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
  clearTokens()
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

let refreshInFlight: Promise<boolean> | null = null

/** Attempt a single token refresh, deduplicated across concurrent 401s. */
async function refreshTokens(): Promise<boolean> {
  const refresh = getRefreshToken()
  if (!refresh) return false
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refresh }),
        })
        if (!res.ok) return false
        const data = await res.json()
        setTokens(data.access_token, data.refresh_token)
        return true
      } catch {
        return false
      } finally {
        refreshInFlight = null
      }
    })()
  }
  return refreshInFlight
}

/** Core JSON fetch wrapper with bearer auth and one-shot 401 refresh+retry. */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, _retried, ...rest } = options
  const finalHeaders: Record<string, string> = { ...(headers as Record<string, string>) }

  const token = getAccessToken()
  if (token) finalHeaders.Authorization = `Bearer ${token}`

  let payload: BodyInit | undefined
  if (body !== undefined) {
    finalHeaders['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
    body: payload,
  })

  if (response.status === 401 && !_retried && getRefreshToken()) {
    const refreshed = await refreshTokens()
    if (refreshed) {
      return apiFetch<T>(path, { ...options, _retried: true })
    }
    emitLogout()
    throw new ApiError(401, 'Your session has expired. Please sign in again.')
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
  const token = getAccessToken()
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
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
