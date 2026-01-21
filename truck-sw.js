self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('truck-cache-v5').then((cache) => {
      return cache.addAll([
        './',
        './index.html',
        './truck.html',
        './truck-manifest.webmanifest',
        './truck-sw.js'
      ]);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== 'truck-cache-v5')
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});
