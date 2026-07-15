import type { Notification } from '@/types'
import { del, get, patch, post } from './client'

export function listNotifications(): Promise<Notification[]> {
  return get<Notification[]>('/notifications')
}

export function markNotificationRead(notificationId: string): Promise<Notification> {
  return patch<Notification>(`/notifications/${notificationId}/read`)
}

export function deleteNotification(notificationId: string): Promise<void> {
  return del<void>(`/notifications/${notificationId}`)
}

export function clearAllNotifications(): Promise<void> {
  return del<void>('/notifications')
}

export function getPushPublicKey(): Promise<{ public_key: string }> {
  return get<{ public_key: string }>('/notifications/push-public-key')
}

export function subscribePush(subscription: PushSubscriptionJSON): Promise<void> {
  return post<void>('/notifications/push-subscribe', {
    endpoint: subscription.endpoint,
    p256dh: subscription.keys?.p256dh,
    auth: subscription.keys?.auth,
  })
}

export function unsubscribePush(endpoint: string): Promise<void> {
  return del<void>(`/notifications/push-subscribe?endpoint=${encodeURIComponent(endpoint)}`)
}
