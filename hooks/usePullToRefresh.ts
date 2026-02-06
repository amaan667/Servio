"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  maxPullDistance?: number;
  disabled?: boolean;
}

interface UsePullToRefreshReturn {
  isPulling: boolean;
  pullDistance: number;
  isRefreshing: boolean;
  triggerRefresh: () => void;
}

/**
 * Hook for implementing pull-to-refresh functionality on mobile devices
 */
export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  maxPullDistance = 150,
  disabled = false,
}: UsePullToRefreshOptions): UsePullToRefreshReturn {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled || isRefreshing) return;
    // Only enable pull-to-refresh when at the top of the page
    if (window.scrollY > 0) return;

    const touch = e.touches[0];
    if (!touch) return;
    startY.current = touch.clientY;
    setIsPulling(true);
  }, [disabled, isRefreshing]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPulling || disabled || isRefreshing || startY.current === null) return;

    const touch = e.touches[0];
    if (!touch) return;

    const currentY = touch.clientY;
    const distance = Math.max(0, currentY - startY.current);

    // Cap the pull distance
    const cappedDistance = Math.min(distance, maxPullDistance);
    setPullDistance(cappedDistance);

    // Don't prevent default if we're at the top
    if (distance < threshold) {
      // Allow normal scrolling
    }
  }, [isPulling, disabled, isRefreshing, maxPullDistance, threshold]);

  const handleTouchEnd = useCallback(async (_e: TouchEvent) => {
    if (!isPulling || disabled || isRefreshing) return;

    setIsPulling(false);
    setPullDistance(0);

    // Trigger refresh if pulled far enough
    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }

    startY.current = null;
  }, [isPulling, disabled, isRefreshing, pullDistance, threshold, onRefresh]);

  useEffect(() => {
    const container = document.querySelector("[data-pull-refresh]") || document.body;

    container.addEventListener("touchstart", handleTouchStart as unknown as EventListener, { passive: true });
    container.addEventListener("touchmove", handleTouchMove as unknown as EventListener, { passive: true });
    container.addEventListener("touchend", handleTouchEnd as unknown as EventListener, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart as unknown as EventListener);
      container.removeEventListener("touchmove", handleTouchMove as unknown as EventListener);
      container.removeEventListener("touchend", handleTouchEnd as unknown as EventListener);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const triggerRefresh = useCallback(async () => {
    if (disabled || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  }, [disabled, isRefreshing, onRefresh]);

  return {
    isPulling,
    pullDistance,
    isRefreshing,
    triggerRefresh,
  };
}

/**
 * Hook for detecting online/offline status
 * Properly handles SSR by only returning actual value after mount
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Always return true during SSR to avoid hydration mismatch
  return mounted ? isOnline : true;
}
