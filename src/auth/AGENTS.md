# AGENTS.md — `src/auth/`

See `../../AGENTS.md` for stack/architecture context.

## Owns

Auth *state* and *route guarding* — not auth pages (`src/features/auth/`), not token storage
(`src/lib/api/tokens.ts`).

- `AuthContext.tsx` — `AuthProvider` holds `user` (an `AuthUser`, mapped from `GET /users/me` -
  `getMe()` - not decoded from a token; both access and refresh tokens are httpOnly cookies now,
  invisible to JS entirely). On mount, always calls `getMe()`; `apiFetch`'s own 401-refresh-retry
  transparently handles "access cookie expired but refresh cookie still valid" underneath that one
  call. Exposes `isInitializing` while that's in flight so `ProtectedRoute` doesn't redirect
  prematurely, `isAuthenticated`, `isManagingDirector` (`user.is_org_admin`), `isBranchAdmin`
  (`user.is_branch_admin`), `branchId` (`user.bid`), `setSession(loginResponse)` (now async - calls
  `getMe()` again after login/register to populate `user`), `logout()` (async - calls
  `POST /auth/logout` best-effort before clearing local state). Listens for `AUTH_LOGOUT_EVENT`
  (dispatched by `lib/api/client.ts` on failed refresh) to force-clear state.
- `ProtectedRoute.tsx` — redirects unauthenticated to `/login` (preserves `location.pathname` in
  nav state). `RequireManagingDirector` redirects non-MDs to `/dashboard`; gates
  `/settings/branches`, `/settings/branch-admins`.

## Does NOT own

- Token refresh (`lib/api/client.ts`'s `apiFetch`, 401 → dedup'd refresh → retry) — this context
  only reacts to `AUTH_LOGOUT_EVENT`.
- Token persistence — there is none to own anymore. Both access and refresh tokens are httpOnly
  cookies the browser manages; `lib/api/tokens.ts` only stores the unrelated device-trust token in
  `localStorage`.
- Login/register/MFA/OTP page components (`src/features/auth/`) — all of them must `await
  setSession(...)` before navigating (it's now async), or the next route's `ProtectedRoute` check
  can run before `user` is populated.

## Entrypoints

`useAuth()` — used throughout `src/features/` for conditional rendering/permission checks.
`<ProtectedRoute>`/`<RequireManagingDirector>` — wrapped around route elements in `router.tsx`.

## Common modification patterns

- **New claim needed in UI**: add the field to the backend's `UserRead`/`User` schema, map it in
  `AuthContext.tsx`'s `toAuthUser()` — don't fetch a second identity source; consume via
  `useAuth()`.
- **New MD-only/role-gated route**: use `RequireManagingDirector` for org-admin-only pages, or
  `isBranchAdmin`/`usePermissions` inline for finer gating — don't invent a third guard.

## Architectural constraints

- Guards are UI convenience only (server enforces real authorization) — never reason about
  security posture from what `ProtectedRoute`/`RequireManagingDirector` blocks; assume a
  determined client could bypass them.
- `AuthUser` (the shape exposed as `useAuth().user`) is display/UI-gating only — never gate
  security-sensitive decisions on it; the server re-checks everything independently.

## Files to inspect first

1. `AuthContext.tsx` — source of truth for client-side auth state.
2. `ProtectedRoute.tsx` — both guard components.
3. `../lib/api/client.ts` — `AUTH_LOGOUT_EVENT` contract + refresh flow this depends on.
4. `../lib/api/profile.ts` — `getMe()`, the identity source `AuthContext` now calls.
