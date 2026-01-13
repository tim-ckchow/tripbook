const CACHE_NAME = 'tripbook-v3';
const urlsToCache = [
  '/',
  '/index.html',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap'
];

self.addEventListener('install', (event) => {
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // Fallback: if caching fails, app still loads from network
        return cache.addAll(urlsToCache).catch((err) => console.error("Cache failed", err));
      })
  );
});

self.addEventListener('activate', (event) => {
  // Clean up old caches (e.g. v1, v2) to ensure users get fresh files
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Tell the active service worker to take control of the page immediately
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // CRITICAL: Do not intercept Firebase or Google API requests.
  // Letting the browser handle these directly ensures the correct 'Referer' 
  // headers are sent for API Key restrictions and Auth validation.
  if (url.hostname.includes('googleapis.com') || 
      url.hostname.includes('firebase') ||
      url.hostname.includes('firestore')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});