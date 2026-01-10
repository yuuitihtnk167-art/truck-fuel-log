self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('truck-cache').then((cache) => {
      return cache.addAll([
        './',            // トップページ
        './truck.html',  // メインHTML
        './truck.css',   // スタイル
        './truck.js'     // JavaScript
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
