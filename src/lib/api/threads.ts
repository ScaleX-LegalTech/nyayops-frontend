import type { ThreadInboxItem } from '@/types/threads'
import { get, post } from './client'

export function listThreadInbox(): Promise<ThreadInboxItem[]> {
  return get<ThreadInboxItem[]>('/threads/inbox')
}

export function markThreadRead(resourceType: 'case' | 'bill', resourceId: string): Promise<void> {
  return post<void>(`/threads/${resourceType}/${resourceId}/read`)
}
