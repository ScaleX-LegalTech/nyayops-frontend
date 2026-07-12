import { useEffect, useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Dialog } from './Dialog'
import { Button } from './Button'

const INLINE_VIEWABLE = new Set(['application/pdf', 'image/png', 'image/jpeg'])

export interface PreviewTarget {
  title: string
  mimeType: string | null
  /** Fetches the raw bytes - documents and CNR orders load from different backend
   * routes (one storage-key-based, one extractor-proxying), so the dialog stays
   * source-agnostic and just calls whatever loader the caller wires up. */
  load: () => Promise<Blob>
}

/** Shared across every "view a document" affordance in the app. Only PDF/PNG/JPEG can
 * render inline in a browser without a conversion service - everything else (the
 * .doc/.docx/.xls/.xlsx types the upload pipeline also allows) falls back to a
 * download prompt instead of a broken/blank preview. */
export function DocumentPreviewDialog({
  open,
  onClose,
  target,
}: {
  open: boolean
  onClose: () => void
  target: PreviewTarget | null
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !target) return
    let cancelled = false
    let objectUrl: string | null = null
    setUrl(null)
    setError(null)
    target
      .load()
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch(() => {
        if (!cancelled) setError('Could not load preview.')
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [open, target])

  function handleDownload() {
    if (!url || !target) return
    const link = document.createElement('a')
    link.href = url
    link.download = target.title
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  const viewable = !!target?.mimeType && INLINE_VIEWABLE.has(target.mimeType)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={target?.title ?? 'Preview'}
      size="xl"
      bodyClassName="h-[80vh] p-0"
      footer={
        target && (
          <Button variant="secondary" disabled={!url} onClick={handleDownload}>
            <Download className="size-4" /> Download
          </Button>
        )
      }
    >
      <div className="flex h-full items-center justify-center bg-surface-muted">
        {error ? (
          <p className="text-sm text-danger">{error}</p>
        ) : !url ? (
          <Loader2 className="size-6 animate-spin text-ink-muted" />
        ) : !viewable ? (
          <p className="max-w-sm px-6 text-center text-sm text-ink-muted">
            Preview isn't available for this file type — download it to view.
          </p>
        ) : target?.mimeType === 'application/pdf' ? (
          <iframe src={url} title={target.title} className="h-full w-full" />
        ) : (
          <img src={url} alt={target?.title} className="max-h-full max-w-full object-contain" />
        )}
      </div>
    </Dialog>
  )
}
