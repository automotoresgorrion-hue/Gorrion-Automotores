
const CACHE_NAME = "gorrion-automotores-v2";

const APP_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./LogoGA.png",
  "./manifest.json",
  "./manifest-admin.json",
  "./admin.html",
  "./admin.css",
  "./admin.js",
  "./icons/logo-app-192x192.png",
  "./icons/logo-app-512x512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all(
        APP_FILES.map(async (file) => {
          try {
            const response = await fetch(file, { cache: "no-cache" });

            if (response.ok) {
              await cache.put(file, response);
            } else {
              console.warn("Archivo no disponible:", file, response.status);
            }
          } catch (error) {
            console.warn("No se pudo guardar en caché:", file, error);
          }
        })
      );
    })
  );

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith("gorrion-automotores-") &&
              key !== CACHE_NAME
          )
          .map((key) => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (
    request.method !== "GET" ||
    new URL(request.url).origin !== self.location.origin
  ) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, copy).catch(() => {});
          });
        }

        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);

        if (cached) {
          return cached;
        }

        if (request.mode === "navigate") {
          const requestedUrl = new URL(request.url);
          const isAdmin = requestedUrl.pathname.endsWith("/admin.html");

          const fallback = isAdmin
            ? "./admin.html"
            : "./index.html";

          const page = await caches.match(fallback);

          if (page) {
            return page;
          }
        }

        return new Response("No hay conexión disponible.", {
          status: 503,
          headers: {
            "Content-Type": "text/plain; charset=utf-8"
          }
        });
      })
  );
});
