import { useState } from 'react'
import { createPortal } from 'react-dom'
import { DayPicker, type DateRange } from 'react-day-picker'
import { format, parseISO } from 'date-fns'
import { CalendarDays, ChevronDown, X } from 'lucide-react'
import 'react-day-picker/style.css'
import { cn } from '@/lib/cn'
import { useFloatingPanel, useOutsideClose } from '@/components/ui/useFloatingPanel'
import {
  MODULE_OPTIONS,
  formatDateFilterLabel,
  type DateFilterValue,
  type ModuleFilterValue,
} from './filterHelpers'

const TRIGGER =
  'flex h-9 shrink-0 items-center gap-1.5 rounded-control border px-2.5 text-xs font-medium ' +
  'transition-colors focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand'

export function ModuleFilter({
  value,
  onChange,
}: {
  value: ModuleFilterValue
  onChange: (v: ModuleFilterValue) => void
}) {
  const [open, setOpen] = useState(false)
  const { triggerRef, panelRef, pos } = useFloatingPanel<HTMLButtonElement>(open)
  useOutsideClose(open, [triggerRef, panelRef], () => setOpen(false))
  const active = value !== 'all'
  const selectedLabel = MODULE_OPTIONS.find((o) => o.value === value)?.label ?? 'Module'

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          TRIGGER,
          active
            ? 'border-brand bg-brand-soft text-brand-strong'
            : 'border-border-strong bg-surface text-ink hover:border-brand hover:bg-brand-soft',
        )}
      >
        {active ? selectedLabel : 'Module'}
        <ChevronDown className="size-3.5" />
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="listbox"
            className="scrollbar-thin fixed max-h-64 w-40 overflow-y-auto rounded-control border border-border bg-surface p-1 text-sm shadow-pop animate-rise"
            style={{ top: pos.top, left: pos.left, zIndex: 'var(--z-popover)' }}
          >
            {MODULE_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={o.value === value}
                onClick={() => {
                  onChange(o.value)
                  setOpen(false)
                }}
                className={cn(
                  'block w-full rounded-control px-2.5 py-1.5 text-left text-sm font-normal',
                  o.value === value ? 'bg-brand text-white' : 'text-ink hover:bg-surface-muted',
                )}
              >
                {o.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}

export function DateFilter({
  value,
  onChange,
}: {
  value: DateFilterValue | null
  onChange: (v: DateFilterValue | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [pickMode, setPickMode] = useState<'single' | 'range'>('range')
  // A separate draft from `value` - react-day-picker's range mode needs to see its own
  // in-progress {from, to: undefined} selection to know a second click extends the same
  // range rather than starting a new one; committing the first click straight into
  // `value` would make it look like a completed 1-day range and break that continuation.
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(undefined)
  const { triggerRef, panelRef, pos } = useFloatingPanel<HTMLButtonElement>(open)
  useOutsideClose(open, [triggerRef, panelRef], () => setOpen(false))

  function toggleOpen() {
    setOpen((v) => {
      const next = !v
      if (next) {
        setDraftRange(value ? { from: parseISO(value.from), to: parseISO(value.to) } : undefined)
      }
      return next
    })
  }

  function selectSingle(day: Date | undefined) {
    if (!day) return
    const iso = format(day, 'yyyy-MM-dd')
    onChange({ from: iso, to: iso })
    setOpen(false)
    triggerRef.current?.focus()
  }

  function selectRange(range: DateRange | undefined) {
    setDraftRange(range)
    if (range?.from && range.to) {
      onChange({ from: format(range.from, 'yyyy-MM-dd'), to: format(range.to, 'yyyy-MM-dd') })
      setOpen(false)
      triggerRef.current?.focus()
    }
  }

  const active = value !== null

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggleOpen}
        className={cn(
          TRIGGER,
          active
            ? 'border-brand bg-brand-soft text-brand-strong'
            : 'border-border-strong bg-surface text-ink hover:border-brand hover:bg-brand-soft',
        )}
      >
        <CalendarDays className="size-3.5" />
        {active ? formatDateFilterLabel(value) : 'Date'}
        {active && (
          <X
            className="size-3.5 text-ink-faint hover:text-ink"
            onClick={(e) => {
              e.stopPropagation()
              onChange(null)
            }}
          />
        )}
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            className="dp-panel fixed max-h-[calc(100vh-1rem)] overflow-y-auto rounded-card border border-border bg-surface p-2 shadow-pop animate-rise"
            style={{ top: pos.top, left: pos.left, zIndex: 'var(--z-popover)' }}
          >
            <div className="mb-1 flex gap-1 px-1">
              {(['single', 'range'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPickMode(m)}
                  className={cn(
                    'flex-1 rounded-control px-2 py-1 text-xs font-medium transition-colors',
                    pickMode === m
                      ? 'bg-brand-soft text-brand-strong'
                      : 'text-ink-muted hover:bg-surface-muted',
                  )}
                >
                  {m === 'single' ? 'Specific date' : 'Date range'}
                </button>
              ))}
            </div>
            {pickMode === 'single' ? (
              <DayPicker
                mode="single"
                selected={value ? parseISO(value.from) : undefined}
                defaultMonth={value ? parseISO(value.from) : undefined}
                onSelect={selectSingle}
                style={DP_STYLE}
              />
            ) : (
              <DayPicker
                mode="range"
                selected={draftRange}
                defaultMonth={value ? parseISO(value.from) : undefined}
                onSelect={selectRange}
                style={DP_STYLE}
              />
            )}
            {active && (
              <button
                type="button"
                onClick={() => {
                  onChange(null)
                  setOpen(false)
                }}
                className="w-full rounded-control px-2 py-1 text-center text-xs font-medium text-ink-muted hover:bg-surface-muted hover:text-ink"
              >
                Clear
              </button>
            )}
          </div>,
          document.body,
        )}
    </>
  )
}

const DP_STYLE = {
  fontSize: '0.8125rem',
  '--rdp-accent-color': 'var(--color-brand)',
  '--rdp-day-width': '30px',
  '--rdp-day-height': '30px',
  '--rdp-day_button-width': '28px',
  '--rdp-day_button-height': '28px',
  '--rdp-nav_button-width': '1.75rem',
  '--rdp-nav_button-height': '1.75rem',
  '--rdp-nav-height': '2rem',
  '--rdp-weekday-padding': '0.125rem 0rem',
} as React.CSSProperties
