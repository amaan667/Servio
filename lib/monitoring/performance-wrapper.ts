/**
 * Performance monitoring wrapper for critical operations
 * Tracks execution time, success rate, and errors
 */

interface PerformanceMetrics {

  metadata?: Record<string, unknown>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private readonly MAX_METRICS = 1000;

  /**
   * Wrap an async function with performance monitoring
   */
  async measure<T>(

    metadata?: Record<string, unknown>
  ): Promise<T> {
    const startTime = performance.now();
    const timestamp = Date.now();
    let success = true;
    let result: T;

    try {
      result = await fn();
      return result;
    } catch (_error) {
      success = false;
      throw _error;
    } finally {
      const duration = performance.now() - startTime;

      this.recordMetric({
        operationName,
        duration,
        success,
        timestamp,
        metadata,

      // Log slow operations (>1s)
      if (duration > 1000) {
        /* Empty */
      }
    }
  }

  /**
   * Record a performance metric
   */
  private recordMetric(metric: PerformanceMetrics) {
    this.metrics.push(metric);

    // Keep only recent metrics
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }
  }

  /**
   * Get performance statistics for an operation
   */
  getStats(operationName: string): {

  } | null {
    const operationMetrics = this.metrics.filter((m) => m.operationName === operationName);

    if (operationMetrics.length === 0) {
      return null;
    }

    const durations = operationMetrics.map((m) => m.duration).sort((a, b) => a - b);
    const successCount = operationMetrics.filter((m) => m.success).length;

    return {

      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,

    };
  }

  /**
   * Get all performance statistics
   */
  getAllStats(): Record<string, ReturnType<PerformanceMonitor["getStats"]>> {
    const operations = new Set(this.metrics.map((m) => m.operationName));
    const stats: Record<string, ReturnType<PerformanceMonitor["getStats"]>> = {
      /* Empty */
    };

    operations.forEach((op) => {
      stats[op] = this.getStats(op);

    return stats;
  }

  /**
   * Clear all metrics
   */
  clear() {
    this.metrics = [];
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Decorator for measuring function performance
 */
export function measurePerformance(operationName: string) {
  return function (_target: unknown, _propertyName: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      return performanceMonitor.measure(operationName, () => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}
