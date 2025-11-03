/**
 * Enhanced Service Worker - Offline-First Menu Viewing
 * Caches menu data and images for offline access
 */

const CACHE_VERSION = "servio-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;
const MENU_CACHE = `${CACHE_VERSION}-menu`;

// Assets to cache immediately on install
const STATIC_ASSETS = [
  "/",
  "/offline",
  "/manifest.json",
  "/favicon.png",
];

// Install event - cache static assets
self.addEventListener("install", (event) => {
  console.log("[SW] Installing service worker...");

  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        console.log("[SW] Caching static assets");
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log("[SW] Service worker installed successfully");
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating service worker...");

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName.startsWith("servio-") && !cacheName.startsWith(CACHE_VERSION)) {
              console.log("[SW] Deleting old cache:", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log("[SW] Service worker activated");
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // Handle API requests (menu data)
  if (url.pathname.startsWith("/api/menu/")) {
    event.respondWith(handleMenuRequest(request));
    return;
  }

  // Handle images
  if (request.destination === "image" || url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
    event.respondWith(handleImageRequest(request));
    return;
  }

  // Handle static assets
  if (STATIC_ASSETS.some((asset) => url.pathname === asset)) {
    event.respondWith(handleStaticRequest(request));
    return;
  }

  // Handle dynamic content
  event.respondWith(handleDynamicRequest(request));
});

/**
 * Handle menu API requests - cache for offline access
 */
async function handleMenuRequest(request) {
  try {
    // Try network first for fresh data
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      // Cache successful response
      const cache = await caches.open(MENU_CACHE);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }

    // Network failed - try cache
    return (await caches.match(request)) || networkResponse;
  } catch (error) {
    // Network error - return cached version
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      console.log("[SW] Serving cached menu (offline mode)");
      return cachedResponse;
    }

    // No cache - return offline page
    return new Response(
      JSON.stringify({
        error: "Offline",
        message: "Menu data not available offline",
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

/**
 * Handle image requests - aggressive caching
 */
async function handleImageRequest(request) {
  try {
    // Try cache first for images
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    // Not in cache - fetch from network
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      // Cache image for offline access
      const cache = await caches.open(IMAGE_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // Return placeholder image if offline
    return new Response(
      '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect fill="#f3f4f6" width="300" height="300"/><text x="50%" y="50%" text-anchor="middle" fill="#9ca3af">Offline</text></svg>',
      {
        headers: { "Content-Type": "image/svg+xml" },
      }
    );
  }
}

/**
 * Handle static asset requests - cache first
 */
async function handleStaticRequest(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (error) {
    return new Response("Offline", { status: 503 });
  }
}

/**
 * Handle dynamic requests - network first, cache fallback
 */
async function handleDynamicRequest(request) {
  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    return cachedResponse || new Response("Offline", { status: 503 });
  }
}

// Message handler for cache management
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "CLEAR_CACHE") {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
      })
    );
  }

  if (event.data && event.data.type === "CACHE_MENU") {
    event.waitUntil(
      caches.open(MENU_CACHE).then((cache) => {
        return cache.put(event.data.url, new Response(JSON.stringify(event.data.data)));
      })
    );
  }
});

