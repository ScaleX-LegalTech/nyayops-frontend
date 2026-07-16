# AGENTS.md — `src/auth/`

## Owns

Authentication *state* and *route guarding* — not the auth pages themselves (those are
`src/features/auth/`) and not token storage mechanics (that's `src/lib/api/tokens.ts`).

- `AuthContext.tsx` — `AuthProvider` holds `token: string | null` (seeded from `getAccessToken()`);
  `user` is derived via `useMemo` by client-side JWT decode + expiry check
  (`src/lib/jwt.ts:decodeToken`/`isTokenExpired` — display-only, no signature verification).
  Exposes `isAuthenticated`, `isManagingDirector` (`user.is_org_admin`), `isBranchAdmin`
  (`user.is_branch_admin`), `branchId` (`user.bid`), `setSession(loginResponse)`, `logout()`.
  Listens for the global `AUTH_LOGOUT_EVENT` (dispatched by `lib/api/client.ts` on a failed token
  refresh) to force-clear state.
- `ProtectedRoute.tsx` — `ProtectedRoute` redirects to `/login` (preserving
  `location.pathname` in nav state for post-login return) when unauthenticated.
  `RequireManagingDirector` redirects non-MDs to `/dashboard`; gates `/settings/branches` and
  `/settings/branch-admins`.

## Does NOT own

- Token refresh logic — that lives in `lib/api/client.ts`'s `apiFetch` (401 → dedup'd refresh →
  retry). `AuthContext` only reacts to the resulting `AUTH_LOGOUT_EVENT`, it doesn't initiate
  refreshes.
- Token persistence — `lib/api/tokens.ts` owns `localStorage` mirroring.
- The actual login/register/MFA/OTP page components — those are `src/features/auth/`.

## Major entrypoints

`useAuth()` (context consumer hook) — used throughout `src/features/` for conditional
rendering/permission checks. `<ProtectedRoute>`/`<RequireManagingDirector>` — wrapped around
route elements in `router.tsx`.

## Important dependencies

- `src/lib/jwt.ts` — decode/expiry helpers.
- `src/lib/api/tokens.ts` — `getAccessToken()`/`clearTokens()`.
- `src/lib/api/client.ts` — the `AUTH_LOGOUT_EVENT` custom-event contract this context listens for.

## Common modification patterns

- **New claim needed in the UI**: add it to the JWT payload type in `jwt.ts` and derive it in
  `AuthContext`'s `user` memo — don't decode the token again elsewhere in the app; consume it via
  `useAuth()`.
- **New MD-only or role-gated route**: use `RequireManagingDirector` if it's an
  org-admin-only page, or check `isBranchAdmin`/a permission hook (`usePermissions`) inline for
  finer-grained gating — don't invent a third guard component without checking if one of these
  two (or the permission hook) already covers the case.

## Architectural constraints

- **These guards are UI convenience only** — a code comment explicitly notes the server enforces
  the real authorization. Never reason about security posture based on what `ProtectedRoute`/
  `RequireManagingDirector` blocks; always assume a determined client could bypass them, and rely
  on the backend's `require_permission`/`enforce_org_admin` for actual enforcement.
- JWT decode here is **display-only** — do not use it to gate anything where an incorrect display
  decision would be a security issue; that class of decision belongs server-side.

## Files to inspect first

1. `AuthContext.tsx` — the single source of truth for client-side auth state.
2. `ProtectedRoute.tsx` — both guard components in one file.
3. `../lib/api/client.ts` (sibling directory) — the `AUTH_LOGOUT_EVENT` contract and refresh flow
   this context depends on.
