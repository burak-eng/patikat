// Oyunu internetsiz calistirmak icin dosyalari onbellege alir.
// Internet varsa yeni surumu getirir (en fazla 1.5 sn bekler), yoksa onbellekten acar.
const CACHE = 'patikat-v12';
const FILES = [
  './', './index.html', './style.css', './game.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
  ...['miyav1', 'miyav2', 'miyav3', 'miyav4', 'mirlama', 'havlama', 'yemek1', 'yemek2', 'yemek3'].map((n) => `./sounds/${n}.mp3`),
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/api/')) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const network = fetch(e.request).then((res) => {
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    });
    const cached = await cache.match(e.request, { ignoreSearch: true });
    if (!cached) return network;
    const timeout = new Promise((resolve) => setTimeout(() => resolve(cached), 1500));
    return Promise.race([network.catch(() => cached), timeout]);
  })());
});
