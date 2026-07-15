import { getPushPublicKey, subscribePush, unsubscribePush } from '@/lib/api/notifications'

// The browser's push service rejects concurrent subscribe/unsubscribe calls against
// the same registration (surfaces as "Registration failed - push service error").
// This can genuinely happen here: AppShell's background ensureFreshPushSubscription()
// runs on every mount once permission is granted, and permission is a per-origin (not
// per-app-user) browser setting - so it can be mid-flight exactly when the user clicks
// "Enable/Disable" manually. Serialize every push op through one lock.
let pushOperationLock: Promise<unknown> = Promise.resolve()

function withPushLock<T>(operation: () => Promise<T>): Promise<T> {
  const result = pushOperationLock.then(operation, operation)
  pushOperationLock = result.catch(() => undefined)
  return result
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window
}

export async function getPushSubscriptionState(): Promise<'unsupported' | 'subscribed' | 'unsubscribed'> {
  if (!isPushSupported()) return 'unsupported'
  const registration = await navigator.serviceWorker.getRegistration('/sw.js')
  const subscription = await registration?.pushManager.getSubscription()
  return subscription ? 'subscribed' : 'unsubscribed'
}

/** Registers the service worker, requests Notification permission, subscribes to
 * Web Push, and records the subscription with the backend. */
export function enablePushNotifications(): Promise<void> {
  return withPushLock(async () => {
    if (!isPushSupported()) {
      throw new Error('Push notifications are not supported in this browser.')
    }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') throw new Error('Notification permission was not granted.')

    const registration = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    const { public_key: publicKey } = await getPushPublicKey()
    if (!publicKey) throw new Error('Push is not configured on the server yet.')

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    })
    await subscribePush(subscription.toJSON())
  })
}

export function disablePushNotifications(): Promise<void> {
  return withPushLock(async () => {
    const registration = await navigator.serviceWorker.getRegistration('/sw.js')
    const subscription = await registration?.pushManager.getSubscription()
    if (!subscription) return
    await unsubscribePush(subscription.endpoint)
    await subscription.unsubscribe()
  })
}

function sameKey(a: ArrayBuffer | null, b: Uint8Array): boolean {
  if (!a) return false
  const bytes = new Uint8Array(a)
  return bytes.length === b.length && bytes.every((byte, i) => byte === b[i])
}

/** Repairs a subscription left over from a previous VAPID keypair (e.g. after a
 * server key rotation) - the browser subscription silently stops delivering once
 * its applicationServerKey no longer matches the server's, with no error surfaced
 * anywhere. Safe to call anytime permission is already granted; no-ops if the
 * existing subscription already matches the current key. */
export function ensureFreshPushSubscription(): Promise<void> {
  return withPushLock(async () => {
    if (!isPushSupported() || Notification.permission !== 'granted') return

    const registration = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    const { public_key: publicKey } = await getPushPublicKey()
    if (!publicKey) return
    const currentKey = urlBase64ToUint8Array(publicKey)

    const existing = await registration.pushManager.getSubscription()
    if (existing) {
      if (sameKey(existing.options.applicationServerKey, currentKey)) return
      await existing.unsubscribe()
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: currentKey as BufferSource,
    })
    await subscribePush(subscription.toJSON())
  })
}
