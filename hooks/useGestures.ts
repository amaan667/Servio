import { useCallback, useEffect, useRef, useState } from "react";

interface GestureState {
  isDragging: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  deltaX: number;
  deltaY: number;
  direction: "left" | "right" | "up" | "down" | null;
  velocity: number;
}

interface GestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onPullToRefresh?: () => void;
  swipeThreshold?: number;
  pullToRefreshThreshold?: number;
  velocityThreshold?: number;
  preventDefault?: boolean;
}

export function useGestures(
  options: GestureOptions = {
    /* Empty */
  }
) {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onPullToRefresh,
    swipeThreshold = 100,
    pullToRefreshThreshold = 150,
    velocityThreshold = 0.3,
    preventDefault = true,
  } = options;

  const [gestureState, setGestureState] = useState<GestureState>({
    isDragging: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    deltaX: 0,
    deltaY: 0,
    direction: null,
    velocity: 0,
  });

  const [isPullToRefreshActive, setIsPullToRefreshActive] = useState(false);
  const [pullToRefreshProgress, setPullToRefreshProgress] = useState(0);

  const startTimeRef = useRef<number>(0);
  const lastMoveTimeRef = useRef<number>(0);
  const lastMoveXRef = useRef<number>(0);
  const lastMoveYRef = useRef<number>(0);

  const getDirection = useCallback((deltaX: number, deltaY: number): GestureState["direction"] => {
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absX > absY) {
      return deltaX > 0 ? "right" : "left";
    } else {
      return deltaY > 0 ? "down" : "up";
    }
  }, []);

  const calculateVelocity = useCallback(
    (deltaX: number, deltaY: number, deltaTime: number): number => {
      if (deltaTime === 0) return 0;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      return distance / deltaTime;
    },
    []
  );

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length !== 1) return;

    const touch = e.touches[0];
    if (!touch) return;
    const now = Date.now();

    startTimeRef.current = now;
    lastMoveTimeRef.current = now;
    lastMoveXRef.current = touch.clientX;
    lastMoveYRef.current = touch.clientY;

    setGestureState({
      isDragging: true,
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: touch.clientX,
      currentY: touch.clientY,
      deltaX: 0,
      deltaY: 0,
      direction: null,
      velocity: 0,
    });

    setIsPullToRefreshActive(false);
    setPullToRefreshProgress(0);
  }, []);

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (e.touches.length !== 1 || !gestureState.isDragging) return;

      const touch = e.touches[0];
      if (!touch) return;
      const now = Date.now();

      const deltaX = touch.clientX - gestureState.startX;
      const deltaY = touch.clientY - gestureState.startY;
      const deltaTime = now - lastMoveTimeRef.current;
      const deltaMoveX = touch.clientX - lastMoveXRef.current;
      const deltaMoveY = touch.clientY - lastMoveYRef.current;

      const velocity = calculateVelocity(deltaMoveX, deltaMoveY, deltaTime);
      const direction = getDirection(deltaX, deltaY);

      // Check for pull-to-refresh (only if we're at the top of the page)
      const isAtTop = window.scrollY === 0;
      const isPullingDown = deltaY > 0 && direction === "down";

      if (isAtTop && isPullingDown && onPullToRefresh) {
        const progress = Math.min(deltaY / pullToRefreshThreshold, 1);
        setPullToRefreshProgress(progress);
        setIsPullToRefreshActive(progress >= 1);

        if (preventDefault) {
          e.preventDefault();
        }
      }

      setGestureState({
        ...gestureState,
        currentX: touch.clientX,
        currentY: touch.clientY,
        deltaX,
        deltaY,
        direction,
        velocity,
      });

      lastMoveTimeRef.current = now;
      lastMoveXRef.current = touch.clientX;
      lastMoveYRef.current = touch.clientY;
    },
    [
      gestureState,
      pullToRefreshThreshold,
      onPullToRefresh,
      preventDefault,
      calculateVelocity,
      getDirection,
    ]
  );

  const handleTouchEnd = useCallback(
    (_e: TouchEvent) => {
      if (!gestureState.isDragging) return;

      const { deltaX, deltaY, direction, velocity } = gestureState;
      const totalTime = Date.now() - startTimeRef.current;

      // Reset gesture state
      setGestureState({
        isDragging: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        deltaX: 0,
        deltaY: 0,
        direction: null,
        velocity: 0,
      });

      // Handle pull-to-refresh
      if (isPullToRefreshActive && onPullToRefresh) {
        onPullToRefresh();
        setIsPullToRefreshActive(false);
        setPullToRefreshProgress(0);
        return;
      }

      // Check if gesture meets threshold and velocity requirements
      const meetsThreshold = Math.abs(deltaX) > swipeThreshold || Math.abs(deltaY) > swipeThreshold;
      const meetsVelocity = velocity > velocityThreshold;

      if (meetsThreshold && meetsVelocity && direction) {
        switch (direction) {
          case "left":
            onSwipeLeft?.();
            break;
          case "right":
            onSwipeRight?.();
            break;
          case "up":
            onSwipeUp?.();
            break;
          case "down":
            onSwipeDown?.();
            break;
        }
      }

      // Reset pull-to-refresh
      setIsPullToRefreshActive(false);
      setPullToRefreshProgress(0);
    },
    [
      gestureState,
      isPullToRefreshActive,
      onPullToRefresh,
      onSwipeLeft,
      onSwipeRight,
      onSwipeUp,
      onSwipeDown,
      swipeThreshold,
      velocityThreshold,
    ]
  );

  useEffect(() => {
    const element = document.body;

    element.addEventListener("touchstart", handleTouchStart, { passive: false });
    element.addEventListener("touchmove", handleTouchMove, { passive: false });
    element.addEventListener("touchend", handleTouchEnd, { passive: false });

    return () => {
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchmove", handleTouchMove);
      element.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    gestureState,
    isPullToRefreshActive,
    pullToRefreshProgress,
    isDragging: gestureState.isDragging,
  };
}

// Hook for swipe-based navigation
export function useSwipeNavigation() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const goToNext = useCallback(() => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex((prev) => prev + 1);
      setIsTransitioning(false);
    }, 150);
  }, []);

  const goToPrevious = useCallback(() => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex((prev) => Math.max(0, prev - 1));
      setIsTransitioning(false);
    }, 150);
  }, []);

  const goToIndex = useCallback((index: number) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex(index);
      setIsTransitioning(false);
    }, 150);
  }, []);

  const { gestureState } = useGestures({
    onSwipeLeft: goToNext,
    onSwipeRight: goToPrevious,
    swipeThreshold: 50,
    velocityThreshold: 0.2,
  });

  return {
    currentIndex,
    isTransitioning,
    goToNext,
    goToPrevious,
    goToIndex,
    gestureState,
  };
}

// Hook for pull-to-refresh
export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    try {
      await onRefresh();
    } catch (_error) {
      /* Error handled silently */
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh, isRefreshing]);

  const { pullToRefreshProgress, isPullToRefreshActive } = useGestures({
    onPullToRefresh: handleRefresh,
    pullToRefreshThreshold: 120,
  });

  useEffect(() => {
    setProgress(pullToRefreshProgress);
  }, [pullToRefreshProgress]);

  return {
    isRefreshing,
    progress,
    isPullToRefreshActive,
    canRefresh: isPullToRefreshActive,
  };
}
