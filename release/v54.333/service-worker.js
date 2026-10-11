// RSD & 含量计算器 — Service Worker
// v54.333 PWA 离线支持（每次发布 v54.30x 都更新：CACHE_VERSION + PRECACHE_URLS + fallback URL）
//
// 策略：
// - HTML / manifest → network-first, fallback to cache（保证更新生效，离线可用）
// - CDN 静态资源（chart.js / xlsx / html2pdf）→ cache-first, stale-while-revalidate（带版本号，永久有效）
// - Supabase API（*.supabase.co / /rest/v1 / /auth/v1）→ network-only（不缓存认证/数据请求）
// - 其他跨域资源 → stale-while-revalidate

const CACHE_VERSION = 'v54.333-1';
const STATIC_CACHE = `rsd-calc-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `rsd-calc-runtime-${CACHE_VERSION}`;

// 预缓存：HTML + manifest + PNG 图标 + 4 个 CDN 库
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './RSD & 含量计算器_流动相版_v54.333.html',
  'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.2/dist/html2pdf.bundle.min.js'
];

// 安装：预缓存关键资源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        // addAll 是 all-or-nothing；单个 CDN 失败会让整个 install 失败
        // 用 individual add 兜底，失败仅 console 警告不阻断
        return Promise.allSettled(
          PRECACHE_URLS.map(url => cache.add(url).catch(err => {
            console.warn('[SW] precache failed:', url, err);
          }))
        );
      })
      .then(() => self.skipWaiting())
  );
});

// 激活：清理旧版本缓存
self.addEventListener('activate', event => {
  const keep = new Set([STATIC_CACHE, RUNTIME_CACHE]);
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.filter(n => !keep.has(n)).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// 判断是否走 network-only（Supabase / 第三方 API）
const NETWORK_ONLY_HOST_RE = /(\.supabase\.co|supabase\.io)/i
function isNetworkOnly(url) {
  return NETWORK_ONLY_HOST_RE.test(url.hostname) ||
         url.pathname.startsWith('/rest/v1') ||
         url.pathname.startsWith('/auth/v1') ||
         url.pathname.startsWith('/storage/v1') ||
         url.pathname.startsWith('/functions/v1');
}

// 判断是否走 cache-first（HTML / manifest）
const APP_HTML_PATTERN = /\.(html?|json|svg)$/i
function isAppShell(url) {
  return url.origin === self.location.origin &&
         (url.pathname.endsWith('.html') ||
          url.pathname.endsWith('.json') ||
          url.pathname === '/' ||
          url.pathname.endsWith('/manifest.json'));
}

// 拦截 fetch
self.addEventListener('fetch', event => {
  const { request } = event;

  // 仅处理 GET（POST/PUT 用于云同步、不能缓存）
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Network-only：认证/数据/第三方 API
  if (isNetworkOnly(url)) {
    event.respondWith(fetch(request).catch(() => new Response(JSON.stringify({ error: 'offline' }), {
      status: 503, headers: { 'Content-Type': 'application/json' }
    })));
    return;
  }

  // App shell (HTML/manifest)：network-first → cache fallback
  if (isAppShell(url)) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then(c => c.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request).then(c => c || caches.match('./RSD & 含量计算器_流动相版_v54.333.html')))
    );
    return;
  }

  // 静态资源（CDN / 图片 / 字体）：cache-first → stale-while-revalidate
  event.respondWith(
    caches.match(request).then(cached => {
      const fetchAndUpdate = fetch(request)
        .then(response => {
          if (response && response.ok && (response.type === 'basic' || response.type === 'cors')) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then(c => c.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetchAndUpdate;
    })
  );
});

// 消息：允许页面触发 skipWaiting（强制激活新版本）
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});