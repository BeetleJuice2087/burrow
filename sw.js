// Burrow's offline copy. Fetches fresh when it can, so a new version shows straight away, and falls back to the last good copy with no signal.
// The page tells it what it loaded (see saves.js), so there's no file list to keep up.
const SHELF = 'burrow-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('message', e => {
  const urls = (e.data && e.data.keep || []).filter(u => new URL(u).origin === location.origin);
  e.waitUntil(caches.open(SHELF).then(c => Promise.all(urls.map(u => fetch(u).then(r => r.ok ? c.put(u, r) : 0).catch(() => 0)))));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(SHELF).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, {ignoreSearch: true}).then(r => r || (e.request.mode === 'navigate' ? caches.match('./') : Response.error()))));
});
