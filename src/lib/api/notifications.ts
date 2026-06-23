import type { Notification } from '@/types'
import { get, patch } from './client'

export function listNotifications(): Promise<Notification[]> {
  return get<Notification[]>('/notifications')
}

export function markNotificationRead(notificationId: string): Promise<Notification> {
  return patch<Notification>(`/notifications/${notificationId}/read`)
}
