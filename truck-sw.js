self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('truck-cache').then((cache) => {
      return cache.addAll([
        './',
        './truck.html',
        './truck-manifest.webmanifest',
        './truck-sw.js'
      ]);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});
