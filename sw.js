const CACHE = 'ifs-report-v5';
const ASSETS = ['./', './index.html'];

// On install: cache the app shell immediately, activate right away
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

// On activate: delete old cache versions
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
//   Other websites (Google Script, GitHub, connection check) -> NOT handled here (always go to network)
//   index.html -> NETWORK-FIRST with 4 s timeout, then fall back to cache (weak signal never blocks the app)
//   Other same-site files -> CACHE-FIRST, refreshed in background

const SHELL_TIMEOUT = 4000;

function isAppShell(url) {
  return url.endsWith('/index.html') || url.endsWith('/') || url === self.location.origin + '/';
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;   // leave cross-site requests alone

  if (isAppShell(e.request.url)) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = (await cache.match(e.request)) || (await cache.match('./index.html'));
      const net = fetch(e.request).then(res => {
        if (res && res.status === 200) cache.put(e.request, res.clone());
        return res;
      });
      if (!cached) return net;                        // first visit: must use network
      const timeout = new Promise(r => setTimeout(() => r(cached), SHELL_TIMEOUT));
      return Promise.race([net.catch(() => cached), timeout]);
    })());
    return;
  }

  // CACHE-FIRST for other same-site assets
  e.respondWith(
    caches.match(e.request).then(cached => {
      const networkFetch = fetch(e.request)
        .then(res => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => cached || caches.match('./index.html'));
      return cached || networkFetch;
    })
  );
});
