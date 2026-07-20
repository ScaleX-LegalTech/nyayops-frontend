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
- `apiFetch<T>` — injects `Authorization: Bearer <token>` via `getAccessToken()`, JSON-encodes
  `body`; on `401` does a **deduplicated one-shot refresh + retry** (`refreshTokens()`, a
  module-level `refreshInFlight` promise so concurrent 401s share one refresh) — emits
  `AUTH_LOGOUT_EVENT` and throws if refresh fails.
- `get/post/patch/put/del` thin verbs, `getBlob` (raw-byte responses), `toQuery` (querystring
  builder, skips empty values).

`tokens.ts` — access/refresh/device tokens in module-level vars mirrored to `localStorage`
(`nyayops.accessToken`/`.refreshToken`/`.deviceToken`).

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
- `tokens.ts`'s `deviceToken` must **not** be cleared by `clearTokens()`/logout — load-bearing for
  the "recognized browser skips OTP" flow (see `frontend/AGENTS.md`).

## Files to inspect first

`client.ts` (every file depends on its `apiFetch`/verb helpers and error/refresh semantics),
`cases.ts` (largest/most representative: CRUD + FSM + CNR + review in one), `tokens.ts` (token
storage semantics, especially the `deviceToken` exception).
