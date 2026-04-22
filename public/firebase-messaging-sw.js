// ILCDB LearnHub — FCM Service Worker
// NOTE: Replace all PASTE_DIRECTLY values with your actual Firebase project config.
// Firebase config values are PUBLIC and safe to hardcode here.
// Service workers cannot access Next.js process.env — values must be literal.

importScripts('https://www.gstatic.com/firebasejs/10.11.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.11.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "PASTE_DIRECTLY",
  authDomain: "PASTE_DIRECTLY",
  projectId: "PASTE_DIRECTLY",
  storageBucket: "PASTE_DIRECTLY",
  messagingSenderId: "PASTE_DIRECTLY",
  appId: "PASTE_DIRECTLY",
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification ?? {};
  const targetRoute = payload.data?.targetRoute ?? '/learnhub/feed';

  self.registration.showNotification(title ?? 'LearnHub', {
    body: body ?? '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: targetRoute },
    requireInteraction: false,
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? '/learnhub/feed';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
