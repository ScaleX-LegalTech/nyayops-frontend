import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronDown, Copy, FileText, IndianRupee, Scale, User } from 'lucide-react'
import { DocumentPreviewDialog, type PreviewTarget } from '@/components/ui/DocumentPreviewDialog'
import { NyayOpsMark } from '@/components/ui/NyayOpsMark'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'
import { loadDocumentBlob } from '@/lib/api/documents'
import { MarkdownLite } from '@/lib/markdownLite'
import { EntityResultCard } from './EntityResultCard'
import { PendingCommentCard } from './PendingCommentCard'
import { PendingActionCard } from './PendingActionCard'
import { PrimaryDocumentCard, type OtherReference, type RelatedItem } from './PrimaryDocumentCard'
import { SingleCaseFactCard } from './SingleCaseFactCard'
import type { ChatEntry } from './useAskNyayOpsChat'
import type { AskNyayOpsSource } from '@/types'

/** A turn can take 6-10s (several sequential model calls, no streaming yet) -
 * a static "Thinking…" reads as frozen by ~5s. `realStage`, when set, is the
 * actual current step reported by the backend's tool-calling loop (polled via
 * GET /ask-nyayops/turn-stage/{turnId} - see useAskNyayOpsChat.ts and
 * ask-nyayops-service's agents/stage_reporter.py) - e.g. "Checking the case
 * file…" or "Preparing your answer…". Before the first poll lands (or if
 * staging data never arrives for some reason), this falls back to the same
 * elapsed-time guess as before, so the status text is never blank. */
function ThinkingStatus({ realStage }: { realStage: string | null }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const startedAt = Date.now()
    const timer = setInterval(() => setElapsed((Date.now() - startedAt) / 1000), 500)
    return () => clearInterval(timer)
  }, [])
  const fallbackStage =
    elapsed < 3
      ? 'Thinking…'
      : elapsed < 7
        ? 'Looking that up…'
        : elapsed < 14
          ? 'Pulling the details together…'
          : 'Still working — almost there…'
  return (
    <span className="flex items-center gap-1.5 text-sm text-ink-muted">
      <span className="flex gap-0.5" aria-hidden>
        <span className="size-1 animate-pulse rounded-full bg-brand [animation-delay:0ms]" />
        <span className="size-1 animate-pulse rounded-full bg-brand [animation-delay:150ms]" />
        <span className="size-1 animate-pulse rounded-full bg-brand [animation-delay:300ms]" />
      </span>
      {realStage ?? fallbackStage}
      {elapsed >= 5 && <span className="ml-1 text-xs text-ink-faint">{Math.floor(elapsed)}s</span>}
    </span>
  )
}

const SOURCE_HREF: Record<AskNyayOpsSource['type'], (id: string) => string> = {
  case: (id) => `/cases/${id}`,
  bill: () => '/bills',
  document: () => '/documents',
  user: () => '/admin/users',
}

/** Related-context row(s) for a primary document card (document-retrieval UX
 * redesign). Deliberately built ONLY from the document source's own explicit
 * linked_case_id/label, never from "every other source in the same turn" -
 * a turn can touch a second, unrelated same-named case while resolving the
 * user's reference (e.g. two "Mahesh Kumar" matters), and showing that other
 * case as "linked" was a real bug: co-occurrence in one turn's sources isn't
 * the same as an actual relationship to this document. */
function toRelatedItems(document: AskNyayOpsSource): RelatedItem[] {
  if (!document.linked_case_id) return []
  return [
    {
      key: `case-${document.linked_case_id}`,
      relationLabel: 'Linked case',
      label: document.linked_case_label ?? document.linked_case_id,
      href: SOURCE_HREF.case(document.linked_case_id),
    },
  ]
}

/** Sources from the same turn that are neither the primary document nor its
 * own linked case (e.g. a second, different case also named in the same
 * multi-part message - "latest doc for case A and also case B"). Rendered as
 * plain neutral links rather than silently dropped - the reply text may well
 * discuss them even though they're not "linked" to this document. */
function toOtherReferences(
  document: AskNyayOpsSource,
  allSources: AskNyayOpsSource[],
): OtherReference[] {
  return allSources
    .filter((s) => s !== document && !(s.type === 'case' && s.id === document.linked_case_id))
    .map((s) => ({
      key: `${s.type}-${s.id}`,
      label: s.label,
      href: SOURCE_HREF[s.type](s.id),
    }))
}

/** Only document sources that came from a post-this-change get_case_documents
 * call carry storage_key - older persisted messages fall back to the plain
 * `/documents` link via SOURCE_HREF instead. */
function documentPreviewTarget(source: AskNyayOpsSource): PreviewTarget | null {
  if (source.type !== 'document' || !source.storage_key) return null
  return {
    title: source.label,
    mimeType: source.mime_type ?? null,
    load: () => loadDocumentBlob(source.storage_key as string),
  }
}

const SOURCE_ICON: Record<AskNyayOpsSource['type'], typeof Scale> = {
  case: Scale,
  bill: IndianRupee,
  document: FileText,
  user: User,
}

const SOURCE_TYPE_LABEL: Record<AskNyayOpsSource['type'], string> = {
  case: 'Case records',
  bill: 'Billing records',
  document: 'Documents',
  user: 'Team records',
}

/** Data-provenance footer (redesign doc ask #10) - deliberately NOT a
 * confidence score, which the assistant has no honest way to compute. This is
 * which data types the reply actually drew from, dedup'd by `sources[].type`
 * so "3 matching cases" shows one "Case records" line, not three - clicking
 * expands to the actual `sources[]` labels underneath, which were already
 * fetched but previously only surfaced in the separate result cards. */
function ProvenanceFooter({ sources }: { sources: AskNyayOpsSource[] }) {
  const [expanded, setExpanded] = useState(false)
  const types = Array.from(new Set(sources.map((s) => s.type)))
  return (
    <div className="mt-1.5 text-[0.6875rem] text-ink-faint">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex flex-wrap items-center gap-x-3 gap-y-1 hover:text-ink-muted"
      >
        <span className="font-medium">Based on:</span>
        {types.map((type) => (
          <span key={type} className="flex items-center gap-1">
            <Check className="size-3 text-success" /> {SOURCE_TYPE_LABEL[type]}
          </span>
        ))}
        <ChevronDown className={cn('size-3 transition-transform', expanded && 'rotate-180')} />
      </button>
      {expanded && (
        <ul className="mt-1 space-y-0.5 pl-1">
          {sources.map((source) => (
            <li key={`${source.type}-${source.id}`}>{source.label}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function formatMessageTime(value?: string): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

/** Per-message hover toolbar (copy + timestamp) for assistant turns - both
 * pieces of data already exist (`entry.content`, `entry.createdAt`), this is
 * purely surfacing them. */
function MessageToolbar({ content, createdAt }: { content: string; createdAt?: string }) {
  const { toast } = useToast()
  const time = formatMessageTime(createdAt)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content)
      toast('Copied to clipboard', 'success')
    } catch {
      toast('Could not copy', 'error')
    }
  }

  return (
    <div className="mt-1 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy message"
        title="Copy message"
        className="flex items-center gap-1 rounded-control p-0.5 text-ink-faint hover:bg-surface-muted hover:text-ink"
      >
        <Copy className="size-3" />
      </button>
      {time && <span className="text-[0.6875rem] text-ink-faint">{time}</span>}
    </div>
  )
}

/** Turns a multi-result reply's `sources` into a scannable result-card list
 * instead of a run of inline chips - "4 matching cases found" reads better as
 * a stack of cards than a wrapped line of links. A single source stays an
 * inline chip (see the render call site) since one link doesn't need card
 * weight. Each card offers Select (send the entity back into the chat
 * workflow - see onSelectSource's doc comment) and Open (navigate away) as
 * two distinct actions, never a whole-card link - clicking a disambiguation
 * result used to always navigate away, which broke the workflow the result
 * was surfaced for (e.g. "raise a bill for Mahesh" -> picking a case used to
 * jump to the case page instead of continuing the bill-raising turn). */
function SourceResultCards({
  sources,
  onSelectSource,
  onOpenPreview,
  disabled,
}: {
  sources: AskNyayOpsSource[]
  onSelectSource: (source: AskNyayOpsSource) => void
  onOpenPreview: (target: PreviewTarget) => void
  disabled: boolean
}) {
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <p className="text-xs font-medium text-ink-faint">{sources.length} matching results</p>
      {sources.map((source) => {
        const previewTarget = documentPreviewTarget(source)
        return (
          <EntityResultCard
            key={`${source.type}-${source.id}`}
            source={source}
            icon={SOURCE_ICON[source.type]}
            typeLabel={SOURCE_TYPE_LABEL[source.type]}
            href={SOURCE_HREF[source.type](source.id)}
            onSelect={() => onSelectSource(source)}
            onOpen={previewTarget ? () => onOpenPreview(previewTarget) : undefined}
            disabled={disabled}
          />
        )
      })}
    </div>
  )
}

interface ChatMessageListProps {
  entries: ChatEntry[]
  loading: boolean
  /** Real in-flight stage label from useAskNyayOpsChat's loadingStage - see
   * ThinkingStatus's doc comment. Optional/undefined for any caller that
   * hasn't wired it up yet, same as omitting it. */
  loadingStage?: string | null
  /** `message`, when the resolving card passes one, renders as a synthetic
   * assistant reply right after - see useAskNyayOpsChat.ts's resolvePending. */
  onResolvePending: (entryId: string, message?: string) => void
  /** Select action on a multi-result card (SourceResultCards) - sends the
   * entity's own label back as the next chat turn via sendMessage, so the
   * model resolves it the same way it would a typed follow-up and continues
   * whatever workflow surfaced the results, instead of navigating away. */
  onSelectSource: (source: AskNyayOpsSource) => void
  /** Retries a user turn marked `status: 'failed'` (F-05) - see
   * useAskNyayOpsChat.ts's retryMessage. */
  onRetry: (entryId: string) => void
  /** AskNyayOpsPage already shows the active case's full detail in
   * CaseContextPanel alongside the thread (F-02) - the inline per-message
   * SingleCaseFactCard would just duplicate it there, so that surface passes
   * this true. The launcher popover has no side panel, so it keeps the
   * inline card (the default). */
  hideCaseFactCard?: boolean
  emptyState: ReactNode
}

function AssistantAvatar({ thinking = false }: { thinking?: boolean }) {
  return (
    <div className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
      <NyayOpsMark size={15} animate={thinking} />
    </div>
  )
}

/** The one implementation of rendering a conversation's turns - message
 * bubbles, source links, and the pending_comment/pending_action confirm card
 * on the last assistant turn (implementation plan §7.1). Shared by the full
 * AskNyayOpsPage and the compact AskNyayOpsLauncher panel so they can never
 * visually drift apart.
 *
 * Assistant turns render as plain flowing text (no bubble fill) with the
 * NyayOpsMark avatar carrying the brand identity - user turns keep a filled
 * pill. That asymmetry is deliberate, matching how Gemini/most AI-answer
 * surfaces read: a bubble on both sides looks like SMS, not an answer. */
export function ChatMessageList({
  entries,
  loading,
  loadingStage = null,
  onResolvePending,
  onSelectSource,
  onRetry,
  hideCaseFactCard = false,
  emptyState,
}: ChatMessageListProps) {
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget | null>(null)

  if (entries.length === 0) return <>{emptyState}</>

  return (
    <div className="flex flex-col gap-6">
      {entries.map((entry, index) => {
        const primaryDocs = entry.sources?.filter((s) => s.rank === 'primary') ?? []
        // Exactly one primary document -> render it as the requested result
        // with the rest of the turn's sources as linked context. Two or more
        // is genuine multi-document ambiguity (e.g. two same-titled docs),
        // which still needs the flat disambiguation list below.
        const primaryDoc = primaryDocs.length === 1 ? primaryDocs[0] : null
        const previewTargetForPrimary = primaryDoc ? documentPreviewTarget(primaryDoc) : null
        return (
        <div
          key={entry.id}
          className={cn(
            'group animate-message-in flex gap-3',
            entry.role === 'user' && 'flex-row-reverse',
          )}
        >
          {entry.role === 'user' ? (
            <div className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-muted text-ink-muted">
              <User className="size-3.5" />
            </div>
          ) : (
            <AssistantAvatar />
          )}
          <div className={cn('max-w-[85%] min-w-0', entry.role === 'user' && 'items-end')}>
            {entry.role === 'user' ? (
              <>
                <div className="rounded-card rounded-tr-sm bg-brand px-4 py-2.5 text-sm whitespace-pre-wrap text-white shadow-sm">
                  {entry.content}
                </div>
                {entry.status === 'failed' && (
                  <div className="mt-1 flex items-center justify-end gap-1.5 text-xs text-danger">
                    <span>Couldn&apos;t get a reply</span>
                    <button
                      type="button"
                      onClick={() => onRetry(entry.id)}
                      className="font-medium underline hover:text-danger-strong"
                    >
                      Retry
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-1.5 py-0.5 text-[0.9375rem] leading-relaxed text-ink">
                <MarkdownLite text={entry.content} />
                <MessageToolbar content={entry.content} createdAt={entry.createdAt} />
              </div>
            )}
            {primaryDoc ? (
              <PrimaryDocumentCard
                document={primaryDoc}
                related={toRelatedItems(primaryDoc)}
                otherReferences={toOtherReferences(primaryDoc, entry.sources ?? [])}
                onOpen={
                  previewTargetForPrimary
                    ? () => setPreviewTarget(previewTargetForPrimary)
                    : undefined
                }
              />
            ) : entry.sources && entry.sources.length > 1 ? (
              <SourceResultCards
                sources={entry.sources}
                onSelectSource={onSelectSource}
                onOpenPreview={setPreviewTarget}
                disabled={loading}
              />
            ) : entry.sources &&
              entry.sources.length === 1 &&
              entry.sources[0].type === 'case' &&
              !hideCaseFactCard ? (
              <SingleCaseFactCard caseId={entry.sources[0].id} />
            ) : (
              entry.sources &&
              entry.sources.length === 1 && (
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {entry.sources.map((source) => {
                    const previewTargetForSource = documentPreviewTarget(source)
                    return previewTargetForSource ? (
                      <button
                        key={`${source.type}-${source.id}`}
                        type="button"
                        onClick={() => setPreviewTarget(previewTargetForSource)}
                        className="text-xs font-medium text-brand hover:text-brand-strong hover:underline"
                      >
                        {source.label}
                      </button>
                    ) : (
                      <Link
                        key={`${source.type}-${source.id}`}
                        to={SOURCE_HREF[source.type](source.id)}
                        className="text-xs font-medium text-brand hover:text-brand-strong hover:underline"
                      >
                        {source.label}
                      </Link>
                    )
                  })}
                </div>
              )
            )}
            {!primaryDoc && entry.sources && entry.sources.length > 0 && (
              <ProvenanceFooter sources={entry.sources} />
            )}
            {entry.pendingAction ? (
              <PendingActionCard
                pendingAction={entry.pendingAction}
                onResolved={(message) => onResolvePending(entry.id, message)}
                voiceTranscript={
                  entries[index - 1]?.viaVoice ? entries[index - 1].content : undefined
                }
              />
            ) : (
              entry.pendingComment && (
                <PendingCommentCard
                  pendingComment={entry.pendingComment}
                  queryText={entries[index - 1]?.content ?? ''}
                  viaVoice={entries[index - 1]?.viaVoice ?? false}
                  onResolved={(message) => onResolvePending(entry.id, message)}
                />
              )
            )}
          </div>
        </div>
        )
      })}
      {loading && (
        <div className="animate-message-in flex items-center gap-3">
          <AssistantAvatar thinking />
          <ThinkingStatus realStage={loadingStage} />
        </div>
      )}
      <DocumentPreviewDialog
        open={!!previewTarget}
        onClose={() => setPreviewTarget(null)}
        target={previewTarget}
      />
    </div>
  )
}
