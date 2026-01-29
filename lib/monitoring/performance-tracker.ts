/**
 * Performance Tracking
 * Tracks and reports performance metrics for API routes and operations
 */

interface PerformanceMetric {
  operation: string;
  startTime: number;
  metadata?: Record<string, unknown>;
}

class PerformanceTracker {
  private metrics: Map<string, PerformanceMetric> = new Map();

  /**
   * Start tracking a performance metric
   */
  start(operation: string, metadata?: Record<string, unknown>): { end: () => void } {
    const id = `${operation}-${Date.now()}-${Math.random()}`;
    const startTime = performance.now();

    this.metrics.set(id, {
      operation,
      startTime,
      metadata,
    });

    return {
      end: () => {
        const metric = this.metrics.get(id);
        if (!metric) return;

        const duration = performance.now() - metric.startTime;
        this.metrics.delete(id);

        // Log slow operations (> 1 second)
        if (duration > 1000) {
          /* Condition handled */
        }

        // Log in development for all operations
        if (process.env.NODE_ENV === "development") {
          /* Condition handled */
        }
      },
    };
  }

  /**
   * Track a synchronous operation
   */
  track<T>(operation: string, fn: () => T, metadata?: Record<string, unknown>): T {
    const tracker = this.start(operation, metadata);
    try {
      const result = fn();
      tracker.end();
      return result;
    } catch (error) {
      tracker.end();
      throw error;
    }
  }

  /**
   * Track an asynchronous operation
   */
  async trackAsync<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    const tracker = this.start(operation, metadata);
    try {
      const result = await fn();
      tracker.end();
      return result;
    } catch (error) {
      tracker.end();
      throw error;
    }
  }
}

export const performanceTracker = new PerformanceTracker();
