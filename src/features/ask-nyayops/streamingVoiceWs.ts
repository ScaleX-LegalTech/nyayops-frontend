import { API_BASE_URL } from '@/lib/api/client'

/** Shared by useStreamingVoice/useStreamingTTSPlayback: derives the `wss://`
 * (or `ws://` in dev over http) URL for backend v1's streaming-voice bridge
 * routes (Improvements v1 doc §8.2 item 4) from the same VITE_API_BASE_URL
 * every other request uses. Auth rides the httpOnly access-token cookie - a
 * real WS handshake sends cookies automatically (no `withCredentials`-style
 * opt-in the way EventSource/fetch need), so no token needs to travel in the
 * URL at all anymore (see ask_nyayops_voice_ws.py's updated note). */
export function streamingVoiceWsUrl(path: string): string {
  const wsBase = API_BASE_URL.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:')
  return `${wsBase}/ask-nyayops${path}`
}

/** 4001 (session_expired): the access token is still valid, only the 5-minute
 * internal-token-backed session aged out - reconnecting is silent and correct.
 * 4401/4429 are the only genuinely fatal codes (bad auth, rate/budget limit) -
 * retrying either just fails again or spams the limiter, so those still give
 * up immediately. Everything else (1006 abnormal closure, 1011 upstream
 * error, a dev-server restart) is a transient drop, not a reason to end the
 * whole call - see RECONNECT_* below. */
export const CLOSE_SESSION_EXPIRED = 4001
export const CLOSE_AUTH_FAILED = 4401
export const CLOSE_RATE_LIMITED = 4429

/** Shared backoff for both streaming hooks' unexpected-close reconnect path -
 * a real network blip or upstream hiccup resumes the session instead of
 * killing it on one bad frame; a capped attempt count still gives up rather
 * than retrying forever against a genuinely dead backend. */
export const RECONNECT_MAX_ATTEMPTS = 5
export const RECONNECT_BASE_DELAY_MS = 500
export const RECONNECT_MAX_DELAY_MS = 5000
