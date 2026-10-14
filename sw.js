const CACHE_NAME = 'fund-pyramid-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/api.js',
  './js/strategy.js',
  './js/storage.js',
  './js/notification.js',
  './js/app.js',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 对于基金估值 API 请求，优先网络请求，不缓存
  if (url.pathname.includes('/mm/newCore/') || url.pathname.includes('/api/fund')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 静态资源优先使用缓存，离线可用
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});
