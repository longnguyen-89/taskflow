// Service Worker for CCE-TasksFlow Push Notifications
self.addEventListener('push', function(event) {
  let data = { title: 'CCE - TasksFlow', body: 'Bạn có thông báo mới' };
  try {
    data = event.data.json();
  } catch (e) {
    data.body = event.data ? event.data.text() : 'Thông báo mới';
  }

  const options = {
    body: data.body || data.message || 'Thông báo mới',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'default',
    renotify: true,
    data: {
      url: data.url || '/dashboard',
      taskId: data.taskId,
      proposalId: data.proposalId,
    },
    actions: [
      { action: 'open', title: 'Xem ngay' },
      { action: 'close', title: 'Đóng' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'CCE - TasksFlow', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.action === 'close') return;

  const url = event.notification.data?.url || '/dashboard';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(clients.claim());
});
