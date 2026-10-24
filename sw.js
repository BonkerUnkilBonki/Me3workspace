/* M3E Workspace — service worker.
   Keeps the app shell available offline (the notes themselves already live in
   localStorage, so the app is fully usable with no network). Navigations are
   network-first so a new deploy is picked up immediately; static assets are
   cache-first for speed. Bump CACHE when the shell changes. */
const CACHE = 'm3e-shell-v2';
const SHELL = ['./', './index.html', './config.js', './vendor/sync.bundle.js', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;                       /* never touch sync writes */
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;             /* leave cross-origin alone */
  if (url.pathname.indexOf('/kv/') === 0 || url.pathname.indexOf('/doc') === 0 || url.pathname === '/health') return; /* API: never cached */

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (r) {
        const copy = r.clone();
        caches.open(CACHE).then(function (c) { c.put('./index.html', copy); });
        return r;
      }).catch(function () { return caches.match('./index.html'); })
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (r) {
        if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
        return r;
      });
    })
  );
});
