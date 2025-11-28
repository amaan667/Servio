/**
 * Service Worker for Offline Support
 * Caches critical pages and assets for offline access
 */

const CACHE_NAME = 'servio-v1';
const OFFLINE_PAGE = '/offline';
// Only cache pages that definitely exist and are accessible
const CRITICAL_PAGES = [
  '/',
  '/sign-in',
  '/help',
  '/offline',
];

// Install event - cache critical assets
// Use individual cache.add() calls with error handling so failures don't block installation
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cache each page individually, ignoring failures
      const cachePromises = CRITICAL_PAGES.map(async (page) => {
        try {
          await cache.add(new Request(page, { cache: 'reload' }));
        } catch (error) {
          // Silently fail - don't block service worker installation
          console.warn(`[SW] Failed to cache ${page}:`, error);
        }
      });
      
      // Wait for all cache attempts (even if some fail)
      await Promise.allSettled(cachePromises);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
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

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip API routes (they should use offline queue)
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Skip external resources
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(request).then((response) => {
      // Return cached version if available
      if (response) {
        return response;
      }

      // Try network first, fallback to cache
      return fetch(request)
        .then((response) => {
          // Don't cache if not ok
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          // Cache the response
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });

          return response;
        })
        .catch(() => {
          // Network failed - try to serve offline page for navigation requests
          if (request.mode === 'navigate') {
            return caches.match(OFFLINE_PAGE) || new Response('Offline', { status: 503 });
          }
          // For other requests, return error
          return new Response('Network error', { status: 503 });
        });
    })
  );
});

// Listen for messages from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

