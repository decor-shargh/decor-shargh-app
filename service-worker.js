const CACHE_NAME = 'decor-shargh-v18-1-20260930-pwa-resume-nav-fix';
const PREVIOUS_PROBLEM_CACHE = 'decor-shargh-v18-20260930-unified-contract-views-outputs';
const APP_VERSION = '18.1.0';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css?v=181',
  './app.js?v=181',
  './manifest.webmanifest?v=181',
  './brand-ui.webp?v=181',
  './icon-192.png?v=181',
  './icon-512.png?v=181',
  './apple-touch-icon.png?v=181',
  './version.json'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', event => {
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    const upgradingFromV18=keys.includes(PREVIOUS_PROBLEM_CACHE);
    await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
    const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of clients){
      try{client.postMessage({type:'APP_UPDATED',version:APP_VERSION});}catch{}
      // One-time migration from the V18 cache issue: force the already-open/restored
      // standalone window to request the fresh shell. Future builds use controllerchange.
      if(upgradingFromV18){
        try{await client.navigate(client.url);}catch{}
      }
    }
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isCritical = request.mode === 'navigate' || /(?:index\.html|app\.js|styles\.css|version\.json|service-worker\.js)$/.test(url.pathname);
  if (isCritical) {
    event.respondWith(
      fetch(new Request(request, {cache:'no-store'}))
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
