const CACHE_NAME = 'grupo-3a-erp-sistema-v2';
const APP_ROOT = '/sistema/';
const INDEX_URL = `${APP_ROOT}index.html`;
const APP_SHELL = [
  INDEX_URL,
  `${APP_ROOT}manifest.webmanifest`,
  `${APP_ROOT}assets/logo-grupo-3a.png`,
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

const isHtmlResponse = response =>
  response.ok && (response.headers.get('content-type') || '').toLowerCase().includes('text/html');

const getSafeIndex = async () => {
  const cached = await caches.match(INDEX_URL);
  if (cached && isHtmlResponse(cached)) return cached;

  const response = await fetch(INDEX_URL, {cache: 'no-store'});
  if (isHtmlResponse(response)) {
    const copy = response.clone();
    await caches.open(CACHE_NAME).then(cache => cache.put(INDEX_URL, copy));
    return response;
  }

  return new Response('Documento principal indisponível.', {
    status: 503,
    headers: {'Content-Type': 'text/plain; charset=utf-8'},
  });
};

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(APP_ROOT)) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(async response => {
          if (!isHtmlResponse(response)) return getSafeIndex();
          const copy = response.clone();
          await caches.open(CACHE_NAME).then(cache => cache.put(INDEX_URL, copy));
          return response;
        })
        .catch(() => getSafeIndex()),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        void caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      }
      return response;
    })),
  );
});
