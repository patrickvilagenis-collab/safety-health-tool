// sw.js — offline app shell with a network-first strategy.
// Network-first means: when online, always fetch the latest from the network
// (so users never get a stale build); when offline, fall back to the cache.

const CACHE = 'sh-tool-v31';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/icon.svg',
  './assets/schindler.svg',
  './assets/hazard-wheel.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/apple-touch-icon.png',
  './css/styles.css',
  './js/app.js',
  './js/install.js',
  './js/db.js',
  './js/store.js',
  './js/utils.js',
  './js/icons.js',
  './js/charts.js',
  './js/checklists.js',
  './js/accidents.js',
  './js/aip.js',
  './js/intel.js',
  './js/ole.js',
  './js/humbleInquiry.js',
  './js/hazardWheel.js',
  './js/filters.js',
  './js/accidentFilters.js',
  './js/sync.js',
  './js/auth.js',
  './js/views/dashboard.js',
  './js/views/visits.js',
  './js/views/visitForm.js',
  './js/views/analysis.js',
  './js/views/actions.js',
  './js/views/settings.js',
  './js/views/accidents.js',
  './js/views/accidentForm.js',
  './js/views/oles.js',
  './js/views/oleForm.js',
  './js/views/intelligence.js',
  './js/views/accimap.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });

// Network-first for same-origin GETs; update the cache on every success and
// fall back to the cached copy only when the network is unavailable.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then((cached) => cached || caches.match('./index.html')))
  );
});
