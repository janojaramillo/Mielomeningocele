/* CDSS Mielomeningocele — service worker
   Cambie VERSION cada vez que suba un index.html nuevo a GitHub. */
const VERSION = 'mmc-v1.0.0';
const CORE = ['./', './index.html'];
const FONT_CACHE = 'mmc-fonts';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => Promise.all(CORE.map((u) =>
        fetch(new Request(u, { cache: 'reload' }))
          .then((r) => (r && r.ok) ? c.put(u, r) : null)
          .catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((k) => k !== VERSION && k !== FONT_CACHE)
        .map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Red con límite de tiempo: si la red tarda o falla, responde la caché (evita "se queda cargando").
function networkWithTimeout(req, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(req).then((r) => { clearTimeout(t); resolve(r); }, (err) => { clearTimeout(t); reject(err); });
  });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Navegación (abrir la app): red rápida (3 s) → caché → index.html en caché
  if (req.mode === 'navigate') {
    e.respondWith(
      networkWithTimeout(req, 3000)
        .then((r) => {
          if (r && r.ok) {
            const copy = r.clone();
            caches.open(VERSION).then((c) => c.put('./index.html', copy));
          }
          return r;
        })
        .catch(() => caches.match('./index.html', { ignoreSearch: true })
          .then((m) => m || caches.match('./', { ignoreSearch: true })))
    );
    return;
  }

  // Tipografías de Google: caché primero, actualización en segundo plano
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(FONT_CACHE).then((c) => c.match(req).then((hit) => {
        const net = fetch(req).then((r) => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; })
          .catch(() => hit);
        return hit || net;
      }))
    );
    return;
  }

  // Mismo origen: caché primero, luego red
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((r) => {
        if (r && r.ok) { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return r;
      }).catch(() => caches.match('./index.html')))
    );
  }
});
