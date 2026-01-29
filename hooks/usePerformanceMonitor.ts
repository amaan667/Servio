import { useEffect } from "react";

/**
 * Hook for monitoring performance metrics
 * Helps identify performance bottlenecks in development
 */
export function usePerformanceMonitor(componentName: string) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    const startTime = performance.now();

    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;

      if (renderTime > 16) {
        // More than one frame (16ms at 60fps)
      }
    };
  }, [componentName]);
}

/**
 * Hook for measuring API call performance
 */
export function useApiPerformanceMonitor(_apiName: string) {
  const measureApiCall = <T extends (...args: unknown[]) => Promise<unknown>>(fn: T) => {
    return async (...args: Parameters<T>) => {
      if (process.env.NODE_ENV !== "development") {
        return fn(...args);
      }

      const startTime = performance.now();
      try {
        const result = await fn(...(args as Parameters<T>));
        const endTime = performance.now();
        const duration = endTime - startTime;

        if (duration > 1000) {
          // More than 1 second
        }

        return result;
      } catch (_error) {
        const endTime = performance.now();
        const duration = endTime - startTime;

        throw _error;
      }
    };
  };

  return { measureApiCall };
}
