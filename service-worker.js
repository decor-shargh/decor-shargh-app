const CACHE_NAME = 'decor-shargh-v13-3-20260927-contract-detail-ux';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css?v=133',
  './app.js?v=133',
  './manifest.webmanifest?v=133',
  './brand-logo.png?v=133',
  './brand-mark.png?v=133',
  './icon-192.png?v=133',
  './icon-512.png?v=133',
  './apple-touch-icon.png?v=133',
  './version.json'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isCritical = request.mode === 'navigate' || /(?:index\.html|app\.js|styles\.css|version\.json)$/.test(url.pathname);
  if (isCritical) {
    event.respondWith(
      fetch(new Request(request, {cache:'reload'}))
        .then(response => {
          if (response && response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
          return response;
        })
        .catch(() => caches.match(request).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(hit => hit || fetch(request).then(response => {
      if (response && response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
      return response;
    }))
  );
});
