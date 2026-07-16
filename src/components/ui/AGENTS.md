# AGENTS.md — `src/components/ui/`

## Owns

The entire design-system primitive layer — **no external UI kit is used**; this directory is the
only place base visual components should be defined.

- `Button.tsx` — variants `primary|secondary|ghost|danger|subtle`, sizes `sm|md|lg|icon`, `loading`
  prop, `forwardRef`.
- `Badge.tsx` — `Badge` (neutral chip), `StatusBadge`/`PriorityBadge` (tone + icon pairing — see
  Architectural constraints), exported `Tone`/`TONES`/`DOT_TONE`/`STATUS_TONE` maps reused
  elsewhere.
- `Card.tsx` — `Card`, `CardHeader`, `CardBody`, `CardDivider`.
- `Dialog.tsx` — portaled modal, focus trap, Escape-to-close, body-scroll lock, focus restore.
- `DocumentPreviewDialog.tsx` — wraps `Dialog`, source-agnostic `PreviewTarget` interface
  (inline-renders PDF/PNG/JPEG, else download-only fallback).
- `Table.tsx` — `TableWrap`, `Table`, `THead` (sticky), `TBody`, `Tr`, `Th`, `Td`.
- `Toast.tsx` — `ToastProvider`/`useToast()`, portaled bottom-right stack, tones
  `success|error|info`, 4500ms auto-dismiss.
- `Avatar.tsx` — `PersonAvatar` (circle) vs `EntityAvatar` (square) — deliberate shape distinction.
- `DatePicker.tsx` — custom-portaled `react-day-picker` wrapper with a themed dropdown.
- `Field.tsx` — `Input`, `Textarea`, custom portaled `Select`, `Label`, `Field` wrapper.
- `Feedback.tsx` — `Spinner`, `LoadingState`, `Skeleton`, `EmptyState`, `ErrorState` (tailored copy
  for `ApiError` 403s vs generic errors).
- `PageHeader.tsx` — title + accent underline + description + actions row.
- `Tabs.tsx` — `role="tablist"` tab bar with optional count badges.
- `MentionTextarea.tsx` — `@name` autocomplete textarea.
- `UserMultiSelect.tsx` — checkbox list of tenant users, degrades gracefully without `users:read`.
- `useFloatingPanel.ts` — non-visual hook pair (`useFloatingPanel`, `useOutsideClose`) shared by
  `Select`, `DatePicker`, `MentionTextarea`.

## Does NOT own

- Business logic or feature-specific composition — a component here should be usable by any
  feature domain without knowing what a "case" or "tenant" is (exceptions: `UserMultiSelect`'s
  `users:read` permission check is the one deliberate, narrowly-scoped exception).
- Data fetching — primitives take props, they don't call `lib/api/*` themselves (again,
  `UserMultiSelect` is the documented exception).

## Major entrypoints

Import directly by name, e.g. `import { Button } from '@/components/ui/Button'`. No barrel
`index.ts` re-export was found — import from the specific file.

## Important dependencies

- `src/tokens.css` (OKLCH custom properties) — every primitive should reference Tailwind
  utility classes / CSS variables, never hardcode a color.
- `useFloatingPanel.ts` is a genuine internal dependency of `Select`/`DatePicker`/
  `MentionTextarea` — modify carefully, three components rely on its positioning/outside-click
  behavior simultaneously.

## Common modification patterns

- **New primitive**: add a file here following the existing pattern (typed props, `forwardRef`
  where the component wraps a native focusable element, Tailwind classes referencing token
  variables). Check `DESIGN.md` for radius/shadow/motion conventions (cards 12-14px radius,
  controls 8-10px, single hairline border OR ≤8px shadow never both, ≤240ms ease-out-quint
  motion, full `prefers-reduced-motion` fallback).
- **Extending `Badge.tsx`'s tone system**: add to `TONES`/`STATUS_TONE`/`TONE_ICON` maps rather
  than creating a one-off colored element in a feature file — this keeps the "never color alone"
  rule structurally enforced.

## Architectural constraints

- **Every status/priority-bearing UI must pair a tone with a label or icon** — this is a verified,
  consistently-followed rule (`Badge.tsx`'s `Capsule`/`StatusBadge`/`PriorityBadge`, the `.dot`
  utility in `index.css`). Do not add a bare color-only status indicator.
- Primitives are the design system — a feature file rolling its own `<button>` for anything beyond
  a compact icon-only/tab-like control should probably use `Button`/`Tabs` instead (some raw
  `<button>` usage exists in feature folders for exactly that narrow exception; don't expand it).
- Light-only theme (no dark mode in v1, per `DESIGN.md`) — don't add dark-mode-specific styling
  without a product decision.

## Files to inspect first

1. `Badge.tsx` — the status/tone pattern every other status-displaying component follows.
2. `Dialog.tsx` — the modal primitive most feature dialogs (`*Dialog.tsx` files across
   `src/features/`) build on top of.
3. `useFloatingPanel.ts` — shared positioning logic behind three separate primitives.
