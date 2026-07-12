import { useRef, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { UploadCloud } from 'lucide-react'
import {
  confirmUpload,
  createDocumentVersion,
  createUploadUrl,
  uploadFileBytes,
} from '@/lib/api/documents'
import { listCases } from '@/lib/api/cases'
import { qk } from '@/lib/queryKeys'
import { formatBytes } from '@/lib/format'
import { useMutationWithToast } from '@/lib/useMutationWithToast'
import { useToast } from '@/components/ui/Toast'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'

interface BaseProps {
  open: boolean
  onClose: () => void
}

type UploadDialogProps =
  | (BaseProps & {
      mode: 'new'
      documentId?: undefined
      caseId?: string
      description?: string
      skipLabel?: string
    })
  | (BaseProps & { mode: 'version'; documentId: string; caseId: string })

export function UploadDialog(props: UploadDialogProps) {
  const { open, onClose, mode } = props
  const lockedCaseId = mode === 'new' ? props.caseId : undefined
  const dialogDescription = mode === 'new' ? props.description : undefined
  const skipLabel = (mode === 'new' && props.skipLabel) || 'Cancel'
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [caseId, setCaseId] = useState(lockedCaseId ?? '')
  const [title, setTitle] = useState('')
  const [docType, setDocType] = useState('')
  const [changeNote, setChangeNote] = useState('')

  const casesQuery = useQuery({
    queryKey: qk.cases(),
    queryFn: () => listCases(),
    enabled: open && mode === 'new',
  })

  const mutation = useMutationWithToast({
    mutationFn: async () => {
      if (!file) throw new Error('Choose a file first.')
      const meta = {
        filename: file.name,
        mime_type: file.type || 'application/octet-stream',
        file_size_bytes: file.size,
        change_note: changeNote || undefined,
      }
      const res =
        mode === 'version'
          ? await createDocumentVersion(props.documentId, meta)
          : await createUploadUrl({
              case_id: caseId,
              title,
              doc_type: docType,
              ...meta,
            })
      await uploadFileBytes(res.upload_url, file)
      await confirmUpload(res.document_id, crypto.randomUUID())
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      toast(mode === 'version' ? 'New version uploaded.' : 'Document uploaded.', 'success')
      reset()
      onClose()
    },
    errorFallback: (err) => (err as Error).message,
  })

  function reset() {
    setFile(null)
    setCaseId(lockedCaseId ?? '')
    setTitle('')
    setDocType('')
    setChangeNote('')
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    mutation.mutate()
  }

  const valid = file && (mode === 'version' || (caseId && title && docType))

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={mode === 'version' ? 'Upload new version' : 'Upload document'}
      description={dialogDescription}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {skipLabel}
          </Button>
          <Button type="submit" form="upload-form" loading={mutation.isPending} disabled={!valid}>
            Upload
          </Button>
        </>
      }
    >
      <form id="upload-form" onSubmit={submit} className="space-y-4">
        {mode === 'new' && (
          <>
            <Field label="Case" required>
              <Select
                value={caseId}
                onChange={(e) => setCaseId(e.target.value)}
                disabled={!!lockedCaseId}
                required
              >
                <option value="">Select a case…</option>
                {(casesQuery.data ?? [])
                  .filter((c) => c.status !== 'closed')
                  .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title" required>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
              </Field>
              <Field label="Document type" required>
                <Input
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  placeholder="Pleading, Evidence…"
                  required
                />
              </Field>
            </div>
          </>
        )}

        <Field label="File" required>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-card border border-dashed border-border-strong bg-surface-muted px-4 py-8 text-center hover:border-brand"
          >
            <UploadCloud className="size-7 text-ink-muted" />
            {file ? (
              <span className="text-sm text-ink">
                {file.name} <span className="text-ink-muted">({formatBytes(file.size)})</span>
              </span>
            ) : (
              <span className="text-sm text-ink-muted">Click to choose a file (max 50 MB)</span>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </Field>

        <Field label="Change note" hint="Optional — describe what changed.">
          <Textarea value={changeNote} onChange={(e) => setChangeNote(e.target.value)} rows={2} />
        </Field>
      </form>
    </Dialog>
  )
}
