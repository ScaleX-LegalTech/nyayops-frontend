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

### Ask NyayOps voice - WebSocket by default, batch fallback if unsupported

`AskNyayOpsPage.tsx`, `AskNyayOpsLauncher.tsx`, and `OrgSetupPage.tsx` all go through
`ChatInputBar.tsx`, whose `voice: VoiceInputAdapter` prop is now **required, not optional** -
`useAskNyayOpsChat.ts` builds it directly from `useStreamingVoice` and always returns it (not
`| undefined`). Inside `ChatInputBar`, `voice` drives the mic whenever `voice.supported` is true;
when it's false (no `AudioWorklet`/`WebSocket` - old/locked-down browsers), the component falls
back to its own internally-instantiated batch mic (`useSpeechInput`, via the `onTranscript`/`scope`
props) instead of hiding the mic button outright - both satisfy the same `VoiceInputAdapter` shape,
so the rest of the component's rendering doesn't care which is live. Getting the WebSocket path
solid took two rounds of real live-testing bugs, both traced to the same root cause (an async-state
re-entrancy race, not the WebSocket transport itself), fixed rather than worked around:
- **Duplicate sends** - `sendMessage` in `useAskNyayOpsChat.ts` guarded re-entry with the `loading`
  React state, which doesn't update until the next render; two calls close together (however
  triggered) both saw it as `false` and both went through. Fixed with `sendingRef` (a plain ref,
  updated synchronously) as the actual mutex - `loading` state still exists for the UI, but no
  longer does double duty as a re-entrancy guard. `useStreamingVoice.ts`'s `stop()` has the
  identical fix (`finalizingRef`) one layer down, guarding calls to `onFinalTranscript`, though
  the `sendMessage`-level guard is the one that actually matters (it protects against a duplicate
  call reaching `sendMessage` by ANY path, not just this one).
- **Transcript truncated to the last few words** - three compounding bugs, found and fixed one at a
  time across separate rounds of live testing (each real, but the audio-drop one below was the
  actual dominant cause and went unnoticed for two rounds because every earlier fix was looking at
  the TRANSCRIPT, never at whether the AUDIO itself made it to Sarvam intact):
  1. Sarvam's `data.transcript` is the running hypothesis for its CURRENT internal utterance only
     and resets to empty on any natural mid-sentence pause; `useStreamingVoice.ts` watches
     `vad_signals` `STOP_SPEECH` to commit each completed utterance (`committedRef`) instead of only
     ever showing the latest one.
  2. Even with correct accumulation, `stop()` used to grab whatever was accumulated after a single
     fixed 400ms delay, which was sometimes shorter than Sarvam's actual round-trip for the final
     flushed segment - `stop()` now debounces on transcript activity instead (`FINALIZE_DEBOUNCE_MS`,
     shortened to `FINALIZE_QUICK_MS` once `STOP_SPEECH` confirms the utterance is done, capped
     overall by `FINALIZE_MAX_WAIT_MS`) rather than guessing a fixed delay.
  3. **The actual dominant cause**: the `AudioWorkletNode`'s `port.onmessage` only ever sent a frame
     when `wsRef.current?.readyState === WebSocket.OPEN` - anything captured while the WS was still
     mid-handshake (the mic goes live the instant `getUserMedia()` resolves, well before the 3-hop
     `browser -> backend v1 -> ask-nyayops-service -> Sarvam` connection actually opens, and again on
     every reconnect) was silently dropped, never sent to Sarvam at all. Anyone who starts talking
     right after clicking the mic - the normal case - lost exactly the first part of what they said,
     which reads identically to "only the last few words" and could never have been fixed by
     anything at the transcript layer, since Sarvam never received the missing audio to transcribe
     in the first place. Fixed with `pendingAudioRef`: the worklet handler buffers instead of
     dropping when the WS isn't open, and `ws.onopen` flushes that buffer (in order) the moment the
     connection - initial or reconnected - actually becomes ready.
- The waveform in `ChatInputBar.tsx` reflects real mic input level while recording, not a canned
  CSS animation - `pcm-worklet.js` already computed an RMS reading per frame for the old local-VAD
  barge-in (removed, see the rollback note above) but nothing consumed it; `useStreamingVoice.ts`
  now smooths it (EMA) and samples it into `audioLevel` state (0-1) on an 80ms timer (frames arrive
  every ~2.7ms - far too fast to push through React state directly). `ChatInputBar` keeps a
  scrolling `WAVEFORM_BAR_COUNT`-sample history of that value so the bars read as a live level
  strip - the point is specifically to let a user tell whether their voice is actually being picked
  up, not just that a recording is technically in progress. `VoiceInputAdapter.audioLevel` is
  optional - the batch fallback has no live level to report, so those states keep the original
  decorative pulse.
- **Mic activation latency** - two real, stacking delays between clicking the mic and it actually
  recording, both fixed in `useStreamingVoice.ts`'s `start()`: (1) it used to create a brand new
  `AudioContext` and call `audioWorklet.addModule()` on every single click - that's a network
  fetch + compile + registration, and registration is scoped per `AudioContext` instance (not
  shareable across separate ones), so it was full repeated cost every time. `audioCtxRef` is now
  reused across recordings (only the mic `MediaStream` itself, and the worklet node built on it,
  get torn down between recordings - `teardown()` deliberately no longer closes the context; a
  separate unmount-only effect does that, once, for real). (2) `status` used to only flip to
  `'recording'` inside `ws.onopen`, gating the UI on the full 3-hop WS handshake even though the
  local mic pipeline (and pendingAudioRef's buffering) was already live by then - it now flips the
  instant the worklet is attached, before `openSocket()` is even called.
- `streamingVoiceWs.ts` — derives the `wss://`/`ws://` bridge URL from `VITE_API_BASE_URL`,
  attaches the tenant access token as `?token=` (browsers can't set an `Authorization` header on a
  WS upgrade), and exports the shared close-code constants (`CLOSE_SESSION_EXPIRED` 4001,
  `CLOSE_AUTH_FAILED` 4401, `CLOSE_RATE_LIMITED` 4429) plus a shared reconnect backoff
  (`RECONNECT_MAX_ATTEMPTS`/`RECONNECT_BASE_DELAY_MS`/`RECONNECT_MAX_DELAY_MS`) both streaming
  hooks use to survive a transient drop instead of ending the whole session on one bad frame.
- `public/audio/pcm-worklet.js` — an `AudioWorkletProcessor` downsampling the mic to 16kHz mono
  PCM16 on the audio render thread, posting each frame to the main thread.
- `useStreamingTTSPlayback.ts` — splits a finished reply into sentences, streams them over one WS
  to the TTS bridge, and schedules each returned PCM16 chunk back-to-back on one `AudioContext`
  (classic `nextStartTime` cursor) so playback is gapless despite arriving in pieces.
- Both streaming hooks only ever open a WebSocket inside `start()`/`speak()` - never on mount - so
  a WS exists only while a recording or a spoken reply is actually in flight, not just because the
  chat panel/launcher is open.
- `BootstrapChat.tsx` is the one exception: unauthenticated pre-signup surface, uses
  `VoiceControls.tsx`/`useSpeechInput` (batch, `useSpeech.ts`) directly, not `ChatInputBar`. Never
  converted to WebSocket - the backend has bootstrap-scoped WS routes already built
  (`/internal/v1/bootstrap/speech-to-text/stream` etc. in ask-nyayops-service's `voice_ws.py`), but
  no frontend bootstrap-scoped `useStreamingVoice` variant exists yet.
- Known residual risk: exact Sarvam wire-protocol field values (PCM16 `encoding` string, `linear16`
  byte layout) are doc-accurate but unverified against a live account - the fixed
  `TTS_SAMPLE_RATE = 24000` constant in `useStreamingTTSPlayback.ts` must stay in sync with
  ask-nyayops-service's `sarvam_tts_stream_sample_rate` config if that ever changes. No automated
  test coverage for either streaming hook (no test runner in this repo at all - see "Known pain
  points" below); verification here was `tsc`/`eslint`/`vite build` only, not a live mic/live
  Sarvam account test.

### ChatMessageList.tsx - stage-labelled status text (Improvements v1 doc §3.4/§8.2 item 6)

`ThinkingStatus` shows a real, backend-reported stage label (`loadingStage`, threaded from
`useAskNyayOpsChat.ts` through `AskNyayOpsPage.tsx`/`AskNyayOpsLauncher.tsx` into
`ChatMessageList`'s `loadingStage` prop) when one is available - e.g. "Checking the case file…" or
"Preparing your answer…" - falling back to the original elapsed-time guess ("Thinking…" →
"Looking that up…" → ...) only until the first real stage arrives. `sendMessage` generates a
`turn_id` (`crypto.randomUUID()`) per turn, sends it alongside the chat request, and polls `GET
/ask-nyayops/turn-stage/{turnId}` (`getAskNyayOpsTurnStage`, `lib/api/askNyayOps.ts`) every 600ms
while the turn is in flight - see ask-nyayops-service's `AGENTS.md` for `StageReporter`, the
Redis-backed source of truth this reads from. A poll failure is swallowed silently (`.catch(() =>
{})`) - the fallback elapsed-time guess is the safety net, so a flaky poll never surfaces as a user-
visible error. Not wired into `BootstrapChat.tsx` (unauthenticated pre-signup surface, separate
component tree, out of scope for this pass).

### PendingActionCard.tsx - confirm surface for every drafted write

`PendingActionCard` branches on `pendingAction.action_type` to one of four dedicated confirm
cards - `InviteUserConfirmCard` (`user.invite`), `AssignCaseConfirmCard` (`case.assign` /
`case.reassign`), `BulkCommentConfirmCard` (`case.bulk_comment`), `WorkflowConfirmCard`
(`workflow.batch`) - or falls through to the generic before/after diff card
driven by the `HANDLERS` registry (`action_type -> execute()` against the real REST endpoint,
entirely outside the chat loop). `HANDLERS`/`idFromWouldAffect`/`SECOND_APPROVAL_ACTION_TYPES`/
`executeApprovedAction` live in the sibling `pendingActionHandlers.ts`, not in
`PendingActionCard.tsx` itself - a component file can only export components (react-refresh
lint rule), and `features/admin/ApprovalsPage.tsx` needs `executeApprovedAction` too. For T3
`PendingAction`s, the card also shows a mandatory "I understand the consequences" checkbox
(implementation plan §7.1) before Confirm enables; for the three widest-radius T3 action_types
(`organization.freeze`, `branch.delete`, `role.delete` - `SECOND_APPROVAL_ACTION_TYPES`), Confirm
calls `proposePendingApproval` instead of the real endpoint, handing off to backend v1's
`assistant_pending_approvals` second-approver queue (see `ApprovalsPage.tsx`, gated
`RequireManagingDirector` at `/settings/approvals`) rather than executing anything itself.
`WorkflowConfirmCard` is the frontend half of ask-nyayops-
service's `agents/workflow.py:combine_pending_actions` (Improvements v1 doc §6.3): when a model
turn drafts more than one write in one turn (e.g. "reassign this to Priya and let her know" =
`case.reassign` + `case.comment`), the backend bundles them into one
`action_type="workflow.batch"` PendingAction whose `after_state.actions` is the original
PendingAction list, untouched. The card lists each step's summary and, on Confirm, runs
`runOne()` over them in order via each sub-action's own `HANDLERS[...].execute` (or
`addCaseComment` directly for `case.comment` sub-actions, matching the generic card's own
non-editable-comment path) - it stops at the first failure rather than retrying, and tells the
user how many steps actually completed so a partial batch is never silently reported as done.

`AssignCaseConfirmCard` exists because chat-only name resolution for assign/reassign kept failing
in practice (misheard/ambiguous names needing multiple back-and-forth turns) - it wraps the same
`UserMultiSelect`/`getAssignablePeople` searchable picker the real `ReassignDialog.tsx` uses,
pre-filled from whatever the model resolved but fully correctable without going back through the
model. Handles both `case.assign` and `case.reassign` (the latter also shows the optional
reassignment comment field) - see ask-nyayops-service's `AGENTS.md` for the matching system-prompt
fix that stops the model retrying `draft_reassign_case` when a case's status doesn't allow it yet.

### Chat document attach + in-place preview (2026-07-27,
`documents/Ask_NyayOps_Chat_Document_Upload_Retrieval_Proposal.md`)

The chat input's paperclip and drag-and-drop both stage a `File` in
`features/ask-nyayops/chatAttachmentStore.ts` - a plain module singleton (not React state/context),
because the file has to survive from `ChatInputBar` (where it's attached) to a `PendingActionCard`
deep inside `ChatMessageList` (where it's consumed on confirm), and `pendingActionHandlers.ts`'s
`HANDLERS` map is module-scope with a fixed `execute: (pa) => Promise<unknown>` signature that
can't take an extra param without touching every other handler. `useStagedAttachment()`
(`useSyncExternalStore`) is the reactive read `ChatInputBar` uses to show/clear the staged-file
chip; client-side mime/size validation there mirrors backend v1's `documents.py:27-43` for early
UX feedback only - the server stays authoritative. `ChatAttachDropZone.tsx` wraps the whole chat
panel (not just the input row) in `AskNyayOpsPage.tsx`/`AskNyayOpsLauncher.tsx` so a file can be
dropped anywhere over the conversation, not only on `ChatInputBar` itself; skipped in
`OrgSetupPage`'s bootstrap chat, which is pre-org/unauthenticated and has no `case_id` to attach
to.

`document.create`/`document.create_version` in `pendingActionHandlers.ts` now have real
`execute()`s (previously `navigateTo`-only, sending the user to pick a file manually) - on confirm
they read the staged file back out of the store and run the exact same 3-step
`createUploadUrl`/`createDocumentVersion` → `uploadFileBytes` → `confirmUpload` sequence
`UploadDialog.tsx` uses, then clear the store. `draft_create_document`/`draft_create_document_version`
themselves (ask-nyayops-service tools) were untouched - only the frontend execute side was missing.

Retrieval: `get_case_documents`' sources (ask-nyayops-service's `_collect_source`, see its own
`AGENTS.md`) now carry `storage_key`/`mime_type`/`doc_type` per document. `ChatMessageList.tsx`
builds a `PreviewTarget` directly from those fields (no extra fetch) and opens the existing
`DocumentPreviewDialog` in place via a new `onOpen` prop on `EntityResultCard` (falls back to the
old `Link to="/documents"` when `storage_key` is absent - older, already-persisted messages predate
this field). DOCX/XLS/DOC still fall back to the dialog's own "download to view" state - no new
viewer work was in scope.

### Document-retrieval UX - primary result vs. linked context (2026-07-27)

`AskNyayOpsSource` gained `rank?: 'primary'`, `uploaded_by_name`, and `linked_case_id`/
`linked_case_label` - only `get_case_documents`'s document sources ever set these
(ask-nyayops-service's `_collect_source`, see its own `AGENTS.md` for how `rank` is count-gated:
primary only when that call resolved to exactly one document). In `ChatMessageList.tsx`'s render
loop, `primaryDoc` (computed once per entry: the single `rank === 'primary'` source, or `null` if
zero or 2+) takes priority over the old `sources.length > 1` → `SourceResultCards` branch - exactly
one primary document renders `PrimaryDocumentCard.tsx` (icon/title/`Type:`/`Uploaded by:`/
Open-document button, modeled on `SingleCaseFactCard`'s shell but no `useQuery` - the source object
already has everything) with a "Linked case" row built from `toRelatedItems(primaryDoc)` -
**deliberately reading only the document's own `linked_case_id`/`linked_case_label`, not other
sources in the same turn**. The first cut built that row from every *other* source in the whole
turn's `entry.sources` and was a real bug: a turn resolving an ambiguous name (e.g. two "Mahesh
Kumar" matters) can add a second, unrelated case source via a different tool call in the same turn,
and it showed up as a second, wrong "Linked case." Co-occurrence in one turn isn't a relationship -
always prefer an explicit field from the backend over inferring one from what else happens to be in
`sources[]`. Two or more primary documents (genuine disambiguation, e.g. two same-titled docs)
still falls through to the flat `SourceResultCards` list unchanged. `ProvenanceFooter` is
suppressed when a `primaryDoc` is showing (its related-rows already cover that ground - would
otherwise duplicate "Based on: Case records/Document records").

**Live stress test (2026-07-27) found one more gap**: a turn asking about two different cases at
once ("latest doc for case A and also case B") correctly links the primary document only to case
A, but case B - genuinely discussed in the reply text - had no representation anywhere in the UI,
since `toRelatedItems` only reads the primary doc's own link. `PrimaryDocumentCard` gained an
`otherReferences` prop (`toOtherReferences()` in `ChatMessageList.tsx`) for exactly this: every
turn source that's neither the primary document nor its linked case, rendered as plain neutral
links (not "Linked"/"Associated" - that would misrepresent a connection that isn't there) instead
of being silently dropped.

Virus-scan status, quarantine badges, and raw `file_size_bytes` are now admin-only
(`isManagingDirector || isBranchAdmin`) on `DocumentsPage.tsx` and `CaseDetailPage.tsx` (which now
computes its own `isAdmin` via `useAuth()` - it didn't check this before). `VersionHistory` (shared
by both pages) takes a new optional `isAdmin` prop gating the byte-size span. Ask NyayOps chat
never rendered scan status to begin with - `PrimaryDocumentCard` deliberately doesn't either, for
every viewer, keeping the pattern consistent rather than adding a second admin-only variant there.
A quarantined document's download block (`backend v1`'s `documents.py`) now returns a distinct
user-facing message ("Unable to process this document. The uploaded file failed security
validation...") instead of the generic "You cannot download this document." - same
`PermissionDeniedError` → toast pipe, just clearer copy for the one case that's a security block.

## Directory responsibilities

| Dir | Owns | Does NOT own |
|---|---|---|
| `src/features/<domain>/` | Pages + dialogs for one business area, all data-fetching via hooks | Request/response shapes (that's `lib/api/`), design-system primitives (that's `components/ui/`) |
| `src/lib/api/` | One file per backend resource, wraps `client.ts` | Any UI rendering |
| `src/auth/` | Auth context + route guarding | Token *storage* mechanics (that's `lib/api/tokens.ts`) |
| `src/components/ui/` | Design-system primitives, no business logic | Feature-specific composition |
| `src/lib/` (root files) | Cross-cutting utilities: `queryKeys.ts`, `jwt.ts`, `cn.ts`, `format.ts`, `formatName.ts`, `chartColors.ts`, `queryClient.ts` | — |

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
