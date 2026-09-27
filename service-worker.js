const CACHE_NAME = 'decor-shargh-v4-20260927';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css?v=4',
  './app.js?v=4',
  './manifest.webmanifest?v=4',
  './icon-192.png?v=4',
  './icon-512.png?v=4',
  './apple-touch-icon.png?v=4'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then(hit => hit || caches.match('./index.html')))
  );
});
