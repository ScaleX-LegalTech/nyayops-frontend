import { useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Textarea } from './Field'
import { useFloatingPanel, useOutsideClose } from './useFloatingPanel'
import { cn } from '@/lib/cn'
import { displayName } from '@/lib/formatName'
import type { CasePerson } from '@/types'

interface MentionTextareaProps {
  value: string
  onChange: (value: string) => void
  people: CasePerson[]
  placeholder?: string
  rows?: number
}

/** Textarea with "@name" autocomplete, backed by the given people list. */
export function MentionTextarea({
  value,
  onChange,
  people,
  placeholder,
  rows = 2,
}: MentionTextareaProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [mentionStart, setMentionStart] = useState<number | null>(null)
  const [highlighted, setHighlighted] = useState(0)

  const { triggerRef: textareaRef, panelRef, pos } = useFloatingPanel<HTMLTextAreaElement>(open)
  useOutsideClose(open, [textareaRef, panelRef], () => setOpen(false))

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value
    onChange(next)

    const cursor = e.target.selectionStart ?? next.length
    const beforeCursor = next.slice(0, cursor)
    const at = beforeCursor.lastIndexOf('@')
    if (at === -1 || /\s/.test(beforeCursor.slice(at + 1))) {
      setOpen(false)
      return
    }
    setQuery(beforeCursor.slice(at + 1))
    setMentionStart(at)
    setHighlighted(0)
    setOpen(true)
  }

  const suggestions = open
    ? people
        .filter(
          (u) =>
            u.full_name.toLowerCase().includes(query.toLowerCase()) ||
            u.email.toLowerCase().includes(query.toLowerCase()),
        )
        .slice(0, 6)
    : []

  function pick(user: CasePerson) {
    if (mentionStart === null) return
    const cursor = textareaRef.current?.selectionStart ?? value.length
    const next = `${value.slice(0, mentionStart)}@${user.full_name} ${value.slice(cursor)}`
    onChange(next)
    setOpen(false)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (!open || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted((h) => (h + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted((h) => (h - 1 + suggestions.length) % suggestions.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      pick(suggestions[highlighted])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  return (
    <>
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        role="combobox"
        aria-expanded={open && suggestions.length > 0}
        aria-controls="mention-suggestions"
        aria-activedescendant={
          open && suggestions[highlighted] ? `mention-option-${suggestions[highlighted].id}` : undefined
        }
      />
      {open &&
        suggestions.length > 0 &&
        createPortal(
          <div
            ref={panelRef}
            id="mention-suggestions"
            role="listbox"
            className="fixed w-64 rounded-card border border-border bg-surface p-1 shadow-pop animate-rise"
            style={{ top: pos.top, left: pos.left, zIndex: 'var(--z-dropdown)' }}
          >
            {suggestions.map((u, i) => (
              <button
                key={u.id}
                id={`mention-option-${u.id}`}
                type="button"
                role="option"
                aria-selected={i === highlighted}
                onMouseEnter={() => setHighlighted(i)}
                onClick={() => pick(u)}
                className={cn(
                  'flex w-full flex-col rounded-control px-2.5 py-1.5 text-left text-sm',
                  i === highlighted ? 'bg-surface-muted' : 'hover:bg-surface-muted',
                )}
              >
                <span className="font-medium text-ink">{displayName(u)}</span>
                <span className="text-xs text-ink-faint">{u.email}</span>
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
