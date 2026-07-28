import { useState, type DragEvent, type ReactNode } from 'react'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'
import { stageAttachment } from './chatAttachmentStore'

/** Lets a file be dropped anywhere over the chat panel - not just
 * ChatInputBar's own input row, which only catches drops directly on it.
 * Shared by AskNyayOpsPage and AskNyayOpsLauncher so the two host surfaces
 * don't duplicate the same drag handlers. Staging goes through the same
 * chatAttachmentStore singleton ChatInputBar's paperclip/drop uses, so
 * whichever surface staged the file, ChatInputBar's chip and
 * pendingActionHandlers' execute both see it. */
export function ChatAttachDropZone({
  children,
  className,
}: {
  children: ReactNode
  /** Applied to the same div the drag handlers attach to, so a host page can
   * keep its own layout classes (sizing/flex/border) instead of this
   * component imposing its own - the two call sites have different shapes
   * (full page vs. floating launcher panel). */
  className?: string
}) {
  const { toast } = useToast()
  const [dragOver, setDragOver] = useState(false)

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    setDragOver(true)
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setDragOver(false)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    const error = stageAttachment(file)
    if (error) toast(error, 'error')
  }

  return (
    <div
      className={cn('relative', className)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}
      {dragOver && (
        <div
          className="animate-fade-scale-in pointer-events-none absolute inset-0 z-20 grid place-items-center border-2 border-dashed border-brand bg-brand-soft/80 text-sm font-medium text-brand"
          aria-hidden
        >
          Drop a file to attach it to the chat
        </div>
      )}
    </div>
  )
}
