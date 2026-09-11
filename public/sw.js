// Hand-written service worker (no build plugin/dependency) -- the app's data
// already lives in localStorage (Zustand), so offline support here just
// means: make sure the page shell (HTML/JS/CSS) is available without a
// network round trip. Bump CACHE_NAME on any change to this file so old
// caches get cleared on the next visit.
//
// Sign-in gate (src/proxy.ts): for a signed-out visitor every app page is a
// redirect to /welcome. A redirect must never be saved as if it were that page
// -- served back offline to a navigation it's a network error, which would
// break offline mode for someone who first visited signed out and signed in
// later. So only a real, non-redirected 200 is ever cached. (Offline, the gate
// itself never runs: this worker answers from cache without asking the server.)
const CACHE_NAME = "trip-planner-shell-v2";
const OFFLINE_ROUTES = ["/", "/calendar", "/itinerary", "/plans", "/catalog"];

const cacheable = (res) => res.ok && !res.redirected;

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        OFFLINE_ROUTES.map((r) =>
          fetch(r)
            .then((res) => (cacheable(res) ? cache.put(r, res) : undefined))
            .catch(() => {})
        )
      )
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase, Travelpayouts, booking sites -- always network
  if (url.pathname.startsWith("/api/")) return; // never serve stale API responses

  // Next's static assets are content-hashed -- identical forever, safe to
  // cache-first without ever re-checking the network.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const res = await fetch(request);
        if (cacheable(res)) cache.put(request, res.clone());
        return res;
      })
    );
    return;
  }

  // Page navigations and everything else: try the network first (so
  // signed-in users always see fresh data when online), fall back to
  // whatever's cached -- and finally the app shell itself -- when offline.
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (cacheable(res)) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return res;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match("/")))
  );
});
