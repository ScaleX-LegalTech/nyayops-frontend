# AGENTS.md — `src/lib/api/`

See `../../../AGENTS.md` for stack/architecture context.

## Owns

The **only** layer that knows request/response shapes for the NyayOps backend.

| File | Wraps |
|---|---|
| `client.ts` (140 lines) | Core fetch wrapper — see below |
| `admin.ts` | `/branches`, `/users` (+invite/roles/reset-password/me/permissions), `/roles`, `/roles/preview`, `/permissions` |
| `audit.ts` | `/audit-logs`, `/cases/{id}/activity`, CSV export |
| `auth.ts` | `/auth/*` (login, MFA, OTP, invite, password reset, register-tenant) |
| `branchAdmins.ts` | `/branch-admins`, `/branch-admins/{id}/permissions` |
| `cases.ts` (196 lines, largest) | Full case CRUD, transitions, CNR link/refresh, full-details, manual documents, parties, history, assign/status/lifecycle, deleted-cases restore/hard-delete, bulk-assign, review workflow (`/review/*`) |
| `dashboard.ts` | `/dashboard/*` |
| `documents.ts` | `/documents/*` + raw-byte helpers (`uploadFileBytes`, `loadDocumentBlob`, `downloadDocument`) |
| `notifications.ts` | `/notifications/*`, push subscribe/unsubscribe |
| `organization.ts` | `/organization/*` |
| `profile.ts` | `/users/me` |
| `tokens.ts` | Token storage (not a resource wrapper — see below) |

## Does NOT own

No UI rendering/React hooks (`useQuery` lives in `src/features/`; these files export plain async
functions) and no business rules (mechanical HTTP wrapper only; decisions belong in the caller or
the backend).

## Entrypoints

`client.ts`:
- `API_BASE_URL` from `VITE_API_BASE_URL`; `API_ORIGIN` strips `/api/v1` for storage
  upload/download URLs.
- `ApiError` — carries `status` + optional `code`.
- `apiFetch<T>` — cookie-authenticated (`credentials: 'include'`), no header to attach anymore;
  JSON-encodes `body`; on `401` does a **deduplicated one-shot refresh + retry** (`refreshTokens()`,
  a module-level `refreshInFlight` promise so concurrent 401s share one refresh) — emits
  `AUTH_LOGOUT_EVENT` and throws if refresh fails.
- `refreshTokens()`/`logout()` — the two special-cased endpoints (`/auth/refresh`, `/auth/logout`)
  that bypass `apiFetch` and call `fetch` directly with `credentials: 'include'`; kept separate
  since `logout()` must still "succeed" locally even if the network call fails, and `refreshTokens()`
  needs its own dedup guard independent of `apiFetch`'s per-request retry flag.
- `get/post/patch/put/del` thin verbs, `getBlob` (raw-byte responses), `toQuery` (querystring
  builder, skips empty values). A few call sites bypass all of these for a raw `fetch()` instead
  (`audit.ts`'s CSV export, `documents.ts`'s presigned-upload PUT, `askNyayOps.ts`'s SSE stream,
  `streamingVoiceWs.ts`'s WS URL) - EventSource/WebSocket/presigned-URL constraints mean they can't
  go through the JSON wrapper, but they still authenticate the same way (`credentials: 'include'`
  for fetch/EventSource; a real WS handshake sends cookies automatically, no opt-in needed).

`tokens.ts` — only the unrelated device-trust token now (`nyayops.deviceToken` in `localStorage`).
Both the access and refresh tokens are httpOnly cookies the backend sets via `Set-Cookie` on
login/refresh, invisible to JS by design - there is nothing left here to store or read for either.

`src/auth/` listens for `AUTH_LOGOUT_EVENT` dispatched from here. Every `src/features/**` hook
calls exactly one file here per resource.

## Common modification patterns

- **New backend endpoint**: add a function to the matching resource file (new file if new
  resource) using `get/post/patch/put/del`/`getBlob` — never call `fetch()` directly.
- **New resource entirely**: create `src/lib/api/<resource>.ts`, add `qk.<resource>` to
  `src/lib/queryKeys.ts`, consume from a new hook in `src/features/<domain>/`.
- **Changing auth/refresh behavior**: centralized in `client.ts`'s `apiFetch` — don't add a
  second refresh path in a feature hook; route logout-on-failure through `AUTH_LOGOUT_EVENT`.

## Architectural constraints

- Only file tree allowed to construct backend URLs/paths or know a request/response JSON shape.
- 401 handling must stay centralized/deduplicated (`refreshInFlight` shared-promise) — a naive
  per-call retry would cause a refresh storm under concurrent requests.
- `tokens.ts`'s `deviceToken` must **not** be cleared on logout — load-bearing for the
  "recognized browser skips OTP" flow (see `frontend/AGENTS.md`).

## Files to inspect first

`client.ts` (every file depends on its `apiFetch`/verb helpers and error/refresh semantics),
`cases.ts` (largest/most representative: CRUD + FSM + CNR + review in one), `tokens.ts` (now just
the device-trust token).
