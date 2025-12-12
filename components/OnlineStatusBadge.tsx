"use client";

import { useEffect, useState } from "react";
import { getOfflineQueue } from "@/lib/offline-queue";

export function OnlineStatusBadge() {
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

  return (
    <div className="pb-2">
      <div
        className={`inline-flex px-3 py-1 rounded-full text-sm font-medium shadow ${
          isOnline ? "bg-green-600 text-white" : "bg-red-600 text-white"
        }`}
      >
        {isOnline ? "Online" : `Offline${queueCount > 0 ? ` • ${queueCount} queued` : ""}`}
      </div>
    </div>
  );
}
