const CACHE = 'fabricbom-v1.0.1e.7-fortisku';

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
  './js/xlsx.mini.min.js',
  './forti-icons/FortiADC-white.svg',
  './forti-icons/FortiAIOps-white.svg',
  './forti-icons/FortiAP-white.svg',
  './forti-icons/FortiAnalyzer-white.svg',
  './forti-icons/FortiAppSec-white.svg',
  './forti-icons/FortiAuthenticator-white.svg',
  './forti-icons/FortiCNAPP-white.svg',
  './forti-icons/FortiClient-white.svg',
  './forti-icons/FortiDDoS-white.svg',
  './forti-icons/FortiDLP-white.svg',
  './forti-icons/FortiDeceptor-white.svg',
  './forti-icons/FortiEDR-white.svg',
  './forti-icons/FortiExtender-white.svg',
  './forti-icons/FortiFlex-white.svg',
  './forti-icons/FortiGate-white.svg',
  './forti-icons/FortiMail-Cloud-white.svg',
  './forti-icons/FortiMail-white.svg',
  './forti-icons/FortiManager-white.svg',
  './forti-icons/FortiMonitor-white.svg',
  './forti-icons/FortiNAC-white.svg',
  './forti-icons/FortiPAM-white.svg',
  './forti-icons/FortiPresence-white.svg',
  './forti-icons/FortiProxy-white.svg',
  './forti-icons/FortiRecon-white.svg',
  './forti-icons/FortiSASE-white.svg',
  './forti-icons/FortiSIEM-white.svg',
  './forti-icons/FortiSOAR-white.svg',
  './forti-icons/FortiSandbox-white.svg',
  './forti-icons/FortiSwitch-white.svg',
  './forti-icons/FortiWeb-white.svg',
  './products/asku.html',
  './products/custom-sku-bomgen.html',
  './products/custom-sku-bomgen-mobile.html',
  './products/fortiadc-bomgen.html',
  './products/fortiaiops-bomgen.html',
  './products/fortianalyzer-bomgen.html',
  './products/fortiap-bomgen.html',
  './products/fortiappsec-bomgen.html',
  './products/fortiauthenticator-bomgen.html',
  './products/forticlient-bomgen.html',
  './products/forticnapp-bomgen.html',
  './products/fortiddos-bomgen.html',
  './products/fortideceptor-bomgen.html',
  './products/fortidlp-bomgen.html',
  './products/fortiedr-bomgen.html',
  './products/fortiextender-bomgen.html',
  './products/fortiflex-bomgen.html',
  './products/fortigate-bomgen.html',
  './products/fortimail-bomgen.html',
  './products/fortimail-workspace-bomgen.html',
  './products/fortimanager-bomgen.html',
  './products/fortimonitor-bomgen.html',
  './products/fortinac-bomgen.html',
  './products/fortipam-bomgen.html',
  './products/fortipresence-bomgen.html',
  './products/fortiproxy-bomgen.html',
  './products/fortirecon-bomgen.html',
  './products/fortisandbox-bomgen.html',
  './products/fortisase-bomgen.html',
  './products/fortisiem-bomgen.html',
  './products/fortisoar-bomgen.html',
  './products/fortiswitch-bomgen.html',
  './products/fortiweb-bomgen.html',
  './products/placeholder-bomgen.html',
  './docs/help-faq.html',
  './docs/screenshots/fabricbom-screenshot-demobom.jpg',
  './docs/screenshots/fabricbom-docs-adding_sku.gif',
  './docs/screenshots/fabricbom-docs-saving_pricing.gif',
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
    fetch(event.request).then(response => {
      if (response && response.status === 200 && response.type === 'basic') {
        const clone = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => {
      return caches.match(event.request).then(cached => {
        if (cached) return cached;
        return caches.match('./index.html');
      });
    })
  );
});
