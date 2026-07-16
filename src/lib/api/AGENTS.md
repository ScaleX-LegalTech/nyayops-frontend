# AGENTS.md — `src/lib/api/`

## Owns

The **only** layer in the frontend that knows request/response shapes for the NyayOps backend.

| File | Wraps |
|---|---|
| `client.ts` (140 lines) | Core fetch wrapper — see below |
| `admin.ts` | `/branches`, `/users` (+invite/roles/reset-password/me/permissions), `/roles`, `/roles/preview`, `/permissions` |
| `audit.ts` | `/audit-logs`, `/cases/{id}/activity`, CSV export |
| `auth.ts` | `/auth/*` (login, MFA, OTP, invite, password reset, register-tenant) |
| `branchAdmins.ts` | `/branch-admins`, `/branch-admins/{id}/permissions` |
| `cases.ts` (196 lines, largest) | Full case CRUD, transitions, CNR link/refresh, full-details, manual documents, parties, history, assign/status/lifecycle, deleted-cases restore/hard-delete, bulk-assign, plus the whole review workflow (`/review/*`) |
| `dashboard.ts` | `/dashboard/*` |
| `documents.ts` | `/documents/*` + raw-byte helpers (`uploadFileBytes`, `loadDocumentBlob`, `downloadDocument`) |
| `notifications.ts` | `/notifications/*`, push subscribe/unsubscribe |
| `organization.ts` | `/organization/*` |
| `profile.ts` | `/users/me` |
| `tokens.ts` | Token storage (not a resource wrapper — see below) |

## Does NOT own

- UI rendering or React hooks (`useQuery` calls live in `src/features/`, not here — these files
  export plain async functions).
- Business rules — this layer is a mechanical HTTP wrapper; anything resembling a decision belongs
  in the calling feature code or, better, the backend.

## Major entrypoints

`client.ts`:
- `API_BASE_URL` from `import.meta.env.VITE_API_BASE_URL`; `API_ORIGIN` strips the `/api/v1` suffix
  for storage upload/download URLs.
- `ApiError` — carries `status` + optional `code`.
- `apiFetch<T>` — injects `Authorization: Bearer <token>` via `getAccessToken()`, JSON-encodes
  `body`; on `401` does a **deduplicated one-shot refresh + retry** (`refreshTokens()`, using a
  module-level `refreshInFlight` promise so concurrent 401s share one refresh) — if refresh fails,
  emits `AUTH_LOGOUT_EVENT` (a `window` custom event) and throws.
- `get/post/patch/put/del` thin verbs, `getBlob` (raw-byte responses), `toQuery` (querystring
  builder, skips empty values).

`tokens.ts` — access/refresh/device tokens in module-level vars mirrored to `localStorage`
(`nyayops.accessToken`/`.refreshToken`/`.deviceToken`).

## Important dependencies

- `src/auth/` listens for `AUTH_LOGOUT_EVENT` dispatched from here.
- Every `src/features/**` hook calls into exactly one file here per resource.

## Common modification patterns

- **New backend endpoint**: add a function to the matching resource file (or create a new file if
  it's a new resource), using `get/post/patch/put/del`/`getBlob` from `client.ts` — never call
  `fetch()` directly.
- **New resource entirely**: create `src/lib/api/<resource>.ts`, add a `qk.<resource>` group to
  `src/lib/queryKeys.ts`, then consume from a new hook in `src/features/<domain>/`.
- **Changing auth/refresh behavior**: everything is centralized in `client.ts`'s `apiFetch` — do
  not add a second refresh-handling path in a feature-level hook; route logout-on-failure through
  the existing `AUTH_LOGOUT_EVENT`.

## Architectural constraints

- This is the **only** file tree allowed to construct backend URLs/paths or know a
  request/response JSON shape — if a component needs backend data, it goes through here, never a
  raw `fetch`/`axios` call.
- 401 handling must stay centralized and deduplicated (the `refreshInFlight` shared-promise
  pattern) — a naive per-call retry would cause a refresh storm under concurrent requests.
- `tokens.ts`'s `deviceToken` must **not** be cleared by `clearTokens()`/logout — it's load-bearing
  for the "recognized browser skips OTP" login flow (see `frontend/AGENTS.md`).

## Files to inspect first

1. `client.ts` — read this before touching anything else in this directory; every other file
   depends on its `apiFetch`/verb helpers and error/refresh semantics.
2. `cases.ts` — the largest and most representative resource file, covering CRUD + FSM transitions
   + CNR integration + review workflow in one place.
3. `tokens.ts` — token storage semantics, especially the `deviceToken` exception.
