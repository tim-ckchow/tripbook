const CACHE_NAME = 'tripbook-v9';
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
  'https://esm.sh/lucide-react@^0.561.0',
  'https://api.iconify.design/noto:airplane.svg'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching critical assets');
      // We use map/catch here to ensure one failure (like a temp CDN glitch) doesn't stop the whole installation
      return Promise.all(
        urlsToCache.map(url => 
            cache.add(url).catch(err => console.error(`[SW] Failed to cache ${url}:`, err))
        )
      );
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
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. IGNORE: Firebase API calls must go to network (auth/firestore)
  if (url.hostname.includes('googleapis.com') || 
      url.hostname.includes('firebase') ||
      url.hostname.includes('firestore')) {
    return;
  }

  // 2. NAVIGATION: Cache-First with Network Update (Stale-While-Revalidate logic for HTML)
  // This ensures we always have *something* to show, but try to update it if online.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then((cached) => {
        // Even if we have a cache, try to fetch network to update it for next time
        const networkFetch = fetch(event.request)
          .then((response) => {
            // Only cache valid responses
            if (response && response.status === 200 && response.type === 'basic') {
                const responseToCache = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                    // Also update the root key just in case
                    if (event.request.url.endsWith('/')) {
                        cache.put('/index.html', responseToCache.clone());
                    }
                });
            }
            return response;
          })
          .catch(() => {
             // If network fails, we rely purely on the cached version we found earlier
             // If no cache earlier, we fall through to the final return
          });

        return cached || networkFetch;
      })
    );
    return;
  }

  // 3. ASSETS: Stale-While-Revalidate
  // We explicitly whitelist the CDNs we use to ensure their chunks are cached
  const isExternalAsset = 
      url.hostname.includes('esm.sh') || 
      url.hostname.includes('cdn.tailwindcss.com') ||
      url.hostname.includes('iconify.design') ||
      url.hostname.includes('fonts.gstatic.com') ||
      url.hostname.includes('fonts.googleapis.com');
  
  const isLocalAsset = url.origin === self.location.origin;

  if (isLocalAsset || isExternalAsset) {
      event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
          // If in cache, return it
          if (cachedResponse) {
            // OPTIONAL: Update in background if you want "fresh" assets every time
            // For libraries like React, we usually trust the cache, but for local files we update.
            if (isLocalAsset) {
                fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
                    }
                }).catch(() => {});
            }
            return cachedResponse;
          }
    
          // Not in cache, fetch it and cache it
          return fetch(event.request)
            .then((networkResponse) => {
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && networkResponse.type !== 'cors') {
                  return networkResponse;
                }
    
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(event.request, responseToCache);
                });
    
                return networkResponse;
            })
            .catch(() => {
                // Return nothing (image placeholder could go here)
            });
        })
      );
  }
});
