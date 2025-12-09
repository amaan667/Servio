"use client";

import { useEffect, useState } from "react";
import { WifiOff, RefreshCw } from "lucide-react";
import { getOfflineQueue } from "@/lib/offline-queue";
import { logger } from "@/lib/logger";

interface ServiceWorkerRegistrationProps {
  children: React.ReactNode;
}

export default function ServiceWorkerRegistration({ children }: ServiceWorkerRegistrationProps) {
  // Always enable service worker for offline support. Versioned cache to avoid stale assets.
  const cacheVersion = process.env.NEXT_PUBLIC_SW_CACHE_VERSION || "v-current";

  const [isOnline, setIsOnline] = useState(true);
  const [queueCount, setQueueCount] = useState(0);

  useEffect(() => {
    // Initialize online status - default to true to avoid false offline warnings
    setIsOnline(true);

    // Initialize offline queue (only in browser)
    if (typeof window === "undefined") {
      return;
    }

    const queue = getOfflineQueue();

    // Check queue status periodically
    const updateQueueStatus = () => {
      const status = queue.getQueueStatus();
      setQueueCount(status.count);
    };

    // Check online status
    const handleOnline = async () => {
      // Network online
      setIsOnline(true);
      // Sync queue when coming back online
      await queue.syncQueue();
      updateQueueStatus();
    };
    const handleOffline = () => {
      setIsOnline(false);
      updateQueueStatus();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Double check with a real network request
    const checkConnectivity = async () => {
      try {
        const response = await fetch("/api/auth/health", {
          method: "GET",
          cache: "no-cache",
          signal: AbortSignal.timeout(3000),
        });
        setIsOnline(response.ok);
      } catch {
        // Only set offline if navigator.onLine also says offline
        setIsOnline(navigator.onLine);
      }
    };

    // Check connectivity on mount
    checkConnectivity();
    updateQueueStatus();

    // Update queue status periodically
    const queueInterval = setInterval(updateQueueStatus, 5000);

    // Register service worker for offline support (only if enabled)
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register(`/sw.js?ver=${cacheVersion}`, { scope: "/" })
        .then((registration) => {
          logger.info("[SW] Service worker registered:", registration.scope);
          
          // Check for updates periodically
          setInterval(() => {
            registration.update();
          }, 60000); // Check every minute
        })
        .catch((error) => {
          logger.error("[SW] Service worker registration failed:", error);
        });

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data && event.data.type === "SKIP_WAITING") {
          window.location.reload();
        }
      });
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(queueInterval);
    };
  }, []);

  // const handleUpdate = () => { /* Empty */ };

  return (
    <>
      {children}

      {/* Offline Indicator - Show on dashboard and order pages */}
      {!isOnline &&
        typeof window !== "undefined" &&
        (window.location.pathname.startsWith("/dashboard") ||
          window.location.pathname.startsWith("/order") ||
          window.location.pathname.startsWith("/payment")) && (
          <div className="fixed top-0 left-0 right-0 z-50 bg-orange-500 text-white p-2 text-center text-sm">
            <div className="flex items-center justify-center space-x-2">
              <WifiOff className="h-4 w-4" />
              <span>
                You&apos;re offline. {queueCount > 0 && `${queueCount} operation${queueCount > 1 ? "s" : ""} queued.`}
              </span>
              {queueCount > 0 && isOnline && typeof window !== "undefined" && (
                <button
                  onClick={() => {
                    const queue = getOfflineQueue();
                    queue.syncQueue();
                  }}
                  className="ml-2 underline hover:no-underline flex items-center gap-1"
                >
                  <RefreshCw className="h-3 w-3" />
                  Sync
                </button>
              )}
            </div>
          </div>
        )}

      {/* All update UI removed - updates happen silently in background */}
    </>
  );
}
