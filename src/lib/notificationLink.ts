import type { Notification } from '@/types'

/** Maps a notification's event_type + payload to the in-app route it's about, so
 * clicking a notification (bell dropdown, notifications page, or a push toast)
 * navigates to its cause instead of doing nothing. Kept in sync with the small,
 * literal copy in public/sw.js, which can't import app modules. */
export function notificationLink(n: Pick<Notification, 'event_type' | 'payload'>): string | null {
  const caseId = n.payload.case_id
  const billId = n.payload.bill_id
  switch (n.event_type) {
    case 'notification.case_reassigned':
    case 'notification.hearing_reminder':
      return typeof caseId === 'string' ? `/cases/${caseId}` : null
    case 'notification.case_comment_added':
    case 'notification.case_comment_mention':
    case 'notification.case_comment_reply':
      return typeof caseId === 'string' ? `/cases/${caseId}/thread` : null
    case 'notification.bill_comment_added':
    case 'notification.bill_comment_mention':
    case 'notification.bill_comment_reply':
      return typeof billId === 'string' ? `/bills/${billId}/thread` : null
    case 'notification.document_uploaded':
    case 'notification.document_quarantined':
      return '/documents'
    default:
      return null
  }
}
