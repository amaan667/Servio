"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

interface ServiceWorkerRegistrationProps {
  children: React.ReactNode;
}

export default function ServiceWorkerRegistration({ children }: ServiceWorkerRegistrationProps) {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Initialize online status - default to true to avoid false offline warnings
    setIsOnline(true);

    // Check online status
    const handleOnline = () => {
      console.info("[SERVICE WORKER] Network online");
      setIsOnline(true);
    };
    const handleOffline = () => {
      console.warn("[SERVICE WORKER] Network offline");
      setIsOnline(false);
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

    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          // Previously: show update banner when updatefound. Now we silently allow the
          // new SW to install/activate without surfacing UI to the user.
          // Silently handle updates in background
          registration.addEventListener("updatefound", () => {
            const installing = registration.installing;
            if (installing) {
              installing.addEventListener("statechange", () => {
                if (installing.state === "installed" && navigator.serviceWorker.controller) {
                  // New service worker installed, will activate on next page load
                }
              });
            }
          });

          // Check for existing updates
          registration.update();
        })
        .catch(() => {
          // Service worker registration failed
        });
    }

    // Listen for messages from service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data && event.data.type === "SKIP_WAITING") {
          window.location.reload();
        }
      });
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // const handleUpdate = () => {};

  return (
    <>
      {children}

      {/* Offline Indicator - Only show on dashboard pages */}
      {!isOnline &&
        typeof window !== "undefined" &&
        window.location.pathname.startsWith("/dashboard") && (
          <div className="fixed top-0 left-0 right-0 z-50 bg-orange-500 text-white p-2 text-center text-sm">
            <div className="flex items-center justify-center space-x-2">
              <WifiOff className="h-4 w-4" />
              <span>You&apos;re offline. Some features may be limited.</span>
            </div>
          </div>
        )}

      {/* All update UI removed - updates happen silently in background */}
    </>
  );
}
