// sw.js dosyasının içeriği:

const CACHE_NAME = 'uygulama-cache-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css' // Eğer başka js veya resim dosyaların varsa onları da bu listeye ekleyebilirsin
];

// Uygulama yüklenirken dosyaları hafızaya al
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Çevrimdışı veya hızlı açılış için hafızadaki dosyaları kullan
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});

