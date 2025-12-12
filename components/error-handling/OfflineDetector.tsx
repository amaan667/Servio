"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { WifiOff, Wifi } from "lucide-react";

export function OfflineDetector() {
  const pathname = usePathname();
  const isDashboardRoute = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        // Show reconnected message briefly
        setTimeout(() => setWasOffline(false), 3000);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    // Set initial state
    setIsOnline(navigator.onLine);

    // Listen for online/offline events
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [wasOffline]);

  // Only show offline UI globally. Any "back online" messaging should be dashboard-only.
  if (isOnline && !wasOffline) return null;
  if (isOnline && wasOffline && !isDashboardRoute) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md">
      <Alert variant={isOnline ? "default" : "destructive"}>
        {isOnline ? (
          <>
            <Wifi className="h-4 w-4" />
            <AlertTitle>Back Online</AlertTitle>
            <AlertDescription>Your connection has been restored.</AlertDescription>
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4" />
            <AlertTitle>No Internet Connection</AlertTitle>
            <AlertDescription>
              You're offline. Some features may not work until your connection is restored.
            </AlertDescription>
          </>
        )}
      </Alert>
    </div>
  );
}
