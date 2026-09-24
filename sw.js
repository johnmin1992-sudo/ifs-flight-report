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
//   index.html → NETWORK-FIRST
//     Online:  always fetch latest from server → update cache → serve fresh
//     Offline: network fails → fallback to cache (offline still works)
//
//   Everything else → CACHE-FIRST (fast, offline-capable)
//     Serve from cache immediately, refresh cache in background for next load.

function isAppShell(url) {
  return url.endsWith('/index.html') || url.endsWith('/') || url === self.location.origin + '/';
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  if (isAppShell(e.request.url)) {
    // NETWORK-FIRST: ensures checkForUpdate() + reload always gets fresh HTML
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => caches.match(e.request).then(cached => cached || caches.match('./index.html')))
    );
    return;
  }

  // CACHE-FIRST for all other assets
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
