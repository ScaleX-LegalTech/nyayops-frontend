import { useState } from 'react'
import { createPortal } from 'react-dom'
import { MoreVertical, Reply, Trash2 } from 'lucide-react'
import { useFloatingPanel, useOutsideClose } from '@/components/ui/useFloatingPanel'

export function CommentMenu({
  canDeleteForEveryone,
  onReply,
  onDeleteForMe,
  onDeleteForEveryone,
}: {
  canDeleteForEveryone: boolean
  onReply: () => void
  onDeleteForMe: () => void
  onDeleteForEveryone: () => void
}) {
  const [open, setOpen] = useState(false)
  const { triggerRef, panelRef, pos } = useFloatingPanel<HTMLButtonElement>(open)
  useOutsideClose(open, [triggerRef, panelRef], () => setOpen(false))

  function run(action: () => void) {
    setOpen(false)
    action()
  }

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        aria-label="Message actions"
        className={`mb-1 grid size-7 shrink-0 place-items-center self-start rounded-full text-ink-faint opacity-0 hover:bg-surface-muted hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 ${open ? 'opacity-100' : ''}`}
      >
        <MoreVertical className="size-4" />
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed w-44 overflow-hidden rounded-card border border-border bg-surface shadow-pop animate-rise"
            style={{ top: pos.top, left: pos.left, zIndex: 'var(--z-dropdown)' }}
          >
            <button
              onClick={() => run(onReply)}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-ink hover:bg-surface-muted"
            >
              <Reply className="size-4 text-ink-muted" /> Reply
            </button>
            <button
              onClick={() => run(onDeleteForMe)}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-ink hover:bg-surface-muted"
            >
              <Trash2 className="size-4 text-ink-muted" /> Delete for me
            </button>
            {canDeleteForEveryone && (
              <button
                onClick={() => run(onDeleteForEveryone)}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-danger hover:bg-surface-muted"
              >
                <Trash2 className="size-4" /> Delete for everyone
              </button>
            )}
          </div>,
          document.body,
        )}
    </>
  )
}
