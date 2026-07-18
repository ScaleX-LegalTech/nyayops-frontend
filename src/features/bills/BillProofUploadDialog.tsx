import { useRef, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { UploadCloud } from 'lucide-react'
import { createUploadUrl, uploadFileBytes, confirmUpload } from '@/lib/api/documents'
import { uploadBillProof } from '@/lib/api/bills'
import { formatBytes } from '@/lib/format'
import { invalidateCaseScopes, qk } from '@/lib/queryKeys'
import { useMutationWithToast } from '@/lib/useMutationWithToast'
import { useToast } from '@/components/ui/Toast'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import type { Bill } from '@/types'

/** Thin composition over the existing presigned document-upload triad - proof
 * documents are stored as ordinary Documents (doc_type: 'bill_proof'), not a
 * parallel storage flow, then linked to the bill via the returned document_id. */
export function BillProofUploadDialog({
  open,
  onClose,
  bill,
}: {
  open: boolean
  onClose: () => void
  bill: Bill
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)

  const mutation = useMutationWithToast({
    mutationFn: async () => {
      if (!file) throw new Error('Choose a file first.')
      const res = await createUploadUrl({
        case_id: bill.case_id,
        title: `Payment proof — ${file.name}`,
        doc_type: 'bill_proof',
        filename: file.name,
        mime_type: file.type || 'application/octet-stream',
        file_size_bytes: file.size,
      })
      await uploadFileBytes(res.upload_url, file)
      await confirmUpload(res.document_id, crypto.randomUUID())
      return uploadBillProof(bill.id, res.document_id)
    },
    onSuccess: () => {
      invalidateCaseScopes(queryClient)
      queryClient.invalidateQueries({ queryKey: qk.billQueue })
      queryClient.invalidateQueries({ queryKey: qk.billDetail(bill.id) })
      toast('Proof uploaded — awaiting approval.', 'success')
      setFile(null)
      onClose()
    },
    errorFallback: (err) => (err as Error).message,
  })

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Upload payment proof"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="bill-proof-upload-form"
            loading={mutation.isPending}
            disabled={!file}
          >
            Upload
          </Button>
        </>
      }
    >
      <form
        id="bill-proof-upload-form"
        onSubmit={(e: FormEvent) => {
          e.preventDefault()
          mutation.mutate()
        }}
      >
        <Field label="Proof of payment" required>
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
              <span className="text-sm text-ink-muted">Click to choose a file</span>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </Field>
      </form>
    </Dialog>
  )
}
