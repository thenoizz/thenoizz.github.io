const CACHE_NAME = 'paslaru-v9';
const ASSETS = [
  '/',
  '/index.html',
  '/404.html',
  '/manifest.json',
  '/css/crt.css',
  '/js/crt.js',
  '/favicon.ico',
  '/favicon.svg',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/css/font-awesome.min.css',
  '/fonts/fontawesome-webfont.woff2',
  '/fonts/fontawesome-webfont.woff',
  '/fonts/fontawesome-webfont.ttf'
];

// Install - cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        // Cache new requests
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      });
    }).catch(() => {
      // Offline fallback
      return caches.match('/');
    })
  );
});
