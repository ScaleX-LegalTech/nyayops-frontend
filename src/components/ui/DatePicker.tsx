import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DayPicker, type ChevronProps, type DropdownProps } from 'react-day-picker'
import { format, parseISO } from 'date-fns'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import 'react-day-picker/style.css'
import { cn } from '@/lib/cn'
import { useFloatingPanel, useOutsideClose } from './useFloatingPanel'

const CURRENT_YEAR = new Date().getFullYear()
const NAV_START = new Date(CURRENT_YEAR - 100, 0, 1)
const NAV_END = new Date(CURRENT_YEAR + 10, 11, 31)

function DpChevron({ orientation }: ChevronProps) {
  const Icon = orientation === 'right' ? ChevronRight : ChevronLeft
  return <Icon className="size-4 text-ink-muted" />
}

/** react-day-picker's built-in month/year dropdowns render a native <select> — the
 * open list is then browser chrome that CSS can't touch (no rounded corners, no
 * blur). This replaces it with a real, portaled popover so it can match the app's
 * look and isn't clipped by the calendar panel's own overflow-y-auto. */
function DpDropdown({ options, value, onChange, disabled, 'aria-label': ariaLabel }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const { triggerRef, panelRef, pos } = useFloatingPanel<HTMLButtonElement>(open)
  const close = () => setOpen(false)
  useOutsideClose(open, [triggerRef, panelRef], close)
  const selected = options?.find((o) => o.value === value)
  const selectedRef = useRef<HTMLButtonElement>(null)

  // Years span a century (see NAV_START/NAV_END) - without this the list always opens
  // scrolled to 1926, not near whatever year is actually selected.
  useLayoutEffect(() => {
    if (open) selectedRef.current?.scrollIntoView({ block: 'center' })
  }, [open])

  function pick(v: number) {
    onChange?.({ target: { value: String(v) } } as React.ChangeEvent<HTMLSelectElement>)
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        disabled={disabled}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
        onMouseDown={(e) => e.stopPropagation()}
        className="flex items-center gap-0.5 rounded-md px-1 py-0.5 text-sm font-semibold text-ink hover:bg-surface-muted"
      >
        {selected?.label}
        <ChevronDown className="size-3 text-ink-muted" />
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            onMouseDown={(e) => e.stopPropagation()}
            className="scrollbar-thin fixed max-h-44 w-24 overflow-y-auto rounded-xl border border-border/60 bg-surface/85 p-1 text-sm font-normal shadow-pop backdrop-blur-md animate-rise"
            style={{ top: pos.top, left: pos.left, zIndex: 'var(--z-popover)' }}
          >
            {options?.map((o) => (
              <button
                key={o.value}
                ref={o.value === value ? selectedRef : undefined}
                type="button"
                disabled={o.disabled}
                onClick={() => pick(o.value)}
                className={cn(
                  'block w-full rounded-lg px-2 py-1 text-left font-normal',
                  o.value === value ? 'bg-brand text-white' : 'text-ink hover:bg-surface-muted',
                  o.disabled && 'opacity-40',
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

export function DatePicker({
  value,
  onChange,
  placeholder = 'Select date',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const { triggerRef, panelRef, pos } = useFloatingPanel<HTMLButtonElement>(open)
  useOutsideClose(open, [triggerRef, panelRef], () => {
    setOpen(false)
  })

  function selectDay(day: Date | undefined) {
    onChange(day ? format(day, 'yyyy-MM-dd') : '')
    setOpen(false)
    triggerRef.current?.focus()
  }

  const selected = value ? parseISO(value) : undefined

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex h-10 w-full items-center gap-2 rounded-control border border-border-strong bg-surface px-3 text-sm text-ink hover:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <CalendarDays className="size-4 text-ink-muted" />
        <span className={cn(!value && 'text-ink-faint')}>
          {value ? format(selected!, 'dd MMM yyyy') : placeholder}
        </span>
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            className="dp-panel fixed max-h-[calc(100vh-1rem)] overflow-y-auto rounded-card border border-border bg-surface p-2 shadow-pop animate-rise"
            style={{ top: pos.top, left: pos.left, zIndex: 'var(--z-popover)' }}
          >
            <DayPicker
              mode="single"
              selected={selected}
              defaultMonth={selected}
              onSelect={selectDay}
              captionLayout="dropdown"
              startMonth={NAV_START}
              endMonth={NAV_END}
              components={{ Chevron: DpChevron, Dropdown: DpDropdown }}
              style={
                {
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
              }
            />
          </div>,
          document.body,
        )}
    </>
  )
}
