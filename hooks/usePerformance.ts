"use client";

import React, { useEffect, useCallback } from "react";
import { logger } from "@/lib/logger";

interface PerformanceMetrics {
  name: string;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
}

export function usePerformance() {
  const measureComponentRender = useCallback((componentName: string) => {
    if (typeof window === "undefined" || !window.performance) return;

    const startMark = `${componentName}-start`;
    const endMark = `${componentName}-end`;
    const measureName = `${componentName}-render`;

    return {
      start: () => performance.mark(startMark),
      end: () => {
        performance.mark(endMark);
        try {
          performance.measure(measureName, startMark, endMark);
          const measure = performance.getEntriesByName(measureName)[0];

          if (process.env.NODE_ENV === "development") {
            logger.debug(
              `[Performance] ${componentName} rendered in ${measure.duration.toFixed(2)}ms`
            );
          }

          // Clean up marks
          performance.clearMarks(startMark);
          performance.clearMarks(endMark);
          performance.clearMeasures(measureName);

          return measure.duration;
        } catch (_error) {
          // Silent error handling
          return 0;
        }
      },
    };
  }, []);

  const measureAction = useCallback(
    async <T>(actionName: string, action: () => Promise<T> | T): Promise<T> => {
      const start = performance.now();
      const result = await action();
      const duration = performance.now() - start;

      if (process.env.NODE_ENV === "development") {
      }

      return result;
    },
    []
  );

  const getNetworkInfo = useCallback(() => {
    if (typeof navigator === "undefined" || !("connection" in navigator)) {
      return null;
    }

    const connection = (
      navigator as {
        connection?: {
          effectiveType?: string;
          downlink?: number;
          rtt?: number;
          saveData?: boolean;
        };
      }
    ).connection;
    return {
      effectiveType: connection?.effectiveType,
      downlink: connection?.downlink,
      rtt: connection?.rtt,
      saveData: connection?.saveData,
    } as unknown;
  }, []);

  const getMemoryInfo = useCallback(() => {
    if (typeof performance === "undefined" || !("memory" in performance)) {
      return null;
    }

    const memory = (
      performance as {
        memory?: { usedJSHeapSize?: number; totalJSHeapSize?: number; jsHeapSizeLimit?: number };
      }
    ).memory;
    return {
      usedJSHeapSize: memory?.usedJSHeapSize,
      totalJSHeapSize: memory?.totalJSHeapSize,
      jsHeapSizeLimit: memory?.jsHeapSizeLimit,
      usagePercentage:
        memory && memory.usedJSHeapSize && memory.jsHeapSizeLimit
          ? ((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100).toFixed(2)
          : 0,
    } as unknown;
  }, []);

  const reportLongTask = useCallback((taskName: string, duration: number) => {
    if (duration > 50) {
      // Long task threshold is 50ms
      logger.warn(
        `[Performance Warning] Long task detected: ${taskName} took ${duration.toFixed(2)}ms`
      );

      // Send to analytics if in production
      if (process.env.NODE_ENV === "production") {
        fetch("/api/analytics/long-task", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskName, duration }),
          keepalive: true,
        }).catch(() => {
          /* Empty */
        });
      }
    }
  }, []);

  return {
    measureComponentRender,
    measureAction,
    getNetworkInfo,
    getMemoryInfo,
    reportLongTask,
  };
}

// HOC for measuring component render performance
export function withPerformanceTracking<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName: string
) {
  const PerformanceTrackedComponent = (props: P) => {
    const { measureComponentRender } = usePerformance();

    useEffect(() => {
      const measure = measureComponentRender(componentName);
      if (!measure) return;

      measure.start();
      return () => {
        const duration = measure.end();
        if (duration && duration > 100) {
          logger.warn(
            `[Performance] ${componentName} took ${duration.toFixed(2)}ms to render (>100ms threshold)`
          );
        }
      };
    }, [measureComponentRender, componentName]);

    return React.createElement(WrappedComponent, props);
  };

  PerformanceTrackedComponent.displayName = `withPerformanceTracking(${componentName})`;

  return PerformanceTrackedComponent;
}
