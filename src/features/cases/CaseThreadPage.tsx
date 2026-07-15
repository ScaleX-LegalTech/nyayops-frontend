import { useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, FileText, MessageSquarePlus, Paperclip, X } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { addCaseComment, getCase } from '@/lib/api/cases'
import { listCaseActivity } from '@/lib/api/audit'
import { confirmUpload, createUploadUrl, loadDocumentBlob, uploadFileBytes } from '@/lib/api/documents'
import { invalidateCaseScopes, qk } from '@/lib/queryKeys'
import { formatDateTime } from '@/lib/format'
import { extractMentionedUserIds } from '@/lib/mentions'
import { ACTION_ICONS, ACTION_LABELS } from '@/lib/caseActivity'
import { useAuth } from '@/auth/AuthContext'
import { useUsers } from '@/lib/useUsers'
import { useCasePeople } from '@/lib/useCasePeople'
import { usePermissions } from '@/lib/usePermissions'
import { useMutationWithToast } from '@/lib/useMutationWithToast'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { MentionTextarea } from '@/components/ui/MentionTextarea'
import { ErrorState, LoadingState } from '@/components/ui/Feedback'
import { DocumentPreviewDialog, type PreviewTarget } from '@/components/ui/DocumentPreviewDialog'

export default function CaseThreadPage() {
  const { caseId = '' } = useParams()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { nameOf: globalNameOf } = useUsers()
  const { people, nameOf: caseNameOf } = useCasePeople(caseId)
  const nameOf = (id: string) => caseNameOf(id) ?? globalNameOf(id)
  const { hasPermission } = usePermissions()
  const { user } = useAuth()

  const [comment, setComment] = useState('')
  const [pendingAttachments, setPendingAttachments] = useState<
    { id: string; title: string; mime_type: string }[]
  >([])
  const attachFileRef = useRef<HTMLInputElement>(null)
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget | null>(null)

  const { data: c, isLoading, isError, error, refetch } = useQuery({
    queryKey: qk.caseDetail(caseId),
    queryFn: () => getCase(caseId),
  })

  const { data: activity } = useQuery({
    queryKey: qk.caseActivity(caseId),
    queryFn: () => listCaseActivity(caseId),
  })

  function invalidate() {
    invalidateCaseScopes(queryClient)
    queryClient.invalidateQueries({ queryKey: qk.caseDetail(caseId) })
    queryClient.invalidateQueries({ queryKey: qk.caseActivity(caseId) })
  }

  const attachMutation = useMutationWithToast({
    mutationFn: async (file: File) => {
      const res = await createUploadUrl({
        case_id: caseId,
        title: file.name,
        doc_type: 'comment_attachment',
        filename: file.name,
        mime_type: file.type || 'application/octet-stream',
        file_size_bytes: file.size,
      })
      await uploadFileBytes(res.upload_url, file)
      await confirmUpload(res.document_id, crypto.randomUUID())
      return { id: res.document_id, title: file.name, mime_type: file.type || 'application/octet-stream' }
    },
    onSuccess: (attachment) => {
      setPendingAttachments((prev) => [...prev, attachment])
    },
    errorFallback: 'Could not attach file.',
  })

  const commentMutation = useMutationWithToast({
    mutationFn: () =>
      addCaseComment(
        caseId,
        comment,
        extractMentionedUserIds(comment, people),
        pendingAttachments.map((a) => a.id),
      ),
    onSuccess: () => {
      invalidate()
      setComment('')
      setPendingAttachments([])
      toast('Comment added.', 'success')
    },
    errorFallback: 'Could not add comment.',
  })

  if (isLoading) return <LoadingState />
  if (isError || !c) return <ErrorState error={error} onRetry={refetch} />

  const currentUserId = user?.sub
  const isAssignee = !!currentUserId && c.assigned_user_ids.includes(currentUserId)
  const isCreator = !!currentUserId && c.created_by === currentUserId
  const canComment = hasPermission('cases', 'comment') || isAssignee || isCreator

  type FeedItem =
    | { kind: 'comment'; ts: string; data: (typeof c)['comments'][number] }
    | { kind: 'activity'; ts: string; data: NonNullable<typeof activity>[number] }

  const feedItems: FeedItem[] = [
    ...c.comments.map((cm): FeedItem => ({ kind: 'comment', ts: cm.created_at, data: cm })),
    ...(activity ?? [])
      .filter((log) => log.action_type !== 'CASE_COMMENT_ADDED')
      .map((log): FeedItem => ({ kind: 'activity', ts: log.occurred_at, data: log })),
  ].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())

  return (
    <div className="animate-rise">
      <Link
        to={`/cases/${caseId}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-brand"
      >
        <ArrowLeft className="size-4" /> {c.title}
      </Link>

      <PageHeader
        title="Activity & comments"
        description={`${c.comments.length} comment${c.comments.length === 1 ? '' : 's'} · ${feedItems.length} event${feedItems.length === 1 ? '' : 's'} total`}
      />

      <div className="mx-auto max-w-3xl space-y-3">
        {feedItems.length === 0 && <p className="text-sm text-ink-muted">No activity yet.</p>}
        {feedItems.map((item) =>
          item.kind === 'comment' ? (
            <div
              key={`comment-${item.data.id}`}
              className="rounded-card border border-border bg-surface px-4 py-3 text-sm text-ink"
            >
              <div className="mb-1.5 flex items-center gap-2 text-xs text-ink-faint">
                <span className="font-medium text-ink-muted">{nameOf(item.data.author_id)}</span>
                <span>·</span>
                <span>{formatDateTime(item.data.created_at)}</span>
              </div>
              {item.data.comment}
              {item.data.attachments.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {item.data.attachments.map((att) => (
                    <li key={att.id}>
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewTarget({
                            load: () => loadDocumentBlob(att.storage_key),
                            mimeType: att.mime_type,
                            title: att.title,
                          })
                        }
                        className="inline-flex items-center gap-1.5 rounded-control border border-border bg-surface-muted px-2 py-1 text-xs text-ink-muted hover:text-ink"
                      >
                        <FileText className="size-3.5" /> {att.title}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            (() => {
              const Icon = ACTION_ICONS[item.data.action_type] ?? FileText
              return (
                <div
                  key={`activity-${item.data.id}`}
                  className="flex items-center gap-3 px-1 py-1 text-sm"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-surface-muted text-ink-muted">
                    <Icon className="size-3.5" />
                  </span>
                  <p className="min-w-0 flex-1 text-ink-muted">
                    <span className="font-medium text-ink">{nameOf(item.data.actor_id)}</span>{' '}
                    {(ACTION_LABELS[item.data.action_type] ?? item.data.action_type).toLowerCase()}
                  </p>
                  <span className="shrink-0 text-xs text-ink-faint">
                    {formatDateTime(item.data.occurred_at)}
                  </span>
                </div>
              )
            })()
          ),
        )}

        {canComment &&
          (c.status === 'closed' ? (
            <p className="text-sm text-ink-muted">This case is closed — comments are locked.</p>
          ) : (
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault()
                if (comment.trim() && !commentMutation.isPending) commentMutation.mutate()
              }}
              className="space-y-2 rounded-card border border-border bg-surface px-4 py-3"
            >
              <MentionTextarea
                placeholder="Add a comment… type @ to mention someone"
                value={comment}
                onChange={setComment}
                people={people}
                rows={2}
              />
              {pendingAttachments.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                  {pendingAttachments.map((att) => (
                    <li
                      key={att.id}
                      className="inline-flex items-center gap-1.5 rounded-control border border-border bg-surface-muted px-2 py-1 text-xs text-ink-muted"
                    >
                      <FileText className="size-3.5" /> {att.title}
                      <button
                        type="button"
                        aria-label={`Remove ${att.title}`}
                        onClick={() =>
                          setPendingAttachments((prev) => prev.filter((a) => a.id !== att.id))
                        }
                        className="text-ink-faint hover:text-danger"
                      >
                        <X className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  loading={attachMutation.isPending}
                  onClick={() => attachFileRef.current?.click()}
                >
                  <Paperclip className="size-4" /> Attach
                </Button>
                <input
                  ref={attachFileRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) attachMutation.mutate(file)
                    e.target.value = ''
                  }}
                />
                <Button
                  type="submit"
                  size="sm"
                  loading={commentMutation.isPending}
                  disabled={!comment.trim() || attachMutation.isPending}
                >
                  <MessageSquarePlus className="size-4" /> Comment
                </Button>
              </div>
            </form>
          ))}
      </div>

      <DocumentPreviewDialog
        open={!!previewTarget}
        onClose={() => setPreviewTarget(null)}
        target={previewTarget}
      />
    </div>
  )
}
