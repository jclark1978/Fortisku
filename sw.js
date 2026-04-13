const CACHE_NAME = "fortisku-cache-v9";
const APP_SHELL = [
  "./",
  "./index.html",
  "./lifecycle/",
  "./ordering-guides/",
  "./asset-reports/",
  "./lab-portal/",
  "./lifecycle.html",
  "./ordering.html",
  "./asset-report.html",
  "./Lab-Portal-Generator.html",
  "./src/features/finder/main.js",
  "./src/features/finder/ui.js",
  "./src/features/finder/bom.js",
  "./src/features/finder/bomExport.js",
  "./src/features/lifecycle/main.js",
  "./src/features/lifecycle/ingest.js",
  "./src/features/lifecycle/search.js",
  "./src/features/lifecycle/storage.js",
  "./src/features/lifecycle/ui.js",
  "./src/features/ordering-guides/main.js",
  "./src/features/ordering-guides/ui.js",
  "./src/features/asset-reports/main.js",
  "./src/features/asset-reports/ui.js",
  "./src/features/asset-reports/workbook.js",
  "./src/shared/ui/theme.js",
  "./src/shared/data/ingest.js",
  "./src/shared/data/search.js",
  "./src/shared/data/storage.js",
  "./src/shared/data/csv.js",
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
