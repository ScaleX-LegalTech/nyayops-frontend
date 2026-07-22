# AGENTS.md — NyayOps Dashboard (`frontend/`)

React 19 + Vite + TS SPA. Feature-folder structure, TanStack Query for server state, Tailwind v4,
no external UI kit. Talks only to the NyayOps backend — never Court Data Service directly.

## Workspace context

3 independently-versioned git repos, no shared code/types, integration over HTTP only:

| Repo | Role |
|---|---|
| this repo (frontend) | only UI; calls NyayOps backend via `VITE_API_BASE_URL` |
| NyayOps backend | core multi-tenant SaaS API |
| Court Data Service | eCourts scraper; frontend never calls directly, only via backend |

No shared types package — `src/types/index.ts` is maintained independently from the backend's
Pydantic schemas. A backend contract change requires manually updating the matching type here +
the `src/lib/api/*` function that consumes it; nothing auto-syncs across repos.

## Purpose

Case management, document workflow, review queue, audit log, admin (users/roles/branches),
dashboard KPIs, notifications, settings (profile/MFA/org).

## Architecture

```
src/router.tsx              React Router v7, createBrowserRouter, every route lazy-loaded
src/features/<domain>/      one folder per business area — pages/dialogs as flat .tsx files
src/lib/api/<resource>.ts   ONE file per resource — only layer that knows request/response shapes
src/lib/api/client.ts       apiFetch() — auth header injection, 401 → refresh-and-retry, error typing
src/auth/AuthContext.tsx    token state, derived user (client-side JWT decode, display only)
src/components/ui/          design-system primitives (Button, Dialog, Table, Toast, ...)
src/lib/queryKeys.ts        centralized TanStack Query cache key factory
```
Per-directory detail: `src/auth/AGENTS.md`, `src/components/ui/AGENTS.md`, `src/features/AGENTS.md`,
`src/lib/api/AGENTS.md` — assume this file is already read, they don't repeat it.

Read `frontend/DESIGN.md` (OKLCH tokens, type scale, light-only theme) and `frontend/PRODUCT.md`
(target users, brand voice, anti-references, WCAG 2.1 AA) before any visual-design change — this
product deliberately avoids generic AI-dashboard/SaaS-gradient aesthetics.

## Coding conventions

- No external UI kit — extend `src/components/ui/` primitives.
- All network access via `apiFetch`/`get`/`post`/`patch`/`put`/`del`/`getBlob` (`lib/api/client.ts`)
  — no raw `fetch()` inside `src/features/`.
- Person names: use `displayName()` (`lib/formatName.ts`, wraps `full_name` with admin-set
  `name_prefix`/`name_suffix`), not raw `full_name`. Exception: @mention insertion/matching
  (`lib/mentions.ts`, `MentionTextarea.tsx`'s `pick()`) keys on the literal `full_name` string
  embedded in stored comment text — don't reformat there.
- `src/lib/queryKeys.ts` (`qk` object) centralizes cache keys — add new keys there, don't inline ad
  hoc arrays. `CASE_SCOPES` + `invalidateCaseScopes(queryClient)` gives one-call broad invalidation
  after case mutations — reuse it.
- Status (case status, review status, priority, deadlines) never color-alone — always pair with a
  label/icon (`Badge.tsx`'s `StatusBadge`/`PriorityBadge`).
- Design tokens in `src/tokens.css` (OKLCH) — reference Tailwind utilities/CSS vars, never
  hardcoded hex. Exception to not copy: `src/lib/chartColors.ts` hardcodes drifted hex (known
  debt below).
- Every route lazy-loaded via the `page()` helper in `router.tsx` — follow the existing
  `{ lazy: async () => ({ Component }) }` pattern.

## Dependency boundaries

- Frontend → NyayOps backend only. Never call Court Data Service directly — route court-data needs
  through a backend endpoint (`case_court_data.py`-backed routes).
- No Redux/Zustand/Jotai — global state is React Context (`AuthContext`, `ToastContext`) +
  TanStack Query as server-state cache. Cross-cutting reads go through custom hooks
  (`usePermissions`, `useUsers`, `useCasePeople`) wrapping `useQuery`.

## Rules and invariants

1. `ProtectedRoute`/`RequireManagingDirector` are UI convenience only — the server enforces real
   authorization. Don't treat a route guard as a security boundary.
2. JWT decode in `AuthContext`/`jwt.ts` is display-only, no signature verification — don't use
   decoded claims for anything security-sensitive.
3. `deviceToken` (`lib/api/tokens.ts`) is deliberately **not** cleared on logout — it persists so a
   recognized browser skips the email-OTP challenge next login. Don't "fix" this.
4. 401 handling is centralized in `client.ts`'s `apiFetch` (dedup'd refresh + one retry, then
   `AUTH_LOGOUT_EVENT` on failure) — don't add per-call-site 401 handling; listen for
   `AUTH_LOGOUT_EVENT` instead.
5. No dev-server proxy (`vite.config.ts` has none) — API calls are cross-origin directly against
   `VITE_API_BASE_URL`; no `/api` same-origin path works in dev.

## Commands

```bash
npm run dev
npm run build       # tsc && vite build
npm run typecheck    # tsc only
npm run lint         # eslint .
npm run preview
```
No test script (no Vitest/Jest/Playwright/Testing Library) — `tsc` + `eslint` are the only
automated gates.

## Env vars

`VITE_API_BASE_URL` — backend base URL; `API_ORIGIN` (derived in `client.ts`, strips `/api/v1`)
used for document upload/download URLs.

## Known debt

- No automated tests at all — highest-leverage gap.
- `src/lib/chartColors.ts`'s bronze/ink-green hex no longer matches the shipped cobalt/gold
  "Ledger Blue" OKLCH tokens — dashboard charts visually out of sync with the rest of the UI.
- `src/tokens.css`'s actual values differ slightly from `DESIGN.md`'s literal table (e.g.
  success/warning lightness) — `tokens.css` is source of truth.
- 28 raw `<button>` elements outside `Button` exist across `src/features/**` — mostly intentional
  compact icon-only/tab-like controls.
- `src/assets/react.svg`/`vite.svg` — unused `create-vite` scaffold leftovers.

## Deployment

Vercel, project `nyayops`. `workspace.nyayops.in` is canonical; `app.nyayops.in`/
`portal.nyayops.in` alias-redirect (308) to it via **Vercel's Domains API/dashboard** (`redirect`
field on the domain object), not `vercel.json` (tried first — that mechanism is path/geo-
conditional routing within one domain; Vercel treats every aliased domain as an equally-valid
entry point). To change: dashboard → Project → Settings → Domains → domain → set redirect, or API.

`vercel.json` is still needed for a `rewrites` catch-all (`/(.*) -> /index.html`) so client-side
routes survive a hard refresh (static SPA, no framework auto-detection for this) — don't delete
it thinking it's the inert redirect experiment; this part is load-bearing.

`VITE_API_BASE_URL=https://api.nyayops.in/api/v1` is a Vercel production env var — Vite bakes it
in at build time, so a new value needs `vercel env add` + redeploy, not just adding it.

## Current priorities

`CaseFullDetailsPage.tsx` (809 lines), `CaseDetailPage.tsx` (693), `UsersPage.tsx` (676) are the
largest/most-touched files (case workspace + admin) — verify current sprint focus with the team
rather than assuming from file size alone.
