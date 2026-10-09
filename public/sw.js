const CACHE_NAME = 'eshop-shell-v2';
const SHELL_ASSETS = ['/manifest.webmanifest', '/icons/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(
      names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  const isAppShell = request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html';
  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response.ok && !isAppShell) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      const cached = await caches.match(request);
      if (cached) return cached;
      throw error;
    }
  })());
});

self.addEventListener('push', (event) => {
  let message = {};
  try {
    message = event.data ? event.data.json() : {};
  } catch {
    message = { title: 'Shop update', body: event.data?.text() || '' };
  }
  event.waitUntil(self.registration.showNotification(
    String(message.title || 'Shop update').slice(0, 80),
    {
      body: String(message.body || '').slice(0, 240),
      data: { url: typeof message.url === 'string' && message.url.startsWith('/') && !message.url.startsWith('//') ? message.url : '/' }
    }
  ));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((client) => client.url.startsWith(self.location.origin));
    if (existing) {
      existing.navigate(target);
      return existing.focus();
    }
    return clients.openWindow(target);
  }));
});
