const CACHE_NAME = 'tripbook-v4';
const urlsToCache = [
  '/',
  '/index.html',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',
  '/index.tsx',
  '/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache).catch((err) => console.error("Cache failed", err));
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. IGNORE: Firebase API calls (Firestore/Auth) must go to network
  if (url.hostname.includes('googleapis.com') || 
      url.hostname.includes('firebase') ||
      url.hostname.includes('firestore')) {
    return;
  }

  // 2. CACHE STRATEGY: Stale-While-Revalidate
  // This serves the cached version instantly (saving data/time) while fetching updates in background.
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Return cached response immediately if available
      if (cachedResponse) {
        // Optional: Update cache in background for next time (Stale-while-revalidate)
        // For roaming data saving, we can skip this update if cache exists, 
        // but for code updates we usually want it. 
        // Given 'roaming' constraint, we prioritise the cache.
        return cachedResponse;
      }

      // If not in cache, fetch from network
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && networkResponse.type !== 'cors') {
          return networkResponse;
        }

        // Cache heavy libraries (esm.sh) and local files for future
        if (url.hostname.includes('esm.sh') || url.origin === self.location.origin) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
        }

        return networkResponse;
      });
    })
  );
});