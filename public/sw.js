const CACHE_NAME = "certeza-habitacional-v2";
const INSPECTION_CACHE = "certeza-inspecciones-v2";

const OFFLINE_URL = "/offline.html";

const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/branding/icon-192.png",
  "/branding/icon-512.png",
  "/branding/logo-gold.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter(
              (cacheName) =>
                cacheName !== CACHE_NAME &&
                cacheName !== INSPECTION_CACHE,
            )
            .map((cacheName) =>
              caches.delete(cacheName),
            ),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const inspectionCache = await caches.open(INSPECTION_CACHE);
        const normalizada = new URL(request.url);
        normalizada.searchParams.delete("ok");
        normalizada.searchParams.delete("error");
        normalizada.searchParams.delete("foco");
        normalizada.hash = "";
        const cacheKey = new Request(normalizada.toString(), {
          method: "GET",
          credentials: "include",
        });

        try {
          const response = await fetch(request);
          if (
            response &&
            response.status === 200 &&
            url.pathname.startsWith("/panel/inspecciones/")
          ) {
            await inspectionCache.put(cacheKey, response.clone());
          }
          return response;
        } catch {
          const cachedInspection =
            (await inspectionCache.match(cacheKey, { ignoreVary: true })) ||
            (await inspectionCache.match(request, { ignoreVary: true }));
          if (cachedInspection) return cachedInspection;

          const appCache = await caches.open(CACHE_NAME);
          return (await appCache.match(OFFLINE_URL)) || Response.error();
        }
      })(),
    );

    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/branding/") ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          return cached;
        }

        return fetch(request).then(
          (response) => {
            if (
              !response ||
              response.status !== 200
            ) {
              return response;
            }

            const responseClone =
              response.clone();

            caches
              .open(CACHE_NAME)
              .then((cache) =>
                cache.put(
                  request,
                  responseClone,
                ),
              );

            return response;
          },
        );
      }),
    );
  }
});

self.addEventListener("message", (event) => {
  if (
    event.data?.type ===
    "SKIP_WAITING"
  ) {
    self.skipWaiting();
  }
});