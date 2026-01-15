// Custom Push Notification Handler
// This script is loaded by the main service worker to handle push events

// Handle push events
self.addEventListener('push', function(event) {
  console.log('[SW Push] Push event received:', event);

  let data = {
    title: 'Discount Fence Hub',
    body: 'You have a new notification',
    icon: '/Logo-DF-Transparent.png',
    badge: '/favicon-96x96.png',
    url: '/',
    tag: 'default'
  };

  // Parse push data if available
  if (event.data) {
    try {
      const payload = event.data.json();
      data = {
        title: payload.title || data.title,
        body: payload.body || data.body,
        icon: payload.icon || data.icon,
        badge: payload.badge || data.badge,
        url: payload.url || payload.data?.url || data.url,
        tag: payload.tag || data.tag,
        data: payload.data || {}
      };
    } catch (e) {
      console.error('[SW Push] Error parsing push data:', e);
      data.body = event.data.text();
    }
  }

  console.log('[SW Push] Showing notification:', data);

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: {
      url: data.url,
      ...data.data
    },
    actions: [
      {
        action: 'open',
        title: 'Open'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', function(event) {
  console.log('[SW Push] Notification click:', event.action, event.notification.data);

  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        // Check if there's already a window open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            client.navigate(urlToOpen);
            return;
          }
        }
        // Open new window if none exists
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Handle notification close
self.addEventListener('notificationclose', function(event) {
  console.log('[SW Push] Notification closed:', event.notification.tag);
});

// Log when service worker activates
self.addEventListener('activate', function(event) {
  console.log('[SW Push] Push handler activated');
});

console.log('[SW Push] Push notification handler loaded');
