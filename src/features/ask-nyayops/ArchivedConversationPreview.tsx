import { useQuery } from '@tanstack/react-query'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { ErrorState, LoadingState } from '@/components/ui/Feedback'
import { getAskNyayOpsConversation } from '@/lib/api/askNyayOps'
import { qk } from '@/lib/queryKeys'
import type { AskNyayOpsMessageRead } from '@/types'
import { ChatMessageList } from './ChatMessageList'
import type { ChatEntry } from './useAskNyayOpsChat'

function noop() {}

/** Read-only mirror of a conversation's messages - pending_comment/
 * pending_action are deliberately dropped even on the last message, since
 * this is a historical preview of an archived request, not a live turn a
 * user should be able to accidentally confirm. */
function toReadOnlyEntries(messages: AskNyayOpsMessageRead[]): ChatEntry[] {
  return messages.map((m) => ({
    id: crypto.randomUUID(),
    role: m.role,
    content: m.content,
    createdAt: m.created_at,
    sources: m.sources,
  }))
}

interface ArchivedConversationPreviewProps {
  conversationId: string
  onClose: () => void
  onRecover: () => void
  recovering: boolean
}

/** Lets a user check what's actually in an archived request before deciding
 * to recover it - opened from the Archived requests dialog's row. */
export function ArchivedConversationPreview({
  conversationId,
  onClose,
  onRecover,
  recovering,
}: ArchivedConversationPreviewProps) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: qk.askNyayOpsConversation(conversationId),
    queryFn: () => getAskNyayOpsConversation(conversationId),
  })

  return (
    <Dialog
      open
      onClose={onClose}
      title={data?.title ?? 'Archived request'}
      description="Read-only preview - recover to continue this conversation."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button variant="secondary" loading={recovering} onClick={onRecover}>
            <RotateCcw className="size-4" /> Recover
          </Button>
        </>
      }
    >
      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <ChatMessageList
          entries={toReadOnlyEntries(data?.messages ?? [])}
          loading={false}
          onResolvePending={noop}
          onSelectSource={noop}
          onRetry={noop}
          emptyState={<p className="text-sm text-ink-muted">No messages.</p>}
        />
      )}
    </Dialog>
  )
}
