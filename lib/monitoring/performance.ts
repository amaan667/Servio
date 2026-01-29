/**
 * Performance Monitoring & Optimization
 * Tracks and optimizes application performance
 */

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics = 1000;

  /**
   * Record a timing metric
   */
  recordTiming(name: string, duration: number, tags?: Record<string, string>): void {
    this.metrics.push({
      name,
      value: duration,
      timestamp: Date.now(),
      tags,
    });

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Log slow operations
    if (duration > 1000) {
      /* Condition handled */
    }
  }

  /**
   * Get metrics for a specific operation
   */
  getMetrics(name: string): PerformanceMetric[] {
    return this.metrics.filter((m) => m.name === name);
  }

  /**
   * Calculate percentiles for an operation
   */
  getPercentiles(name: string): { p50: number; p95: number; p99: number } | null {
    const values = this.getMetrics(name)
      .map((m) => m.value)
      .sort((a, b) => a - b);

    if (values.length === 0) return null;

    const p50Index = Math.floor(values.length * 0.5);
    const p95Index = Math.floor(values.length * 0.95);
    const p99Index = Math.floor(values.length * 0.99);

    return {
      p50: values[p50Index] || 0,
      p95: values[p95Index] || 0,
      p99: values[p99Index] || 0,
    };
  }

  /**
   * Get summary of all operations
   */
  getSummary(): Record<string, { count: number; avg: number; p95: number }> {
    const summary: Record<string, { count: number; avg: number; p95: number }> = {
      /* Empty */
    };

    const uniqueNames = [...new Set(this.metrics.map((m) => m.name))];

    for (const name of uniqueNames) {
      const metrics = this.getMetrics(name);
      const values = metrics.map((m) => m.value);
      const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
      const percentiles = this.getPercentiles(name);

      summary[name] = {
        count: metrics.length,
        avg: Math.round(avg),
        p95: percentiles?.p95 || 0,
      };
    }

    return summary;
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Timer utility for measuring operation duration
 */
export class Timer {
  private startTime: number;
  private name: string;
  private tags?: Record<string, string>;

  constructor(name: string, tags?: Record<string, string>) {
    this.name = name;
    this.tags = tags;
    this.startTime = Date.now();
  }

  /**
   * Stop timer and record metric
   */
  end(): number {
    const duration = Date.now() - this.startTime;
    performanceMonitor.recordTiming(this.name, duration, this.tags);
    return duration;
  }

  /**
   * Get elapsed time without stopping
   */
  elapsed(): number {
    return Date.now() - this.startTime;
  }
}

/**
 * Decorator for timing async functions
 */
export function measurePerformance(operationName: string) {
  return function <T extends (...args: unknown[]) => Promise<unknown>>(target: T): T {
    return (async (...args: unknown[]) => {
      const timer = new Timer(operationName);
      try {
        const result = await target(...args);
        timer.end();
        return result;
      } catch (_error) {
        timer.end();
        throw _error;
      }
    }) as T;
  };
}

/**
 * Memoize function results (in-memory caching)
 */
export function memoize<T extends (...args: unknown[]) => unknown>(
  fn: T,
  ttl = 5 * 60 * 1000 // 5 minutes default
): T {
  const cache = new Map<string, { value: unknown; expires: number }>();

  return ((...args: unknown[]) => {
    const key = JSON.stringify(args);
    const cached = cache.get(key);

    if (cached && Date.now() < cached.expires) {
      return cached.value;
    }

    const result = fn(...args);
    cache.set(key, {
      value: result,
      expires: Date.now() + ttl,
    });

    return result;
  }) as T;
}

/**
 * Debounce function calls
 */
export function debounce<T extends (...args: unknown[]) => unknown>(fn: T, delay: number): T {
  let timeoutId: NodeJS.Timeout;

  return ((...args: unknown[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  }) as T;
}

/**
 * Throttle function calls
 */
export function throttle<T extends (...args: unknown[]) => unknown>(fn: T, limit: number): T {
  let inThrottle: boolean;

  return ((...args: unknown[]) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  }) as T;
}

/**
 * Report performance metrics to monitoring service
 */
export async function reportPerformanceMetrics(): Promise<void> {
  const summary = performanceMonitor.getSummary();

  // Log to Sentry or your monitoring service

  // Check for performance degradation
  for (const [operation, stats] of Object.entries(summary)) {
    if (stats.p95 > 2000) {
      /* Condition handled */
    }
  }
}

// Report metrics every 5 minutes in production
if (typeof setInterval !== "undefined" && process.env.NODE_ENV === "production") {
  setInterval(reportPerformanceMetrics, 5 * 60 * 1000);
}
