const CACHE = 'fabricbom-v2';

const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './favicon.ico',
  './icons/pwa-192x192.png',
  './icons/pwa-512x512.png',
  './icons/maskable-192x192.png',
  './icons/maskable-512x512.png',
  './icons/apple-touch-icon.png',
  './products/fortigate-bomgen.html',
  './products/fortisase-bomgen.html',
  './products/fortisandbox-bomgen.html',
  './products/fortiadc-bomgen.html',
  './products/fortideceptor-bomgen.html',
  './products/fortiweb-bomgen.html',
  './products/fortiap-bomgen.html',
  './products/fortiswitch-bomgen.html',
  './products/forticlient-bomgen.html',
  './products/fortinac-bomgen.html',
  './products/fortiauthenticator-bomgen.html',
  './products/fortianalyzer-bomgen.html',
  './products/fortimanager-bomgen.html',
  './products/fortiaiops-bomgen.html',
  './products/fortimonitor-bomgen.html',
  './products/fortisiem-bomgen.html',
  './products/fortiflex-bomgen.html',
  './products/fortiedr-bomgen.html',
  './products/fortiappsec-bomgen.html',
  './products/forticnapp-bomgen.html',
  './products/fortidlp-bomgen.html',
  './products/fortiextender-bomgen.html',
  './products/fortimail-bomgen.html',
  './products/fortimail-workspace-bomgen.html',
  './products/fortipresence-bomgen.html',
  './products/fortirecon-bomgen.html',
  './products/custom-sku-bomgen.html',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
