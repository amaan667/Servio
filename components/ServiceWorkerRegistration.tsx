"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw, WifiOff } from "lucide-react";

interface ServiceWorkerRegistrationProps {
  children: React.ReactNode;
}

export default function ServiceWorkerRegistration({ children }: ServiceWorkerRegistrationProps) {
  const [isOnline, setIsOnline] = useState(true);
  // const [swRegistration] = useState<ServiceWorkerRegistration | null>(null);
  // Update banner removed – we no longer surface a UI prompt for updates
  // const [updateAvailable] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

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
          registration.addEventListener("updatefound", () => {
            const installing = registration.installing;
            if (installing) {
              installing.addEventListener("statechange", () => {
                if (installing.state === "installed") {
                  setIsInstalling(false);
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

      {/* Update banner intentionally removed */}

      {/* Installing Indicator */}
      {isInstalling && (
        <div className="fixed bottom-4 right-4 z-50">
          <Card className="bg-white shadow-lg border border-gray-200">
            <CardContent className="p-3">
              <div className="flex items-center space-x-3">
                <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
                <span className="text-sm font-medium text-gray-700">Installing update...</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
