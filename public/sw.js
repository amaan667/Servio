/**
 * Service Worker for Offline Support
 * Provides offline functionality and caching
 */

const CACHE_NAME = 'servio-v1';
const CACHE_VERSION = '1';

// Cache URLs that should be cached
const CACHE_URLS = [
  '/',
  '/dashboard',
  '/api/health',
  '/manifest.json',
];

// Cache strategies
const CACHE_STRATEGIES = {
  NETWORK_FIRST: 'network-first',
  CACHE_FIRST: 'cache-first',
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate',
  NETWORK_ONLY: 'network-only',
  CACHE_ONLY: 'cache-only',
};

/**
 * Install event - cache resources
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching app shell');
      return cache.addAll(CACHE_URLS);
    })
  );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      );
    })
  );
});

/**
 * Fetch event - handle requests with caching
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // Skip WebSocket requests
  if (request.headers.get('upgrade') === 'websocket') {
    return;
  }

  // Determine cache strategy based on URL
  const strategy = getCacheStrategy(url);

  switch (strategy) {
    case CACHE_STRATEGIES.NETWORK_FIRST:
      event.respondWith(networkFirst(request));
      break;
    case CACHE_STRATEGIES.CACHE_FIRST:
      event.respondWith(cacheFirst(request));
      break;
    case CACHE_STRATEGIES.STALE_WHILE_REVALIDATE:
      event.respondWith(staleWhileRevalidate(request));
      break;
    case CACHE_STRATEGIES.NETWORK_ONLY:
      event.respondWith(networkOnly(request));
      break;
    case CACHE_STRATEGIES.CACHE_ONLY:
      event.respondWith(cacheOnly(request));
      break;
    default:
      event.respondWith(networkFirst(request));
  }
});

/**
 * Get cache strategy for URL
 */
function getCacheStrategy(url: URL): string {
  const pathname = url.pathname;

  // API requests - network first
  if (pathname.startsWith('/api/')) {
    // Health check and public endpoints can be cached
    if (pathname === '/api/health' || pathname.startsWith('/api/public/')) {
      return CACHE_STRATEGIES.CACHE_FIRST;
    }
    return CACHE_STRATEGIES.NETWORK_ONLY;
  }

  // Static assets - cache first
  if (pathname.startsWith('/_next/') || pathname.startsWith('/images/')) {
    return CACHE_STRATEGIES.CACHE_FIRST;
  }

  // Dashboard pages - stale while revalidate
  if (pathname.startsWith('/dashboard/')) {
    return CACHE_STRATEGIES.STALE_WHILE_REVALIDATE;
  }

  // Default - network first
  return CACHE_STRATEGIES.NETWORK_FIRST;
}

/**
 * Network first strategy
 */
async function networkFirst(request: Request): Promise<Response> {
  try {
    // Try network first
    const networkResponse = await fetch(request);

    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, falling back to cache', error);

    // Fall back to cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline fallback
    return new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}

/**
 * Cache first strategy
 */
async function cacheFirst(request: Request): Promise<Response> {
  // Try cache first
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    console.log('[SW] Cache hit', request.url);
    return cachedResponse;
  }

  console.log('[SW] Cache miss, fetching from network', request.url);

  // Fetch from network
  try {
    const networkResponse = await fetch(request);

    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed', error);

    // Return offline fallback
    return new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}

/**
 * Stale while revalidate strategy
 */
async function staleWhileRevalidate(request: Request): Promise<Response> {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  // Return cached response immediately if available
  if (cachedResponse) {
    console.log('[SW] Returning stale response', request.url);

    // Fetch in background to update cache
    fetch(request).then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse);
      }
    }).catch((error) => {
      console.log('[SW] Background fetch failed', error);
    });

    return cachedResponse;
  }

  // No cached response, fetch from network
  console.log('[SW] No cached response, fetching from network', request.url);

  try {
    const networkResponse = await fetch(request);

    // Cache successful responses
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed', error);

    // Return offline fallback
    return new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}

/**
 * Network only strategy
 */
async function networkOnly(request: Request): Promise<Response> {
  try {
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed', error);

    // Return offline fallback
    return new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}

/**
 * Cache only strategy
 */
async function cacheOnly(request: Request): Promise<Response> {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  // Return offline fallback
  return new Response('Offline', {
    status: 503,
    statusText: 'Service Unavailable',
  });
}

/**
 * Message event - handle messages from clients
 */
self.addEventListener('message', (event) => {
  const { type, data } = event.data;

  switch (type) {
    case 'SKIP_WAITING':
      // Force waiting service worker to activate
      self.skipWaiting();
      break;
    case 'CLEAR_CACHE':
      // Clear all caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      }).then(() => {
        // Notify clients that cache is cleared
        event.ports[0].postMessage({ type: 'CACHE_CLEARED' });
      });
      break;
    case 'CACHE_URLS':
      // Cache specific URLs
      if (Array.isArray(data)) {
        caches.open(CACHE_NAME).then((cache) => {
          return Promise.all(
            data.map((url) => cache.add(new Request(url)))
          );
        }).then(() => {
          // Notify clients that URLs are cached
          event.ports[0].postMessage({ type: 'URLS_CACHED', count: data.length });
        });
      }
      break;
    default:
      console.log('[SW] Unknown message type', type);
  }
});

/**
 * Push event - handle push notifications
 */
self.addEventListener('push', (event) => {
  const data = event.data?.json();

  console.log('[SW] Push notification received', data);

  // Show notification
  const options = {
    body: data.body || 'New notification',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    vibrate: [200, 100, 200],
    data: data,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Servio', options)
  );
});

/**
 * Notification click event - handle notification clicks
 */
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked', event);

  event.notification.close();

  // Open app
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  );
});

/**
 * Sync event - handle background sync
 */
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync', event.tag);

  if (event.tag === 'sync-orders') {
    event.waitUntil(syncOrders());
  }
});

/**
 * Sync orders in background
 */
async function syncOrders() {
  try {
    // Fetch pending orders from IndexedDB
    const pendingOrders = await getPendingOrders();

    // Sync with server
    for (const order of pendingOrders) {
      try {
        const response = await fetch('/api/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(order),
        });

        if (response.ok) {
          // Remove from pending orders
          await removePendingOrder(order.id);
        }
      } catch (error) {
        console.log('[SW] Failed to sync order', order.id, error);
      }
    }
  } catch (error) {
    console.log('[SW] Sync failed', error);
  }
}

/**
 * Get pending orders from IndexedDB
 */
async function getPendingOrders(): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ServioDB', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['pendingOrders'], 'readonly');
      const store = transaction.objectStore('pendingOrders');
      const getRequest = store.getAll();

      getRequest.onsuccess = () => resolve(getRequest.result);
      getRequest.onerror = () => reject(getRequest.error);
    };
  });
}

/**
 * Remove pending order from IndexedDB
 */
async function removePendingOrder(orderId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ServioDB', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['pendingOrders'], 'readwrite');
      const store = transaction.objectStore('pendingOrders');
      const deleteRequest = store.delete(orderId);

      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () => reject(deleteRequest.error);
    };
  });
}

console.log('[SW] Service worker loaded');
