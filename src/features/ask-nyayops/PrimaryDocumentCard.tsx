import { Link } from 'react-router-dom'
import { ArrowRight, FileText } from 'lucide-react'
import { humanize } from '@/lib/format'
import type { AskNyayOpsSource } from '@/types'

export interface RelatedItem {
  key: string
  /** "Linked case" / "Associated bill" / etc - which kind of relationship
   * this is to the primary document, not the entity's own type label. */
  relationLabel: string
  label: string
  href: string
}

export interface OtherReference {
  key: string
  label: string
  href: string
}

/** The primary result for a document-retrieval turn (document-retrieval UX
 * redesign) - "the assistant found your document," not one of several equal-
 * weight search hits. Modeled on SingleCaseFactCard's card shell, but no
 * `useQuery`: the source object already carries everything needed
 * (title/doc_type/uploaded_by_name from get_case_documents' result), no
 * second fetch. Related entities from the same turn (case/bill/user) render
 * as labeled links underneath, never as competing result cards - see
 * ChatMessageList.tsx's rank==="primary" branch for how this gets chosen
 * over the flat SourceResultCards list. */
export function PrimaryDocumentCard({
  document,
  related,
  otherReferences = [],
  onOpen,
}: {
  document: AskNyayOpsSource
  related: RelatedItem[]
  /** Other sources from the same turn that aren't this document's own linked
   * case/bill (e.g. a second, different case the user also asked about in
   * the same message) - shown as plain neutral links rather than silently
   * dropped, since the reply text may well discuss them even though they
   * have no relationship to this document. Never labeled "Linked"/
   * "Associated" - that would misrepresent a connection that doesn't
   * exist. */
  otherReferences?: OtherReference[]
  onOpen?: () => void
}) {
  return (
    <div className="mt-1.5 flex max-w-sm flex-col gap-2.5 rounded-card border border-border bg-surface p-3.5">
      <div className="flex items-start gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
          <FileText className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{document.label}</p>
          {document.doc_type && (
            <p className="text-xs text-ink-muted">Type: {humanize(document.doc_type)}</p>
          )}
          {document.uploaded_by_name && (
            <p className="text-xs text-ink-muted">Uploaded by: {document.uploaded_by_name}</p>
          )}
        </div>
      </div>

      {onOpen && (
        <button
          type="button"
          onClick={onOpen}
          className="flex items-center justify-center gap-1.5 rounded-control border border-border-strong px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand-strong"
        >
          <FileText className="size-3" /> Open document
        </button>
      )}

      {related.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-border pt-2">
          {related.map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-2 text-xs">
              <div className="min-w-0">
                <p className="text-ink-faint">{item.relationLabel}</p>
                <p className="truncate font-medium text-ink">{item.label}</p>
              </div>
              <Link
                to={item.href}
                className="flex shrink-0 items-center gap-1 rounded-control border border-border px-2 py-1 font-medium text-ink-muted transition-colors hover:border-brand hover:text-brand-strong"
              >
                Open <ArrowRight className="size-3" />
              </Link>
            </div>
          ))}
        </div>
      )}

      {otherReferences.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-border pt-2">
          {otherReferences.map((item) => (
            <Link
              key={item.key}
              to={item.href}
              className="text-xs font-medium text-brand hover:text-brand-strong hover:underline"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
