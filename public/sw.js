// Web Push service worker. Shows an OS notification on `push` and focuses/opens the
// right in-app page on click - kept as a plain script (not a module) since Notification
// event listeners must be registered synchronously at the top level.

// Take over immediately on update instead of waiting for every open tab to close -
// during active development a stale SW silently keeps running old logic otherwise.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

function resourceLink(eventType, payload) {
  switch (eventType) {
    case 'notification.case_reassigned':
    case 'notification.hearing_reminder':
      return payload && payload.case_id ? '/cases/' + payload.case_id : '/dashboard'
    case 'notification.case_comment_added':
    case 'notification.case_comment_mention':
    case 'notification.case_comment_reply':
      return payload && payload.case_id ? '/cases/' + payload.case_id + '/thread' : '/dashboard'
    case 'notification.bill_comment_added':
    case 'notification.bill_comment_mention':
    case 'notification.bill_comment_reply':
      return payload && payload.bill_id ? '/bills/' + payload.bill_id + '/thread' : '/dashboard'
    case 'notification.document_uploaded':
    case 'notification.document_quarantined':
      return '/documents'
    default:
      return '/notifications'
  }
}

self.addEventListener('push', (event) => {
  if (!event.data) return
  const data = event.data.json()
  const link = resourceLink(data.event_type, data.payload)
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // `focused` means the window actually has OS-level focus right now - unlike
      // visibilityState, which is true for a tab that's merely open/active even
      // while the whole browser window is in the background. Only skip the OS
      // popup when the user is genuinely looking at the app.
      const focusedClient = clients.find((c) => c.focused)
      if (focusedClient) {
        focusedClient.postMessage({ type: 'push-notification', title: data.title, link })
        return undefined
      }
      return self.registration.showNotification(data.title || 'NyayOps', {
        body: data.title,
        icon: '/favicon.svg',
        data: { link },
      })
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const link = event.notification.data && event.notification.data.link
  if (!link) return
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(link)
          return client.focus()
        }
      }
      return self.clients.openWindow(link)
    }),
  )
})
