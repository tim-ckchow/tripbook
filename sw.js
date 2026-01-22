const CACHE_NAME = 'tripbook-v8';
const urlsToCache = [
  '/',
  '/index.html',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',
  '/index.tsx',
  '/manifest.webmanifest',
  // Critical dependencies
  'https://esm.sh/react@^19.2.3',
  'https://esm.sh/react-dom@^19.2.3/client',
  'https://esm.sh/firebase@^12.6.0/compat/app',
  'https://esm.sh/firebase@^12.6.0/compat/auth',
  'https://esm.sh/firebase@^12.6.0/compat/firestore',
  'https://esm.sh/firebase@^12.6.0/compat/storage',
  'https://esm.sh/lucide-react@^0.561.0'
];

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Activate immediately
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching critical assets');
      return cache.addAll(urlsToCache).catch(err => {
          console.error('[SW] Caching failed:', err);
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
            console.log('[SW] Clearing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim(); // Take control of all clients immediately
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. IGNORE: Firebase API calls (Firestore/Auth) must go to network or be handled by Firebase SDK
  if (url.hostname.includes('googleapis.com') || 
      url.hostname.includes('firebase') ||
      url.hostname.includes('firestore')) {
    return;
  }

  // 2. NAVIGATION: Fix "No Internet" screen on reload
  // If the user navigates to any URL (e.g., /trip/123), return index.html from cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/index.html');
      })
    );
    return;
  }

  // 3. ASSETS: Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Return cached response immediately if available
      if (cachedResponse) {
        // Update cache in background for next time
        fetch(event.request).then((networkResponse) => {
             if (networkResponse && networkResponse.status === 200 && (networkResponse.type === 'basic' || networkResponse.type === 'cors')) {
                 const responseToCache = networkResponse.clone();
                 caches.open(CACHE_NAME).then((cache) => {
                     cache.put(event.request, responseToCache);
                 });
             }
        }).catch(() => { /* mute network errors in background */ });
        
        return cachedResponse;
      }

      // If not in cache, fetch from network
      return fetch(event.request)
        .then((networkResponse) => {
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && networkResponse.type !== 'cors') {
              return networkResponse;
            }

            // Cache new assets (esm.sh, images, etc)
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });

            return networkResponse;
        })
        .catch((err) => {
            console.error("[SW] Fetch failed:", event.request.url);
            // Optionally return a fallback image if it was an image request
        });
    })
  );
});
