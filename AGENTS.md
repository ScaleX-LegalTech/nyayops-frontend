# AGENTS.md — NyayOps Dashboard (`frontend/`)

React 19 + Vite + TypeScript SPA. Feature-folder structure, TanStack Query for server state,
Tailwind v4, no external UI kit (custom design-system primitives only). Talks exclusively to the
NyayOps backend (`backend v1/`) — never calls Court Data Service directly.

## Workspace context

This repo is one of **three independently-versioned git repos** in the NyayOps product — separate
clones, no shared code/types, integration over HTTP only:

| Repo | Role |
|---|---|
| **this repo** (frontend) | The only UI. Talks to the NyayOps backend exclusively |
| NyayOps backend (separate repo) | Core multi-tenant SaaS API this frontend calls (`VITE_API_BASE_URL`) |
| Court Data Service (separate repo) | eCourts scraper. This frontend never calls it directly — only through the NyayOps backend |

**No shared types package** — this repo maintains its own TypeScript `Case`/`Document`/etc. types
(`src/types/index.ts`) independently from the NyayOps backend's Pydantic schemas and Court Data
Service's schema. A backend contract change (new/renamed field) requires manually updating the
matching type here and the `src/lib/api/*` function that consumes it — nothing auto-generates or
enforces this sync across repos.

## Purpose

The only UI for NyayOps: case management, document workflow, review queue, audit log, admin
(users/roles/branches), dashboard KPIs, notifications, settings (profile/MFA/org).

## Architecture overview

```
src/router.tsx              React Router v7, createBrowserRouter, every route lazy-loaded
   │
src/features/<domain>/      one folder per business area — pages/dialogs as flat .tsx files
   │  useQuery/useMutation
src/lib/api/<resource>.ts   ONE file per resource — the only layer that knows request/response shapes
   │
src/lib/api/client.ts       apiFetch() — auth header injection, 401 → refresh-and-retry, error typing
   │
src/auth/AuthContext.tsx    token state, derived `user` (client-side JWT decode, display only)
src/components/ui/          design-system primitives (Button, Dialog, Table, Toast, ...)
src/lib/queryKeys.ts        centralized TanStack Query cache key factory
```

Read `frontend/DESIGN.md` (OKLCH tokens, type scale, light-only theme) and `frontend/PRODUCT.md`
(target users, brand voice, anti-references, WCAG 2.1 AA) before any visual-design change — this
product deliberately avoids generic AI-dashboard/SaaS-gradient aesthetics.

## Directory responsibilities

| Dir | Owns | Does NOT own |
|---|---|---|
| `src/features/<domain>/` | Pages + dialogs for one business area, all data-fetching via hooks | Request/response shapes (that's `lib/api/`), design-system primitives (that's `components/ui/`) |
| `src/lib/api/` | One file per backend resource, wraps `client.ts` | Any UI rendering |
| `src/auth/` | Auth context + route guarding | Token *storage* mechanics (that's `lib/api/tokens.ts`) |
| `src/components/ui/` | Design-system primitives, no business logic | Feature-specific composition |
| `src/lib/` (root files) | Cross-cutting utilities: `queryKeys.ts`, `jwt.ts`, `cn.ts`, `format.ts`, `formatName.ts`, `chartColors.ts`, `queryClient.ts` | — |

## Coding conventions

- **No external UI kit** — extend `src/components/ui/` primitives rather than pulling in a
  component library.
- All network access funnels through `apiFetch`/`get`/`post`/`patch`/`put`/`del`/`getBlob` in
  `lib/api/client.ts` — no raw `fetch()` calls inside `src/features/`.
- Rendering a person's name: use `displayName()` from `lib/formatName.ts` (wraps `full_name` with
  the admin-set `name_prefix`/`name_suffix`), not raw `user.full_name`/`person.full_name`. The one
  exception is @mention text insertion/matching (`lib/mentions.ts`, `MentionTextarea.tsx`'s `pick()`)
  — that protocol keys on the literal `full_name` string embedded in stored comment text and must
  not be reformatted.
- `src/lib/queryKeys.ts` centralizes cache keys (`qk` object, literal tuples or factory functions)
  — add new keys there, don't inline ad hoc key arrays at call sites. `CASE_SCOPES` +
  `invalidateCaseScopes(queryClient)` gives one-call broad invalidation after case mutations —
  reuse it instead of hand-enumerating affected keys.
- Status (case status, review status, priority, deadlines) must **never** be color alone — always
  pair with a label/icon (`Badge.tsx`'s `StatusBadge`/`PriorityBadge` pattern). Verified
  consistently followed as of this writing — keep it that way.
- Design tokens live in `src/tokens.css` (OKLCH custom properties) — component code should
  reference Tailwind utility classes / CSS variables, not hardcoded hex values. Exception to watch:
  `src/lib/chartColors.ts` currently hardcodes hex values that have drifted from the token set
  (see technical debt below) — don't copy that pattern for new chart work; resync or ask before
  extending it.
- Every route is lazy-loaded via the `page()` helper in `router.tsx` — new routes should follow the
  same `{ lazy: async () => ({ Component }) }` pattern.

## Dependency boundaries

- Frontend → NyayOps backend only (`VITE_API_BASE_URL`). Never add a direct call to Court Data
  Service — any court-data need goes through a NyayOps backend endpoint
  (`case_court_data.py`/`case_court_data`-backed routes).
- No Redux/Zustand/Jotai — global state is React Context (`AuthContext`, `ToastContext`) plus
  TanStack Query as the server-state cache. Don't introduce a new state library without a strong
  reason; cross-cutting reads go through small custom hooks (`usePermissions`, `useUsers`,
  `useCasePeople`) wrapping `useQuery`.

## Rules and invariants

1. `ProtectedRoute`/`RequireManagingDirector` guards are UI convenience only — **the server
   enforces the real authorization** (per an explicit code comment). Don't treat a route guard as
   a security boundary when reasoning about what's "protected."
2. JWT decoding in `AuthContext`/`jwt.ts` is **display-only** — no signature verification happens
   client-side (by design; the server is the authority). Don't use decoded claims for anything
   security-sensitive beyond UI conditionals (e.g. showing/hiding a nav item).
3. `deviceToken` (in `lib/api/tokens.ts`) is deliberately **not** cleared on logout — it persists
   across a logout/login cycle so a recognized browser skips the email-OTP challenge next login.
   Don't "fix" this to clear on logout without understanding the login-flow tradeoff.
4. 401 handling is centralized in `client.ts`'s `apiFetch` (dedup'd refresh + one retry via a
   shared in-flight promise, then `AUTH_LOGOUT_EVENT` on failure) — don't add per-call-site 401
   handling; listen for `AUTH_LOGOUT_EVENT` if a component needs to react to a forced logout.
5. No dev-server proxy exists (`vite.config.ts` has none) — API calls are cross-origin directly
   against `VITE_API_BASE_URL`. Don't assume a `/api` same-origin path works in dev.

## Build/test/run commands

```bash
npm run dev
npm run build       # tsc && vite build
npm run typecheck    # tsc only
npm run lint         # eslint .
npm run preview
```
**No test script exists** — no Vitest/Jest/Playwright/Testing Library anywhere in the project.
`tsc` + `eslint` are the only automated correctness gates. If asked to add tests, there's no
existing convention to match — this would be a from-scratch setup decision.

## Important environment variables

- `VITE_API_BASE_URL` — NyayOps backend base URL; `API_ORIGIN` (derived in `client.ts` by
  stripping the `/api/v1` suffix) is used for document upload/download URLs.

## Known pain points / technical debt

- **No automated tests at all** — highest-leverage gap in this project.
- `src/lib/chartColors.ts`'s bronze/ink-green hex palette no longer matches the shipped
  cobalt/gold "Ledger Blue" OKLCH tokens — dashboard pie/bar charts are visually out of sync with
  the rest of the UI (looks like a leftover from an earlier theme concept referenced in
  `PRODUCT.md`'s aspirational section).
- `src/tokens.css`'s actual shipped color values differ slightly from the literal table in
  `DESIGN.md` (e.g. success/warning lightness values) — treat `tokens.css` as the source of truth,
  `DESIGN.md` as directionally accurate but not byte-exact.
- 28 raw `<button>` elements exist outside the `Button` primitive across `src/features/**` — mostly
  intentional (compact icon-only toggles/tab-like controls), but worth a look if a design-system
  consistency pass happens.
- `src/assets/react.svg` / `vite.svg` are unused scaffold leftovers from `create-vite`.

## Deployment

Hosted on Vercel, project name `nyayops` (renamed from the default `frontend` 2026-07-18).
`workspace.nyayops.in` is the canonical domain; `app.nyayops.in` and `portal.nyayops.in` both exist
as memorable aliases that redirect to it (308). That redirect is configured via **Vercel's Domains
API/dashboard** (`redirect`/`redirectStatusCode` fields on the domain object) — not `vercel.json`.
A `vercel.json` with `redirects`/`has: host` rules was tried first and doesn't work for this case:
that mechanism is for path/geo-conditional routing within a single domain's traffic, not for
redirecting between multiple custom domains aliased to the same deployment — Vercel treats every
aliased domain as an equally-valid entry point and doesn't evaluate `vercel.json` redirects to
distinguish between them. If this redirect ever needs changing, do it via the dashboard (Project →
Settings → Domains → click the domain → set redirect) or the API.

`vercel.json` **is** still needed, but only for one thing: a `rewrites` catch-all
(`/(.*) -> /index.html`) so client-side routes (`/dashboard`, `/cases/...`, anything react-router
owns) survive a hard refresh or direct link instead of 404ing — this is a static SPA build with no
framework auto-detection to add that fallback for us. Don't delete this file thinking it's the
inert redirect experiment from before; that part's gone, this part is load-bearing.

`VITE_API_BASE_URL` is set to `https://api.nyayops.in/api/v1` as a Vercel production env var (Vite
bakes it in at build time, per-environment values only take effect on the next build/deploy after
being set — `vercel env add` then redeploy, not enough to just add it).

## Current priorities

`CaseFullDetailsPage.tsx` (809 lines), `CaseDetailPage.tsx` (693 lines), and `UsersPage.tsx` (676
lines) are the largest files and the most actively-touched surface (case workspace + admin) based
on file size/complexity — verify current sprint focus with the team rather than assuming from file
size alone.
