
const CACHE_NAME = "gorrion-automotores-v1";

const APP_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./LogoGA.png",
  "./manifest.json",
  "./icons/logo-app-192x192.png",
  "./icons/logo-app-512x512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all(
        APP_FILES.map(async (file) => {
          try {
            await cache.add(file);
          } catch (error) {
            console.warn("No se pudo guardar en caché:", file);
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
          .filter((key) => key.startsWith("gorrion-automotores-") && key !== CACHE_NAME)
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
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }

        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);

        if (cached) {
          return cached;
        }

        if (request.mode === "navigate") {
          const home = await caches.match("./index.html");

          if (home) {
            return home;
          }
        }

        return new Response("No hay conexión disponible.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      })
  );
});
