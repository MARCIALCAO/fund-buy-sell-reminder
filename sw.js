const CACHE_NAME = 'fund-pyramid-v2.11';
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
  // 强制跳过等待状态，使新版 Service Worker 立即接管
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] 清理旧版本缓存:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  // 立即接管所有已打开的客户端标签页
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. 基金行情接口、反代接口与三方数据请求：绝不缓存，纯实时网络请求
  if (
    url.pathname.includes('/mm/newCore/') ||
    url.pathname.includes('/api/fund') ||
    url.hostname.includes('eastmoney.com') ||
    url.hostname.includes('tiantianfunds.com') ||
    url.hostname.includes('allorigins.win')
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 2. 静态页面与脚本资源：采用 Network-First（网络优先）策略
  // 在线时永远从 Cloudflare 拉取最新发布代码并静默更新本地缓存；离线无网时才降级使用本地缓存
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // 网络请求失败（如断网离线），降级使用本地已缓存资源
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
