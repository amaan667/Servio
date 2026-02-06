"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface SyncQueueItem {
  id: string;
  action: string;
  payload: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
}

interface UseOfflineSyncOptions {
  maxRetries?: number;
  retryDelay?: number;
  storageKey?: string;
}

interface UseOfflineSyncReturn {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  queue: SyncQueueItem[];
  addToQueue: (action: string, payload: Record<string, unknown>) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
  forceSync: () => Promise<void>;
}

/**
 * Hook for managing offline sync queue for failed requests
 */
export function useOfflineSync({
  maxRetries = 3,
  retryDelay = 5000,
  storageKey = "offline-sync-queue",
}: UseOfflineSyncOptions = {}): UseOfflineSyncReturn {
  const [isOnline, setIsOnline] = useState(true);
  const [queue, setQueue] = useState<SyncQueueItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const processingRef = useRef(false);

  // Load queue from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setQueue(parsed);
      }
    } catch (error) {
      console.error("Failed to load sync queue:", error);
    }
  }, [storageKey]);

  // Save queue to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(queue));
    } catch (error) {
      console.error("Failed to save sync queue:", error);
    }
  }, [queue, storageKey]);

  // Monitor online status
  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      // Trigger sync when coming back online
      if (queue.length > 0 && !processingRef.current) {
        processQueue();
      }
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [queue]);

  const processQueue = useCallback(async () => {
    if (processingRef.current || queue.length === 0) return;
    processingRef.current = true;
    setIsSyncing(true);

    const remaining: SyncQueueItem[] = [];

    for (const item of queue) {
      try {
        const response = await fetch(`/api/sync/${item.action}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.payload),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        // Success - don't add back to queue
      } catch (error) {
        if (item.retryCount < maxRetries) {
          remaining.push({
            ...item,
            retryCount: item.retryCount + 1,
          });
        } else {
          // Max retries exceeded - notify user
          console.warn(`Max retries exceeded for ${item.action}:`, item);
        }
      }

      // Delay between requests
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }

    setQueue(remaining);
    setIsSyncing(false);
    processingRef.current = false;

    // If there are remaining items, schedule another sync attempt
    if (remaining.length > 0 && isOnline) {
      setTimeout(() => {
        if (!processingRef.current) {
          processQueue();
        }
      }, retryDelay * 2);
    }
  }, [queue, maxRetries, retryDelay, isOnline]);

  const addToQueue = useCallback(
    (action: string, payload: Record<string, unknown>) => {
      const item: SyncQueueItem = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        action,
        payload,
        timestamp: Date.now(),
        retryCount: 0,
      };
      setQueue((prev) => [...prev, item]);
    },
    []
  );

  const removeFromQueue = useCallback((id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  const forceSync = useCallback(async () => {
    if (!isOnline) {
      console.warn("Cannot force sync while offline");
      return;
    }
    await processQueue();
  }, [isOnline, processQueue]);

  return {
    isOnline,
    pendingCount: queue.length,
    isSyncing,
    queue,
    addToQueue,
    removeFromQueue,
    clearQueue,
    forceSync,
  };
}

/**
 * Hook for tracking pending actions with offline support
 */
export function useOfflineAction<T extends Record<string, unknown>>(
  action: string,
  executeAction: (payload: T) => Promise<void>
) {
  const { isOnline, addToQueue, pendingCount } = useOfflineSync();

  const handleAction = useCallback(
    async (payload: T, options?: { forceOnline?: boolean }) => {
      const shouldQueue = !isOnline || options?.forceOnline === false;

      if (shouldQueue) {
        addToQueue(action, payload as Record<string, unknown>);
        return { queued: true };
      }

      try {
        await executeAction(payload);
        return { success: true };
      } catch (error) {
        // On failure, queue for later
        addToQueue(action, payload as Record<string, unknown>);
        return { queued: true, error };
      }
    },
    [isOnline, addToQueue, action, executeAction]
  );

  return {
    handleAction,
    isOnline,
    pendingActions: pendingCount,
  };
}
