"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Wifi, WifiOff } from "lucide-react";
import { getOfflineQueue } from "@/lib/offline-queue";

export function OnlineStatusBadge() {
  const pathname = usePathname();
  const [isOnline, setIsOnline] = useState(true);
  const [queueCount, setQueueCount] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const queue = getOfflineQueue();

    const updateQueueStatus = () => {
      const status = queue.getQueueStatus();
      setQueueCount(status.count);
    };

    const handleOnline = async () => {
      setIsOnline(true);
      await queue.syncQueue();
      updateQueueStatus();
    };

    const handleOffline = () => {
      setIsOnline(false);
      updateQueueStatus();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const checkConnectivity = async () => {
      try {
        const response = await fetch("/api/auth/health", {
          method: "GET",
          cache: "no-cache",
          signal: AbortSignal.timeout(3000),
        });
        setIsOnline(response.ok);
      } catch {
        setIsOnline(navigator.onLine);
      }
    };

    checkConnectivity();
    updateQueueStatus();

    const queueInterval = setInterval(updateQueueStatus, 5000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(queueInterval);
    };
  }, []);

  // Only show on dashboard routes (never on home/order/payment pages)
  if (!pathname.startsWith("/dashboard")) {
    return null;
  }

  return (
    <div className="pb-2">
      <div
        className={[
          "w-full border rounded-lg px-4 py-3 flex items-center justify-between gap-4",
          "transition-colors duration-200",
          isOnline
            ? "bg-green-50 border-green-200 text-green-900"
            : "bg-red-50 border-red-200 text-red-900",
        ].join(" ")}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex-shrink-0">
            {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            {isOnline && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{isOnline ? "Connected" : "Offline"}</p>
            {!isOnline && (
              <p className="text-xs opacity-80 truncate">
                Some actions may be queued until you reconnect.
              </p>
            )}
          </div>
        </div>

        {!isOnline && queueCount > 0 && (
          <div className="text-xs font-semibold whitespace-nowrap">{queueCount} queued</div>
        )}
      </div>
    </div>
  );
}
