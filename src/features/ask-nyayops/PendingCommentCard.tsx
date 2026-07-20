import { useState } from 'react'
import { Check, Pencil, X } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/auth/AuthContext'
import { addCaseComment } from '@/lib/api/cases'
import { describeAskNyayOpsError, recordAssistantAuditEvent } from '@/lib/api/askNyayOps'
import type { AskNyayOpsPendingComment } from '@/types'

interface PendingCommentCardProps {
  pendingComment: AskNyayOpsPendingComment
  queryText: string
  /** Called once the card is resolved (posted or discarded) so the chat can
   * stop rendering it. */
  onResolved: () => void
}

/** The HITL confirm step: Gemini only ever drafts (see ask-nyayops-service's
 * draft_case_comment tool) - posting happens here, entirely outside the LLM,
 * by calling backend v1's existing, unmodified comment endpoint directly. */
export function PendingCommentCard({ pendingComment, queryText, onResolved }: PendingCommentCardProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [text, setText] = useState(pendingComment.draft_text)
  const [editing, setEditing] = useState(false)
  const [posting, setPosting] = useState(false)

  async function handlePost() {
    setPosting(true)
    try {
      await addCaseComment(pendingComment.case_id, text)
      await recordAssistantAuditEvent({
        action_type: 'ASSISTANT_HITL_APPROVED',
        resource_id: pendingComment.case_id,
        comment: text,
        new_state: {
          case_id: pendingComment.case_id,
          draft_text: pendingComment.draft_text,
          final_text: text,
          query_text: queryText,
          approved_by: user?.sub,
        },
      })
      toast('Comment posted.', 'success')
      onResolved()
    } catch (err) {
      toast(describeAskNyayOpsError(err), 'error')
    } finally {
      setPosting(false)
    }
  }

  return (
    <Card className="animate-message-in mt-2">
      <CardHeader
        title="Draft comment - review before posting"
        description="Ask NyayOps drafted this. Nothing is posted until you confirm."
      />
      <CardBody className="flex flex-col gap-3">
        {editing ? (
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            autoFocus
          />
        ) : (
          <p className="whitespace-pre-wrap text-sm text-ink">{text}</p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onResolved} disabled={posting}>
            <X className="size-4" /> Discard
          </Button>
          {!editing && (
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)} disabled={posting}>
              <Pencil className="size-4" /> Edit
            </Button>
          )}
          <Button size="sm" onClick={handlePost} loading={posting}>
            <Check className="size-4" /> Post comment
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}
