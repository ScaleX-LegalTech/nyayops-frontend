/** Shared chat-thread types, reused by both the case thread and the bill thread -
 * see backend ThreadMessageRead (application/schemas/threads.py). */

export interface ThreadCommentAttachment {
  id: string
  title: string
  mime_type: string
  storage_key: string
}

export interface ThreadCommentQuotePreview {
  id: string
  author_id: string
  comment_preview: string
}

export interface ThreadComment {
  id: string
  author_id: string
  /** Null when deleted_at is set - the tombstone blanks content server-side. */
  comment: string | null
  created_at: string
  attachments: ThreadCommentAttachment[]
  reply_to: ThreadCommentQuotePreview | null
  deleted_at: string | null
  /** Only set when someone other than the author deleted it (admin moderation). */
  deleted_by_name: string | null
  deleted_by_access: string | null
  /** Precomputed server-side (author: 15 min; org/branch admin: 1 day). */
  can_delete_for_everyone: boolean
}

/** One row of the unified chat inbox - see backend ThreadInboxItem. */
export interface ThreadInboxItem {
  resource_type: 'case' | 'bill'
  resource_id: string
  title: string
  last_message_preview: string
  last_message_at: string
  last_author_id: string
  unread: boolean
  locked: boolean
}
