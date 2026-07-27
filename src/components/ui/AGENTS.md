# AGENTS.md — `src/components/ui/`

See `../../../AGENTS.md` for stack/architecture context.

## Owns

Entire design-system primitive layer — no external UI kit; only place base visual components
should be defined.

- `Button.tsx` — variants `primary|secondary|ghost|danger|subtle`, sizes `sm|md|lg|icon`,
  `loading` prop, `forwardRef`.
- `Badge.tsx` — `Badge` (neutral chip), `StatusBadge`/`PriorityBadge` (tone + icon pairing),
  exported `Tone`/`TONES`/`DOT_TONE`/`STATUS_TONE` maps reused elsewhere.
- `Card.tsx` — `Card`, `CardHeader`, `CardBody`, `CardDivider`.
- `Dialog.tsx` — portaled modal, focus trap, Escape-to-close, body-scroll lock, focus restore.
- `DocumentPreviewDialog.tsx` — wraps `Dialog`, source-agnostic `PreviewTarget` interface
  (inline-renders PDF/PNG/JPEG, else download-only fallback).
- `Table.tsx` — `TableWrap`, `Table`, `THead` (sticky), `TBody`, `Tr`, `Th`, `Td`.
- `Toast.tsx` — `ToastProvider`/`useToast()`, portaled bottom-right stack, tones
  `success|error|info`, 4500ms auto-dismiss.
- `Avatar.tsx` — `PersonAvatar` (circle) vs `EntityAvatar` (square), deliberate shape distinction.
- `DatePicker.tsx` — custom-portaled `react-day-picker` wrapper, themed dropdown.
- `Field.tsx` — `Input`, `Textarea`, custom portaled `Select`, `Label`, `Field` wrapper.
- `Feedback.tsx` — `Spinner`, `LoadingState`, `Skeleton`, `EmptyState`, `ErrorState` (tailored
  copy for `ApiError` 403s vs generic errors).
- `PageHeader.tsx` — title + accent underline + description + actions row.
- `Tabs.tsx` — `role="tablist"` tab bar with optional count badges.
- `MentionTextarea.tsx` — `@name` autocomplete textarea.
- `UserMultiSelect.tsx` — searchable checkbox list of candidates for a `caseIds` prop. `source`
  picks the backing endpoint: `'assignable'` (default, `GET /cases/assignable-people`,
  branch-scoped) for picking someone *new* onto a case; `'case-people'` (`GET
  /cases/{id}/people`, single case) wherever the selection grants case visibility — e.g. a
  bill's `associate_id` is `BillService`'s only access gate for non-admins, so
  `RaiseBillDialog` uses `'case-people'` to stop a branch-mate not on the case from seeing its
  title/client via the bill queue. Selected rows float to top; degrades gracefully if fetch
  isn't permitted.
- `useFloatingPanel.ts` — non-visual hook pair (`useFloatingPanel`, `useOutsideClose`) shared by
  `Select`, `DatePicker`, `MentionTextarea`.

## Does NOT own / dependencies

- No business logic or feature-specific composition — usable by any domain without knowing
  "case"/"tenant" (exception: `UserMultiSelect`, case-scoped since assignability depends on
  branch). No data fetching in primitives (same exception).
- No barrel `index.ts` — import by file: `import { Button } from '@/components/ui/Button'`.
- `src/tokens.css` (OKLCH) — every primitive uses Tailwind utilities/CSS vars, never hardcoded
  color.
- `useFloatingPanel.ts` — shared by `Select`/`DatePicker`/`MentionTextarea`; modify carefully,
  three components rely on its positioning/outside-click behavior at once.

## Common modification patterns / constraints

- **New primitive**: typed props, `forwardRef` where it wraps a native focusable element,
  Tailwind classes referencing token vars. Check `DESIGN.md` (cards 12-14px radius, controls
  8-10px, single hairline border OR ≤8px shadow never both, ≤240ms ease-out-quint,
  `prefers-reduced-motion` fallback).
- **Extending `Badge.tsx`'s tone system**: add to `TONES`/`STATUS_TONE`/`TONE_ICON` maps, not a
  one-off colored element — keeps "never color alone" structurally enforced (`Capsule`/
  `StatusBadge`/`PriorityBadge`, `.dot` in `index.css`; no bare color-only indicators anywhere).
- A feature file rolling its own `<button>` beyond a compact icon-only/tab-like control should use
  `Button`/`Tabs` instead (narrow existing exceptions in feature folders; don't expand).
- Light-only theme (no dark mode in v1, per `DESIGN.md`) — don't add dark-mode styling without a
  product decision.

## Files to inspect first

`Badge.tsx` (status/tone pattern), `Dialog.tsx` (modal base for `*Dialog.tsx` files across
`src/features/`), `useFloatingPanel.ts` (shared positioning behind three primitives).
