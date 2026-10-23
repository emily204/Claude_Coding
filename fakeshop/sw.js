const CACHE = "pretendpay-v12";
const FILES = ["./", "index.html", "styles.css", "app.js", "products.js", "manifest.json", "icon.svg", "tax.js", "gate.js", "catalog-core.mjs", "catalog-codec.mjs"];
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  // Catalog polls must reach the current deployment; keep the last in-memory catalog offline.
  if (new URL(e.request.url).pathname.endsWith("/data/catalog.json") || new URL(e.request.url).pathname.endsWith("/data/catalog-status.json")) return;
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok && new URL(e.request.url).origin === location.origin) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request)));
});
