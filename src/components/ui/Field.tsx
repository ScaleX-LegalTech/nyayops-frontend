import {
  Children,
  forwardRef,
  isValidElement,
  useMemo,
  useState,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type OptionHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useFloatingPanel, useOutsideClose } from './useFloatingPanel'

const CONTROL =
  'w-full rounded-control border border-border-strong bg-surface px-3 py-2 text-sm text-ink ' +
  'transition-colors placeholder:text-ink-faint focus-visible:outline-2 focus-visible:outline-offset-0 ' +
  'focus-visible:outline-brand focus-visible:border-brand disabled:cursor-not-allowed disabled:bg-surface-muted'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(CONTROL, 'h-10', className)} {...props} />
  },
)

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(CONTROL, 'min-h-24 resize-y', className)} {...props} />
  },
)

/** Native <select> popups are browser chrome — no rounded corners, no blur, can't be
 * themed. This mimics the native API (value/onChange/<option> children) so it's a
 * drop-in replacement, but renders its own portaled listbox to match the app's look. */
export function Select({
  className,
  children,
  value,
  onChange,
  disabled,
  id,
  'aria-label': ariaLabel,
}: SelectHTMLAttributes<HTMLSelectElement>) {
  const [open, setOpen] = useState(false)
  const { triggerRef, panelRef, pos } = useFloatingPanel<HTMLButtonElement>(open)
  useOutsideClose(open, [triggerRef, panelRef], () => setOpen(false))

  const options = useMemo(
    () =>
      Children.toArray(children)
        .filter((c): c is ReactElement<OptionHTMLAttributes<HTMLOptionElement>> => isValidElement(c))
        .map((c) => ({
          value: String(c.props.value ?? ''),
          label: c.props.children,
          disabled: c.props.disabled,
        })),
    [children],
  )
  const currentValue = String(value ?? '')
  const selected = options.find((o) => o.value === currentValue)

  function pick(v: string) {
    onChange?.({ target: { value: v } } as React.ChangeEvent<HTMLSelectElement>)
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        id={id}
        ref={triggerRef}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(CONTROL, 'flex h-10 items-center justify-between gap-2 pr-3 text-left', className)}
      >
        <span className="truncate">{selected?.label ?? ' '}</span>
        <ChevronDown className="size-4 shrink-0 text-ink-muted" />
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="listbox"
            className="scrollbar-thin fixed max-h-60 overflow-y-auto whitespace-nowrap rounded-control border border-border bg-surface p-1 text-sm shadow-pop animate-rise"
            style={{
              top: pos.top,
              left: pos.left,
              minWidth: triggerRef.current?.offsetWidth,
              zIndex: 'var(--z-popover)',
            }}
          >
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={o.value === currentValue}
                disabled={o.disabled}
                onClick={() => pick(o.value)}
                className={cn(
                  'block w-full rounded-control px-2.5 py-1.5 text-left font-normal',
                  o.value === currentValue ? 'bg-brand text-white' : 'text-ink hover:bg-surface-muted',
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

export function Label({ className, children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn('text-sm font-medium text-ink', className)} {...props}>
      {children}
    </label>
  )
}

interface FieldProps {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  required?: boolean
  htmlFor?: string
  className?: string
  children: ReactNode
}

export function Field({ label, hint, error, required, htmlFor, className, children }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <Label htmlFor={htmlFor}>
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </Label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-muted">{hint}</p>
      ) : null}
    </div>
  )
}
