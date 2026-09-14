// ADECI26 · service worker: deja la app usable sin señal (programa, speakers, estilos).
// Las llamadas a /api/ nunca se cachean.
const CACHE = 'adeci26-v2';
const SHELL = ['/', '/index.html', '/css/app.css', '/js/app.js', '/data/programa.js', '/data/speakers.js', '/data/comite.js', '/js/firebase-config.js',
  '/img/adeci-logo.jpg', '/img/adox-wordmark.png', '/img/adox-wordmark-white.png', '/img/icon-192.png', '/manifest.webmanifest'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;
  if (url.origin !== location.origin) {
    // fotos y fuentes externas: cache-first suave
    e.respondWith(caches.open(CACHE).then(async c => { const hit = await c.match(e.request); if (hit) return hit; try { const r = await fetch(e.request); if (r.ok) c.put(e.request, r.clone()); return r; } catch { return hit || Response.error(); } }));
    return;
  }
  // propios: network-first con respaldo en cache
  e.respondWith(fetch(e.request).then(r => { if (r.ok) caches.open(CACHE).then(c => c.put(e.request, r.clone())); return r; })
    .catch(() => caches.match(e.request).then(hit => hit || (e.request.mode === 'navigate' ? caches.match('/index.html') : Response.error()))));
});
