// Service worker of the public site. Ships UNENCRYPTED: keep it generic.
// Network-first: every launch with internet gets the newest build, so publishing a new
// version needs no extra "update" step. The cache is only a fallback to open without signal.
// The cached page is the encrypted lock page, so caching it reveals nothing.
const CACHE = "c1"; // bump only if the caching rules below change (old caches get deleted)

// Precache the page: the very first visit isn't controlled by the worker yet, so without
// this the app wouldn't open offline until a second visit. A failure here isn't fatal.
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.add("./")).catch((e) => console.warn("precache:", e)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name !== CACHE) await caches.delete(name);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // Only our own files. Everything else (fonts, P2P broker, YouTube…) goes straight to network.
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      // "no-cache" revalidates with the server so a new build is never hidden by HTTP cache.
      // Fetch by URL, not by `req`: a navigation Request can't be re-sent with an init object.
      const fresh = await fetch(url.href, { cache: "no-cache" });
      if (fresh.ok) await cache.put(req, fresh.clone());
      return fresh;
    } catch (err) {
      const cached = await cache.match(req, { ignoreSearch: true });
      if (cached) return cached;
      throw err; // offline and never cached: the browser shows its normal offline error
    }
  })());
});
