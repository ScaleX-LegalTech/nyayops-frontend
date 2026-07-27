# AGENTS.md — `src/auth/`

See `../../AGENTS.md` for stack/architecture context.

## Owns

Auth *state* and *route guarding* — not auth pages (`src/features/auth/`), not token storage
(`src/lib/api/tokens.ts`).

- `AuthContext.tsx` — `AuthProvider` holds `token` (seeded from `getAccessToken()`); `user`
  derived via client-side JWT decode + expiry check (`src/lib/jwt.ts:decodeToken`/
  `isTokenExpired`, display-only). Exposes `isAuthenticated`, `isManagingDirector`
  (`user.is_org_admin`), `isBranchAdmin` (`user.is_branch_admin`), `branchId` (`user.bid`),
  `setSession(loginResponse)`, `logout()`. Listens for `AUTH_LOGOUT_EVENT` (dispatched by
  `lib/api/client.ts` on failed refresh) to force-clear state.
- `ProtectedRoute.tsx` — redirects unauthenticated to `/login` (preserves `location.pathname` in
  nav state). `RequireManagingDirector` redirects non-MDs to `/dashboard`; gates
  `/settings/branches`, `/settings/branch-admins`.

## Does NOT own

- Token refresh (`lib/api/client.ts`'s `apiFetch`, 401 → dedup'd refresh → retry) — this context
  only reacts to `AUTH_LOGOUT_EVENT`.
- Token persistence (`lib/api/tokens.ts`'s `localStorage` mirroring).
- Login/register/MFA/OTP page components (`src/features/auth/`).

## Entrypoints

`useAuth()` — used throughout `src/features/` for conditional rendering/permission checks.
`<ProtectedRoute>`/`<RequireManagingDirector>` — wrapped around route elements in `router.tsx`.

## Common modification patterns

- **New claim needed in UI**: add to JWT payload type in `jwt.ts`, derive in `AuthContext`'s
  `user` memo — don't decode the token again elsewhere; consume via `useAuth()`.
- **New MD-only/role-gated route**: use `RequireManagingDirector` for org-admin-only pages, or
  `isBranchAdmin`/`usePermissions` inline for finer gating — don't invent a third guard.

## Architectural constraints

- Guards are UI convenience only (server enforces real authorization) — never reason about
  security posture from what `ProtectedRoute`/`RequireManagingDirector` blocks; assume a
  determined client could bypass them.
- JWT decode here is display-only — never gate security-sensitive decisions on it.

## Files to inspect first

1. `AuthContext.tsx` — source of truth for client-side auth state.
2. `ProtectedRoute.tsx` — both guard components.
3. `../lib/api/client.ts` — `AUTH_LOGOUT_EVENT` contract + refresh flow this depends on.
