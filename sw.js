const CACHE_NAME = 'tripbook-v7';
const urlsToCache = [
  '/',
  '/index.html',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',
  '/index.tsx',
  '/manifest.webmanifest',
  // Critical dependencies from import map - must match index.html exactly
  'https://esm.sh/react@^19.2.3',
  'https://esm.sh/react-dom@^19.2.3/client',
  'https://esm.sh/firebase@^12.6.0/compat/app',
  'https://esm.sh/firebase@^12.6.0/compat/auth',
  'https://esm.sh/firebase@^12.6.0/compat/firestore',
  'https://esm.sh/firebase@^12.6.0/compat/storage',
  'https://esm.sh/lucide-react@^0.561.0'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // We use allowAll to ensure one failure doesn't break the whole install, 
        // but for critical files we really want them all.
        // However, esm.sh might have temporary issues, so we try our best.
        // Ideally, we want to fail hard if criticals fail, but let's try to cache all.
        return cache.addAll(urlsToCache).catch((err) => {
             console.error("Failed to cache critical assets", err);
             // We don't throw here to allow the SW to install even if one CDN asset fails,
             // though the app might be broken offline without it.
             // In production, you'd likely want to retry or handle this better.
        });
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
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      // If not in cache, fetch from network
      return fetch(event.request)
        .then((networkResponse) => {
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && networkResponse.type !== 'cors') {
              return networkResponse;
            }

            // Cache heavy libraries (esm.sh) and local files for future
            // Also cache src files if they are requested (module loading)
            if (url.hostname.includes('esm.sh') || url.origin === self.location.origin) {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(event.request, responseToCache);
                });
            }

            return networkResponse;
        })
        .catch((err) => {
            // Network failed and not in cache.
            console.error("Fetch failed (offline) and not in cache:", event.request.url);
        });
    })
  );
});
