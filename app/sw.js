// Clobber service worker — offline shell + asset cache
// Increment CACHE_VERSION when deploying new app assets.

const CACHE_VERSION = 'clobber-v1';
const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/src/main.js',
  '/src/ble.js',
  '/src/barcode.js',
  '/src/reconcile.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Network-first for the proxy (always want fresh loan data)
  if (event.request.url.includes('workers.dev') || event.request.url.includes('/loans')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first for app shell
  event.respondWith(
    caches.match(event.request).then(cached => cached ?? fetch(event.request))
  );
});
