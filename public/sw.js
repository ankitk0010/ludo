// Service Worker: handles Web Push notifications for Ludo match invitations
// Registered from LobbyRoom.tsx when user opens the lobby

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Ludo Invitation', body: event.data.text(), roomCode: null };
  }

  const { title = '🎲 Ludo Invitation!', body = 'A friend invited you to play Ludo!', roomCode, icon, badge } = payload;

  const notificationOptions = {
    body,
    icon: icon || '/icons/icon-192x192.png',
    badge: badge || '/icons/badge-72x72.png',
    tag: `ludo-invite-${roomCode || Date.now()}`,
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: { roomCode, url: roomCode ? `/game?mode=room&code=${roomCode}&host=false` : '/' },
    actions: [
      { action: 'join', title: '🎮 Join Game' },
      { action: 'dismiss', title: '❌ Dismiss' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, notificationOptions));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing tab if open
      for (const client of windowClients) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new tab
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
