# AGENTS.md — `src/features/`

See `../../AGENTS.md` for stack/architecture context.

## Owns

One folder per business domain, each holding its own pages/dialogs as flat `.tsx` files:

- **`admin/`** — `BranchAdminPermissionsDialog.tsx`, `BranchAdminsPage.tsx`, `BranchesPage.tsx`,
  `BranchFormDialog.tsx`, `RoleEditPage.tsx`, `RolesPage.tsx`, `UsersPage.tsx` (965 lines — search
  bar, branch/role/status/joined-date filters, sortable columns, row-action self-guards all in one
  file; its `RowActionsMenu` uses `components/ui/useFloatingPanel.ts` like `Field.tsx`'s `Select`).
  Managing-Director-scoped in large part.
- **`audit/`** — `AuditPage.tsx` (paginated/filterable log table + CSV export).
- **`auth/`** — public unauthenticated pages: `LoginPage`, `RegisterPage`, `AcceptInvitePage`,
  `ForgotPasswordPage`, `ResetPasswordPage`, `VerifyOtpPage`, `AuthLayout.tsx` (shared shell).
  Distinct from `src/auth/` (auth context/guarding code) — this folder is pages only.
- **`cases/`** — largest domain: `CasesPage.tsx` (457), `CaseDetailPage.tsx` (693),
  `CaseFullDetailsPage.tsx` (809, largest file in repo), `CaseHistoryPage.tsx`,
  `CaseLifecycleTracker.tsx` (279, SOP stage tracker widget), `CaseThreadPage.tsx`,
  `CaseWizardDialog.tsx`, `EditCaseDialog.tsx`, `FileSuitDialog.tsx`, `LinkCnrDialog.tsx`,
  `ManualDocumentDialog.tsx` (378), `AssignDialog.tsx`/`ReassignDialog.tsx`.
- **`dashboard/`** — `DashboardPage.tsx` (270 — KPI cards, cases-by-status pie, top-courts bar via
  Recharts, overdue list, activity feed).
- **`documents/`** — `DocumentsPage.tsx` (448), `UploadDialog.tsx`.
- **`notifications/`** — `NotificationsPage.tsx`.
- **`review/`** — `ReviewPage.tsx` (253 — approve/reject/reassign/comment queue).
- **`settings/`** — `SettingsPage.tsx` (tab shell), `SettingsOverviewPage.tsx` (470 — profile, MFA
  enroll, push toggle, org/branch freeze).

`settings`/`notifications` are NOT in sidebar `NAV_GROUPS` (`src/components/layout/nav.ts`) —
reached only via `UserMenu`/notification bell.

## Does NOT own

- Request/response shapes or fetch logic — every data access goes through a hook wrapping
  `useQuery`/`useMutation` against `src/lib/api/<resource>.ts`; no `fetch()` calls in this tree.
- Design-system primitives — compose from `src/components/ui/`, don't redefine locally.

## Entrypoints

Each `*Page.tsx` is what `router.tsx` lazy-loads for its route. Each `*Dialog.tsx` is mounted
conditionally from its parent page's open/close state, not routed directly.

## Common modification patterns

- **New page in existing domain**: add `.tsx` to the domain folder, add a lazy route in
  `router.tsx` via `page()`, add new query keys to `queryKeys.ts`.
- **New domain**: create the folder, add ≥1 page, wire routes, add a `qk` group.
- **Case-related mutation**: after success, call `invalidateCaseScopes(queryClient)`
  (`queryKeys.ts`) rather than hand-picking cache keys.
- **New status/priority display**: use `StatusBadge`/`PriorityBadge` from `components/ui/Badge.tsx`
  — never a bare colored `<span>` (no color-only exceptions exist; keep it that way).

## Architectural constraints

- Flat file-per-page/dialog within each domain folder — don't introduce deeper nesting (e.g.
  `cases/components/`) without a broader restructuring discussion.
- `CaseLifecycleTracker.tsx`'s forward/backward stage transition rules mirror the backend's
  `CaseLifecycleStateMachine` (`backend v1/src/nyayops_backend/domain/case_fsm.py`) — no shared
  schema enforces this; update manually if the backend FSM changes.

## Files to inspect first

1. `cases/CaseDetailPage.tsx` and `cases/CaseFullDetailsPage.tsx` — largest, most central pages.
2. `cases/CaseLifecycleTracker.tsx` — SOP-stage widget that must stay in sync with backend FSM.
3. `admin/UsersPage.tsx` — representative of the admin domain's invite/role/branch patterns.
