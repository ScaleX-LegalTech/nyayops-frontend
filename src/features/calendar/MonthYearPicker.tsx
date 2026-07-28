import { createPortal } from 'react-dom'
import { useState } from 'react'
import { format, setMonth, setYear, startOfMonth } from 'date-fns'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useFloatingPanel, useOutsideClose } from '@/components/ui/useFloatingPanel'

const MONTH_LABELS = Array.from({ length: 12 }, (_, i) => format(new Date(2000, i, 1), 'MMM'))

/** Jump straight to any month/year - a popover grid instead of clicking prev/next
 * repeatedly. Opened from a single "July 2026"-style trigger rather than two
 * separate month/year `<select>`s, so it reads as one elegant control. */
export function MonthYearPicker({
  month,
  onChange,
}: {
  month: Date
  onChange: (month: Date) => void
}) {
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(month.getFullYear())
  const { triggerRef, panelRef, pos } = useFloatingPanel<HTMLButtonElement>(open)
  useOutsideClose(open, [triggerRef, panelRef], () => setOpen(false))

  function openPicker() {
    setViewYear(month.getFullYear())
    setOpen(true)
  }

  function pickMonth(monthIndex: number) {
    onChange(startOfMonth(setYear(setMonth(month, monthIndex), viewYear)))
    setOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        onClick={() => (open ? setOpen(false) : openPicker())}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-control px-2 py-1 text-base font-semibold text-ink hover:bg-surface-muted"
      >
        {format(month, 'MMMM yyyy')}
        <ChevronDown className="size-4 text-ink-muted" />
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed w-64 rounded-card border border-border bg-surface p-3 shadow-pop animate-rise"
            style={{ top: pos.top, left: pos.left, zIndex: 'var(--z-popover)' }}
          >
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setViewYear((y) => y - 1)}
                aria-label="Previous year"
                className="grid size-7 place-items-center rounded-control text-ink-muted hover:bg-surface-muted"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="text-sm font-semibold text-ink tabular">{viewYear}</span>
              <button
                type="button"
                onClick={() => setViewYear((y) => y + 1)}
                aria-label="Next year"
                className="grid size-7 place-items-center rounded-control text-ink-muted hover:bg-surface-muted"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {MONTH_LABELS.map((label, i) => {
                const active = viewYear === month.getFullYear() && i === month.getMonth()
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => pickMonth(i)}
                    className={cn(
                      'rounded-control px-2 py-1.5 text-sm font-medium transition-colors',
                      active
                        ? 'bg-brand text-white'
                        : 'text-ink hover:bg-surface-muted',
                    )}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
