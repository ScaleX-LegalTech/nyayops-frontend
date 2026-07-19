import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowLeft,
  FileText,
  Maximize2,
  Minimize2,
  MoreVertical,
  Paperclip,
  Reply,
  Send,
  Trash2,
  X,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { addCaseComment, deleteCaseComment, getCase } from '@/lib/api/cases'
import { listCaseActivity } from '@/lib/api/audit'
import { confirmUpload, createUploadUrl, loadDocumentBlob, uploadFileBytes } from '@/lib/api/documents'
import { createStreamToken } from '@/lib/api/notifications'
import { API_BASE_URL } from '@/lib/api/client'
import { invalidateCaseScopes, qk } from '@/lib/queryKeys'
import { formatDateTime } from '@/lib/format'
import { extractMentionedUserIds } from '@/lib/mentions'
import { ACTION_ICONS, describeActivity } from '@/lib/caseActivity'
import { PersonAvatar } from '@/components/ui/Avatar'
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
import { useFloatingPanel, useOutsideClose } from '@/components/ui/useFloatingPanel'
import type { CaseComment } from '@/types/cases'

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
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [replyingTo, setReplyingTo] = useState<CaseComment | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data: c, isLoading, isError, error, refetch } = useQuery({
    queryKey: qk.caseDetail(caseId),
    queryFn: () => getCase(caseId),
  })

  const { data: activity } = useQuery({
    queryKey: qk.caseActivity(caseId),
    queryFn: () => listCaseActivity(caseId),
    enabled: !!c,
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
        replyingTo?.id,
      ),
    onSuccess: () => {
      invalidate()
      setComment('')
      setPendingAttachments([])
      setReplyingTo(null)
      toast('Message sent.', 'success')
    },
    errorFallback: 'Could not send message.',
  })

  const deleteMutation = useMutationWithToast({
    mutationFn: ({ commentId, scope }: { commentId: string; scope: 'me' | 'everyone' }) =>
      deleteCaseComment(caseId, commentId, scope),
    onSuccess: () => {
      invalidate()
      toast('Message deleted.', 'success')
    },
    errorFallback: 'Could not delete message.',
  })

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [c?.comments.length, activity?.length])

  // Live updates over a WebSocket, scoped to this one case's thread - the server
  // pushes a payload-free "something changed" ping (never trusted as the payload
  // itself), same trust model as the notifications SSE stream; a real refetch
  // always happens over REST. Reconnects with a freshly minted token on drop,
  // same reasoning as AppShell's notification stream (a stale token in a native
  // retry would just keep 401ing forever).
  useEffect(() => {
    if (!caseId) return
    let cancelled = false
    let socket: WebSocket | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    async function connect() {
      if (cancelled) return
      try {
        const { token } = await createStreamToken()
        if (cancelled) return
        const wsBase = API_BASE_URL.replace(/^http/, 'ws')
        socket = new WebSocket(
          `${wsBase}/review/${caseId}/thread/ws?token=${encodeURIComponent(token)}`,
        )
        socket.onmessage = () => {
          invalidateCaseScopes(queryClient)
          queryClient.invalidateQueries({ queryKey: qk.caseDetail(caseId) })
          queryClient.invalidateQueries({ queryKey: qk.caseActivity(caseId) })
        }
        socket.onerror = () => {
          socket?.close()
        }
        socket.onclose = () => {
          socket = null
          if (!cancelled) retryTimer = setTimeout(connect, 3000)
        }
      } catch {
        if (!cancelled) retryTimer = setTimeout(connect, 5000)
      }
    }
    connect()

    return () => {
      cancelled = true
      socket?.close()
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [caseId, queryClient])

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
      .filter(
        (log) => log.action_type !== 'CASE_COMMENT_ADDED' && log.action_type !== 'CASE_COMMENT_DELETED',
      )
      .map((log): FeedItem => ({ kind: 'activity', ts: log.occurred_at, data: log })),
  ].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())

  return (
    <div
      className={
        isFullscreen
          ? 'fixed inset-x-0 bottom-0 top-16 z-20 flex flex-col bg-surface p-4 lg:left-64'
          : 'animate-rise'
      }
    >
      {!isFullscreen && (
        <>
          <Link
            to={`/cases/${caseId}`}
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-brand"
          >
            <ArrowLeft className="size-4" /> {c.title}
          </Link>

          <PageHeader
            title="Case Thread"
            description={`${c.comments.length} message${c.comments.length === 1 ? '' : 's'} · ${feedItems.length} event${feedItems.length === 1 ? '' : 's'} total`}
            actions={
              <button
                type="button"
                onClick={() => setIsFullscreen(true)}
                aria-label="Full screen"
                className="rounded-control border border-border bg-surface p-2 text-ink-muted hover:text-ink"
              >
                <Maximize2 className="size-4" />
              </button>
            }
          />
        </>
      )}

      <div
        className={
          isFullscreen
            ? 'relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-card border border-border bg-surface-muted/40'
            : 'flex h-[70vh] min-h-[420px] flex-col overflow-hidden rounded-card border border-border bg-surface-muted/40'
        }
      >
        {isFullscreen && (
          <button
            type="button"
            onClick={() => setIsFullscreen(false)}
            aria-label="Exit full screen"
            className="absolute right-3 top-3 z-10 rounded-control border border-border bg-surface p-2 text-ink-muted hover:text-ink"
          >
            <Minimize2 className="size-4" />
          </button>
        )}
        <div ref={scrollRef} className="flex-1 space-y-1 overflow-y-auto px-4 py-4">
          {feedItems.length === 0 && <p className="text-sm text-ink-muted">No activity yet.</p>}
          {feedItems.map((item, i) => {
          if (item.kind === 'activity') {
            const Icon = ACTION_ICONS[item.data.action_type] ?? FileText
            return (
              <div
                key={`activity-${item.data.id}`}
                className="my-2 flex items-center justify-center gap-2 px-1 py-1 text-center text-xs text-ink-faint"
              >
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-muted px-3 py-1">
                  <Icon className="size-3 shrink-0" />
                  <span>
                    <span className="font-medium text-ink-muted">{nameOf(item.data.actor_id)}</span>{' '}
                    {describeActivity(item.data, nameOf)}
                  </span>
                  <span className="text-ink-faint">· {formatDateTime(item.data.occurred_at)}</span>
                </span>
              </div>
            )
          }

          const isOwn = item.data.author_id === currentUserId
          const prevItem = feedItems[i - 1]
          const isGrouped =
            prevItem?.kind === 'comment' && prevItem.data.author_id === item.data.author_id
          const name = nameOf(item.data.author_id)
          const isDeleted = !!item.data.deleted_at

          if (isDeleted) {
            return (
              <div
                key={`comment-${item.data.id}`}
                className={`flex items-end gap-2 ${isOwn ? 'justify-end' : 'justify-start'} ${isGrouped ? 'mt-0.5' : 'mt-3'}`}
              >
                {!isOwn && (
                  <PersonAvatar label={name} size="sm" className={isGrouped ? 'invisible' : ''} />
                )}
                <div
                  title={!isOwn && isGrouped ? name : undefined}
                  className="max-w-[75%] rounded-card border border-dashed border-border px-3.5 py-2 text-sm italic text-ink-faint"
                >
                  {item.data.deleted_by_name
                    ? `This message was deleted by ${item.data.deleted_by_name}${item.data.deleted_by_access ? ` (${item.data.deleted_by_access})` : ''}`
                    : 'This message was deleted'}
                </div>
              </div>
            )
          }

          return (
            <div
              key={`comment-${item.data.id}`}
              className={`group flex items-end gap-2 ${isOwn ? 'justify-end' : 'justify-start'} ${isGrouped ? 'mt-0.5' : 'mt-3'}`}
            >
              {!isOwn && <PersonAvatar label={name} size="sm" className={isGrouped ? 'invisible' : ''} />}
              {isOwn && (
                <CommentMenu
                  canDeleteForEveryone={item.data.can_delete_for_everyone}
                  onReply={() => setReplyingTo(item.data)}
                  onDeleteForMe={() =>
                    deleteMutation.mutate({ commentId: item.data.id, scope: 'me' })
                  }
                  onDeleteForEveryone={() =>
                    deleteMutation.mutate({ commentId: item.data.id, scope: 'everyone' })
                  }
                />
              )}
              <div
                title={!isOwn && isGrouped ? name : undefined}
                className={`max-w-[75%] rounded-card px-3.5 py-2 text-sm ${
                  isOwn
                    ? 'rounded-br-sm bg-brand text-white'
                    : 'rounded-bl-sm border border-border bg-surface text-ink'
                }`}
              >
                {!isGrouped && (
                  <div
                    className={`mb-0.5 text-xs font-medium ${isOwn ? 'text-white/80' : 'text-ink-muted'}`}
                  >
                    {isOwn ? 'You' : name}
                  </div>
                )}
                {item.data.reply_to && (
                  <div
                    className={`mb-1.5 rounded-control border-l-2 px-2 py-1 text-xs ${
                      isOwn
                        ? 'border-white/50 bg-white/10 text-white/80'
                        : 'border-brand/50 bg-surface-muted text-ink-muted'
                    }`}
                  >
                    <div className="font-medium">{nameOf(item.data.reply_to.author_id)}</div>
                    <div className="truncate">{item.data.reply_to.comment_preview}</div>
                  </div>
                )}
                <p className="whitespace-pre-wrap">{item.data.comment}</p>
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
                          className={`inline-flex items-center gap-1.5 rounded-control border px-2 py-1 text-xs ${
                            isOwn
                              ? 'border-white/30 bg-white/10 text-white hover:bg-white/20'
                              : 'border-border bg-surface-muted text-ink-muted hover:text-ink'
                          }`}
                        >
                          <FileText className="size-3.5" /> {att.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div
                  className={`mt-1 text-right text-[10px] ${isOwn ? 'text-white/70' : 'text-ink-faint'}`}
                >
                  {formatDateTime(item.data.created_at)}
                </div>
              </div>
              {!isOwn && (
                <CommentMenu
                  canDeleteForEveryone={item.data.can_delete_for_everyone}
                  onReply={() => setReplyingTo(item.data)}
                  onDeleteForMe={() =>
                    deleteMutation.mutate({ commentId: item.data.id, scope: 'me' })
                  }
                  onDeleteForEveryone={() =>
                    deleteMutation.mutate({ commentId: item.data.id, scope: 'everyone' })
                  }
                />
              )}
            </div>
          )
        })}
        </div>

        {canComment &&
          (c.status === 'closed' ? (
            <p className="border-t border-border bg-surface px-4 py-3 text-sm text-ink-muted">
              This case is closed — the thread is locked.
            </p>
          ) : (
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault()
                if (comment.trim() && !commentMutation.isPending) commentMutation.mutate()
              }}
              className="shrink-0 space-y-2 border-t border-border bg-surface px-4 py-3"
            >
              {replyingTo && (
                <div className="flex items-start gap-2 rounded-control border-l-2 border-brand bg-surface-muted px-3 py-2 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-ink">{nameOf(replyingTo.author_id)}</div>
                    <div className="truncate text-ink-muted">
                      {replyingTo.comment ?? '[deleted message]'}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Cancel reply"
                    onClick={() => setReplyingTo(null)}
                    className="shrink-0 text-ink-faint hover:text-danger"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              )}
              <MentionTextarea
                placeholder="Type a message… @ to mention someone"
                value={comment}
                onChange={setComment}
                people={people}
                rows={1}
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
                  <Send className="size-4" /> Send
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

function CommentMenu({
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
