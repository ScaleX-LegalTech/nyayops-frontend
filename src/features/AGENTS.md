# AGENTS.md — `src/features/`

## Owns

One folder per business domain, each holding its own pages/dialogs as flat `.tsx` files (no
further nesting convention beyond this):

- **`admin/`** — `BranchAdminPermissionsDialog.tsx`, `BranchAdminsPage.tsx`, `BranchesPage.tsx`,
  `BranchFormDialog.tsx`, `RoleEditPage.tsx`, `RolesPage.tsx`, `UsersPage.tsx` (965 lines — search
  bar, branch/role/status/joined-date filters, sortable column headers, and row-action self-guards
  all live in this one file; its `RowActionsMenu` uses `components/ui/useFloatingPanel.ts`'s
  `useFloatingPanel`/`useOutsideClose` rather than hand-rolled positioning, so it clamps to the
  viewport and re-tracks its trigger on scroll the same way `Field.tsx`'s `Select` does).
  Managing-Director-scoped in large part.
- **`audit/`** — `AuditPage.tsx` (paginated/filterable log table + CSV export).
- **`auth/`** — public unauthenticated pages: `LoginPage`, `RegisterPage`, `AcceptInvitePage`,
  `ForgotPasswordPage`, `ResetPasswordPage`, `VerifyOtpPage`, plus `AuthLayout.tsx` (shared shell).
  Note: distinct from `src/auth/` (the auth *context/guarding* code) — this folder is pages only.
- **`cases/`** — the largest domain: `CasesPage.tsx` (457), `CaseDetailPage.tsx` (693),
  `CaseFullDetailsPage.tsx` (809, largest file in repo), `CaseHistoryPage.tsx`,
  `CaseLifecycleTracker.tsx` (279 — the SOP stage tracker widget), `CaseThreadPage.tsx`,
  `CaseWizardDialog.tsx`, `EditCaseDialog.tsx`, `FileSuitDialog.tsx`, `LinkCnrDialog.tsx`,
  `ManualDocumentDialog.tsx` (378), `AssignDialog.tsx`/`ReassignDialog.tsx`.
- **`dashboard/`** — `DashboardPage.tsx` (270 — KPI cards, cases-by-status pie, top-courts bar via
  Recharts, overdue list, activity feed).
- **`documents/`** — `DocumentsPage.tsx` (448), `UploadDialog.tsx`.
- **`notifications/`** — `NotificationsPage.tsx`.
- **`review/`** — `ReviewPage.tsx` (253 — approve/reject/reassign/comment queue).
- **`settings/`** — `SettingsPage.tsx` (tab shell), `SettingsOverviewPage.tsx` (470 — profile, MFA
  enroll, push toggle, org/branch freeze).

`settings` and `notifications` are NOT in the sidebar `NAV_GROUPS`
(`src/components/layout/nav.ts`) — reached only via `UserMenu` / the notification bell.

## Does NOT own

- Request/response shapes or fetch logic — every data access goes through a hook wrapping
  `useQuery`/`useMutation` against a `src/lib/api/<resource>.ts` function; no `fetch()` calls exist
  in this tree.
- Design-system primitives — compose from `src/components/ui/`, don't redefine a Button/Dialog/
  Table locally in a feature folder.

## Major entrypoints

Each `*Page.tsx` is what `router.tsx` lazy-loads for its route. Each `*Dialog.tsx` is mounted
conditionally from its parent page's open/close state, not routed directly.

## Important dependencies

- `src/lib/api/*` for all data access, `src/lib/queryKeys.ts` for cache keys.
- `src/components/ui/*` for every visual primitive.
- `src/auth/` (`useAuth`, `ProtectedRoute`, `RequireManagingDirector`) for permission-gated
  rendering/routing.

## Common modification patterns

- **New page in an existing domain**: add the `.tsx` file to the domain folder, add a lazy route
  in `router.tsx` via the `page()` helper, add any new query keys to `queryKeys.ts`.
- **New domain**: create the folder, add at least one page, wire routes, and add a `qk` group.
- **Case-related mutation**: after a successful mutation, call
  `invalidateCaseScopes(queryClient)` (from `queryKeys.ts`) rather than hand-picking which cache
  keys to invalidate — this is the established one-call pattern for the cases/review/dashboard
  scope.
- **New status/priority display**: use `StatusBadge`/`PriorityBadge` from
  `components/ui/Badge.tsx` — never render a bare colored `<span>` for status (no color-only
  exceptions exist in the current codebase; keep it that way).

## Architectural constraints

- Flat file-per-page/dialog within each domain folder — don't introduce a deeper nesting
  convention (e.g. `cases/components/`) without a broader restructuring discussion, since it
  would be inconsistent with every other domain folder.
- `CaseLifecycleTracker.tsx`'s forward/backward stage transition rules mirror the backend's
  `CaseLifecycleStateMachine` (`backend v1/src/nyayops_backend/domain/case_fsm.py`) — if the
  backend FSM changes, this component's transition logic must be updated to match; there's no
  shared schema enforcing this, it's a manual sync point.

## Files to inspect first

1. `cases/CaseDetailPage.tsx` and `cases/CaseFullDetailsPage.tsx` — the two largest, most central
   pages; read both before modifying case-related UI.
2. `cases/CaseLifecycleTracker.tsx` — the SOP-stage widget that must stay in sync with the backend
   FSM.
3. `admin/UsersPage.tsx` — representative of the admin domain's invite/role/branch patterns.
