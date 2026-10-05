/* Finantsen Service Worker
 * - Statische Assets (/_next/static, Icons): cache-first
 * - Seiten (Navigationen): network-first, bei Fehlschlag zuletzt geladene Version (Offline-Lesen)
 * - Alle anderen Requests (API-Mutationen, RSC-Fetches) gehen immer direkt ans Netz
 * Beim Abmelden werden alle fs-* Caches gelöscht (siehe clearOfflineCaches).
 */
const STATIC = "fs-static-v1";
const PAGES = "fs-pages-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.addAll([OFFLINE_URL, "/icons/icon-192.png"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("fs-") && k !== STATIC && k !== PAGES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(PAGES);
        try {
          const res = await fetch(req);
          // Nur erfolgreiche, nicht umgeleitete HTML-Seiten cachen (Login-Redirects nicht).
          // Auch keine Seiten mit Einmal-Links im Pfad (Aktivierung, Einladung).
          const noCache = ["/login", "/register", "/join/", "/activate/", "/forgot-password"].some((p) => url.pathname.startsWith(p));
          if (res.ok && !res.redirected && !noCache) {
            cache.put(req, res.clone());
          }
          return res;
        } catch {
          const hit = await cache.match(req);
          if (hit) return hit;
          const offline = await caches.open(STATIC).then((c) => c.match(OFFLINE_URL));
          return offline || Response.error();
        }
      })(),
    );
  }
});

// Web Push: Payload { title, body, url }
self.addEventListener("push", (event) => {
  let data = { title: "Finantsen", body: "", url: "/" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
