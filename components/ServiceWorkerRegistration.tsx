"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import { WifiOff, Wifi, RefreshCw } from "lucide-react";
import { getOfflineQueue } from "@/lib/offline-queue";

interface ServiceWorkerRegistrationProps {
  children: React.ReactNode;
}

export default function ServiceWorkerRegistration({ children }: ServiceWorkerRegistrationProps) {
  // Always enable service worker for offline support. Versioned cache to avoid stale assets.
  const envCacheVersion = process.env.NEXT_PUBLIC_SW_CACHE_VERSION;

  const pathname = usePathname();
  const [isOnline, setIsOnline] = useState(true);
  const [queueCount, setQueueCount] = useState(0);
  const unsubscribeConnectionRef = useRef<(() => void) | null>(null);

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

    // Use ConnectionMonitor singleton instead of duplicate health check
    // ConnectionMonitor already handles health checks efficiently
    import("@/lib/connection-monitor")
      .then(({ getConnectionMonitor }) => {
        const connectionMonitor = getConnectionMonitor();
        const connectionState = connectionMonitor.getState();
        setIsOnline(connectionState.isOnline);
        unsubscribeConnectionRef.current = connectionMonitor.subscribe((state) => {
          setIsOnline(state.isOnline);
        });
      })
      .catch(() => {
        // Fallback to navigator.onLine if ConnectionMonitor fails
        setIsOnline(navigator.onLine);
      });

    updateQueueStatus();

    // Update queue status periodically
    const queueInterval = setInterval(updateQueueStatus, 5000);

    // Service worker registration disabled - file not available
    // Unregister any existing service workers to prevent 404 errors
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration
            .unregister()
            .then((success) => {
              if (success) { /* Condition handled */ }
            })
            .catch((_error) => {
              // Service worker registration error handled silently
            });
        }
      });
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(queueInterval);
      if (unsubscribeConnectionRef.current) {
        unsubscribeConnectionRef.current();
        unsubscribeConnectionRef.current = null;
      }
    };
  }, []);

  // const handleUpdate = () => { /* Empty */ };

  const isDashboardRoute = pathname === "/dashboard" || pathname.startsWith("/dashboard/");

  return (
    <>
      {/* Push dashboard content below fixed banner */}
      <div className={isDashboardRoute ? "pt-10" : ""}>{children}</div>

      {/* Single Connectivity Banner (Dashboard only): Orange offline, Green online */}
      {isDashboardRoute && (
        <div
          className={[
            "fixed top-0 left-0 right-0 z-50 px-3 py-2 text-sm",
            isOnline ? "bg-green-600 text-white" : "bg-orange-500 text-white",
          ].join(" ")}
        >
          <div className="mx-auto max-w-7xl flex items-center justify-center gap-2 text-center">
            {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            <span className="font-medium">{isOnline ? "Connected" : "You're offline."}</span>
            {!isOnline && (
              <span className="opacity-90">
                Some features may not work until your connection is restored.
                {queueCount > 0 && ` ${queueCount} operation${queueCount > 1 ? "s" : ""} queued.`}
              </span>
            )}
            {!isOnline && queueCount > 0 && typeof window !== "undefined" && (
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
