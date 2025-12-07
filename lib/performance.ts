/**
 * Performance Tracking Utility
 * Monitors operation duration and logs slow operations
 */

import { logger } from "./logger";

interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

const metrics: PerformanceMetric[] = [];
const MAX_METRICS = 1000; // Keep last 1000 metrics in memory

// Thresholds for slow operation alerts (ms)
const SLOW_THRESHOLDS = {
  api: 3000, // API calls > 3s
  database: 1000, // DB queries > 1s
  ai: 5000, // AI operations > 5s
  render: 100, // Renders > 100ms
  default: 2000, // Everything else > 2s
};

/**
 * Track async operation performance
 */
export async function trackPerformance<T>(
  operation: string,
  fn: () => Promise<T>,
  metadata?: Record<string, unknown>
): Promise<T> {
  const start = performance.now();

  try {
    const result = await fn();
    const duration = performance.now() - start;

    recordMetric(operation, duration, metadata);
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    recordMetric(operation, duration, { ...metadata, error: true });
    throw error;
  }
}

/**
 * Track sync operation performance
 */
export function trackPerformanceSync<T>(
  operation: string,
  fn: () => T,
  metadata?: Record<string, unknown>
): T {
  const start = performance.now();

  try {
    const result = fn();
    const duration = performance.now() - start;

    recordMetric(operation, duration, metadata);
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    recordMetric(operation, duration, { ...metadata, error: true });
    throw error;
  }
}

/**
 * Record performance metric
 */
function recordMetric(operation: string, duration: number, metadata?: Record<string, unknown>) {
  const metric: PerformanceMetric = {
    operation,
    duration,
    timestamp: Date.now(),
    metadata,
  };

  // Add to metrics array
  metrics.push(metric);

  // Keep only last MAX_METRICS
  if (metrics.length > MAX_METRICS) {
    metrics.shift();
  }

  // Determine threshold based on operation type
  const operationType = operation.split(":")[0];
  const threshold =
    SLOW_THRESHOLDS[operationType as keyof typeof SLOW_THRESHOLDS] || SLOW_THRESHOLDS.default;

  // Alert if slow
  if (duration > threshold) {
    logger.warn(`[PERF] Slow operation detected`, {
      operation,
      duration: `${duration.toFixed(2)}ms`,
      threshold: `${threshold}ms`,
      metadata,
    });
  }

  // Log all operations in development for debugging
  if (process.env.NODE_ENV === "development") {
    logger.debug(`[PERF] ${operation}`, {
      duration: `${duration.toFixed(2)}ms`,
      metadata,
    });
  }
}

/**
 * Get performance summary for an operation
 */
export function getPerformanceSummary(operationPrefix: string) {
  const relevantMetrics = metrics.filter((m) => m.operation.startsWith(operationPrefix));

  if (relevantMetrics.length === 0) {
    return null;
  }

  const durations = relevantMetrics.map((m) => m.duration);
  const total = durations.reduce((sum, d) => sum + d, 0);
  const avg = total / durations.length;
  const min = Math.min(...durations);
  const max = Math.max(...durations);

  // Calculate percentiles
  const sorted = [...durations].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];

  return {
    operation: operationPrefix,
    count: relevantMetrics.length,
    avg,
    min,
    max,
    p50,
    p95,
    p99,
    total,
  };
}

/**
 * Get all metrics (for analytics dashboard)
 */
export function getAllMetrics() {
  return [...metrics];
}

/**
 * Clear all metrics
 */
export function clearMetrics() {
  metrics.length = 0;
}

/**
 * Export metrics to analytics service
 */
export async function exportMetrics(serviceName: string = "sentry") {
  const summary = {
    timestamp: Date.now(),
    metrics: metrics.map((m) => ({
      operation: m.operation,
      duration: m.duration,
      timestamp: m.timestamp,
    })),
  };

  if (serviceName === "sentry" && typeof window !== "undefined") {
    // Send to Sentry as breadcrumb
    const Sentry = await import("@sentry/nextjs");
    Sentry.addBreadcrumb({
      category: "performance",
      message: "Performance metrics export",
      data: summary,
      level: "info",
    });
  }

  // Could also send to DataDog, New Relic, etc.
  logger.info("[PERF] Metrics exported", {
    metricsCount: metrics.length,
    service: serviceName,
  });
}
