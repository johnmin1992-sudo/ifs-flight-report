const CACHE = 'ifs-report-v3';
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

// Fetch strategy: cache-first for offline support, but always refresh
// the cache in the background so the NEXT load gets the latest version.
// This means Offline = works instantly from cache.
// Online = also works instantly from cache, while a fresh copy downloads
// silently for next time (the in-app checkForUpdate() handles forcing
// a reload sooner if a newer APP_VERSION is detected).
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
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
      // Serve cache immediately if we have it (fast + offline-capable),
      // otherwise wait for network.
      return cached || networkFetch;
    })
  );
});
