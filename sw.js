const CACHE_NAME = "fortisku-cache-v5";
const APP_SHELL = [
  "./",
  "./index.html",
  "./lifecycle.html",
  "./src/main.js",
  "./src/lifecycleMain.js",
  "./src/theme.js",
  "./src/ingest.js",
  "./src/search.js",
  "./src/storage.js",
  "./src/ui.js",
  "./src/lifecycleIngest.js",
  "./src/lifecycleSearch.js",
  "./src/lifecycleStorage.js",
  "./src/lifecycleUi.js",
  "./src/csv.js",
  "./src/bom.js",
  "./src/bomExport.js",
  "./vendor/minisearch.min.js",
  "./vendor/idb-keyval.mjs",
  "./vendor/xlsx.mjs",
  "./sw.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch(() => undefined)
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
            return undefined;
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname === "/" || url.pathname.endsWith("index.html")) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  if (url.pathname.startsWith("/src/")) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  if (url.pathname.startsWith("/vendor/")) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  event.respondWith(cacheFirst(event.request));
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  const response = await fetch(request);
  cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}
