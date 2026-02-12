/* Service Worker for Fund Messenger PWA */

const CACHE_NAME = 'fm-v1';

// Install - cache essential assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// Push notification received
self.addEventListener('push', (event) => {
  let data = { title: 'Fund Messenger', body: '새로운 알림이 있습니다' };

  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body || data.message || '',
    icon: '/icons/icon.svg',
    badge: '/icons/icon.svg',
    tag: data.tag || 'fm-notification',
    data: {
      url: data.url || '/',
      related_type: data.related_type,
      related_id: data.related_id,
      notification_type: data.notification_type,
    },
    actions: [
      { action: 'open', title: '확인' },
      { action: 'close', title: '닫기' },
    ],
    vibrate: [200, 100, 200],
    requireInteraction: false,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Fund Messenger', options)
  );
});

// Notification click - navigate to relevant page
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') return;

  const data = event.notification.data || {};
  let url = '/';

  if (data.related_type === 'position' && data.related_id) {
    url = `/positions/${data.related_id}`;
  } else if (data.related_type === 'discussion' && data.related_id) {
    url = `/discussions/${data.related_id}`;
  } else if (data.notification_type === 'user_pending_approval') {
    url = '/team';
  } else if (data.url) {
    url = data.url;
  } else {
    url = '/notifications';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing window if available
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open new window
      return clients.openWindow(url);
    })
  );
});
