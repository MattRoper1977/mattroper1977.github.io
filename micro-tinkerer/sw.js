/**
 * Micro-Tinkerer — service worker.
 *
 * The game is ONE self-contained file with zero external references, so the
 * cache is one entry plus the manifest. Nothing here fetches a CDN, a font or
 * an image, and nothing should ever be added that does.
 *
 * CACHE-FIRST, and deliberately so: the game never changes between deploys
 * within a version, and the whole point of the offline claim is that a second
 * load boots with the network gone. A network-first policy would make the
 * offline case the slow, failing path rather than the designed one.
 *
 * skipWaiting is OFF, also deliberately. A worker that seizes control mid-round
 * can swap the document out from under a live game. The new version takes over
 * on the next cold start, which is the only moment at which that is safe.
 *
 * SCOPE: ./ — this worker owns /micro-tinkerer/ and nothing else. The icons it
 * references from the manifest live at /assets/icons/ and are OUTSIDE that
 * scope on purpose: they are needed at install time, not at runtime, so they
 * are not cached here and their absence offline costs nothing.
 */

const VERSION = 'micro-tinkerer-v1.2.0';
const PRECACHE = ['./', './index.html', './manifest.webmanifest'];

self.addEventListener('install', (event) => {
  // No skipWaiting: see the header. The new worker waits for a cold start.
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(PRECACHE))
  );
});

self.addEventListener('activate', (event) => {
  // Drop every cache that is not this version. Versioned names are what make
  // a release actually replace the last one rather than accumulate beside it.
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((n) => n !== VERSION).map((n) => caches.delete(n)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only GET, only this origin. A cache that answers cross-origin requests is
  // answering for services it does not own — the STUN endpoints among them.
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          // Only cache what actually came back whole. Caching an opaque or
          // error response is how a service worker starts serving a 404
          // forever.
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(VERSION).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => {
          // Offline and not in the cache: fall back to the game itself for a
          // navigation, so a deep link or a refresh still boots rather than
          // showing the browser's error page.
          if (req.mode === 'navigate') return caches.match('./index.html');
          return Response.error();
        });
    })
  );
});
