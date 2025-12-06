const CACHE_NAME = 'fuel-app-cache-v3';
const URLS_TO_CACHE = [
  './',
  './index.html',           // トラック用ランチャー or メイン
  './truck.html',           // トラック燃費
  './cub.html',             // カブ燃費
  './manifest.webmanifest', // 既存ランチャー
  './cub-manifest.webmanifest'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(URLS_TO_CACHE))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    )
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(res => res || fetch(event.request))
  );
});
