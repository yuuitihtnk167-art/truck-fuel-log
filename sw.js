const CACHE_NAME = 'cub-fuel-cache-v1';
const urlsToCache = [
  './cub.html',
  './icons/cub-icon-192x192.png',
  './icons/cub-icon-512x512.png',
  './manifest.webmanifest',
  './style.css',
  './sw.js',
  './index.html',  // 他のページもキャッシュしたい場合
];

// インストール時にキャッシュを作成
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

// サービスワーカーフェッチイベント
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});

// アップデート時にキャッシュをクリア
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
