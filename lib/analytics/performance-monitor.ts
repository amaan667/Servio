import { logger } from "@/lib/logger";

export interface PerformanceMetrics {
  // Core Web Vitals
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  cls: number; // Cumulative Layout Shift
  fcp: number; // First Contentful Paint
  ttfb: number; // Time to First Byte

  // Custom metrics
  pageLoadTime: number;
  apiResponseTime: number;
  databaseQueryTime: number;
  cacheHitRate: number;

  // Business metrics
  userEngagement: number;
  conversionRate: number;
  bounceRate: number;

  // System metrics
  memoryUsage: number;
  cpuUsage: number;
  errorRate: number;
}

export class PerformanceMonitor {
  private static metrics: PerformanceMetrics[] = [];
  private static observers: PerformanceObserver[] = [];

  /**
   * Initialize performance monitoring
   */
  static initialize() {
    if (typeof window === "undefined") return;

    this.setupWebVitals();
    this.setupCustomMetrics();
    this.setupSystemMetrics();
  }

  /**
   * Setup Core Web Vitals monitoring
   */
  private static setupWebVitals() {
    // Largest Contentful Paint
    if ("PerformanceObserver" in window) {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        this.recordMetric("lcp", lastEntry.startTime);
      });
      lcpObserver.observe({ entryTypes: ["largest-contentful-paint"] });
      this.observers.push(lcpObserver);

      // First Input Delay
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          const typedEntry = entry as PerformanceEntry & { processingStart?: number };
          if (typedEntry.processingStart !== undefined) {
            this.recordMetric("fid", typedEntry.processingStart - entry.startTime);
          }
        });
      });
      fidObserver.observe({ entryTypes: ["first-input"] });
      this.observers.push(fidObserver);

      // Cumulative Layout Shift
      const clsObserver = new PerformanceObserver((list) => {
        let clsValue = 0;
        const entries = list.getEntries();
        entries.forEach((entry) => {
          const typedEntry = entry as PerformanceEntry & {
            hadRecentInput?: boolean;
            value?: number;
          };
          if (typedEntry.hadRecentInput === false && typedEntry.value !== undefined) {
            clsValue += typedEntry.value;
          }
        });
        this.recordMetric("cls", clsValue);
      });
      clsObserver.observe({ entryTypes: ["layout-shift"] });
      this.observers.push(clsObserver);
    }

    // First Contentful Paint
    if ("PerformanceObserver" in window) {
      const fcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const fcpEntry = entries.find((entry) => entry.name === "first-contentful-paint");
        if (fcpEntry) {
          this.recordMetric("fcp", fcpEntry.startTime);
        }
      });
      fcpObserver.observe({ entryTypes: ["paint"] });
      this.observers.push(fcpObserver);
    }
  }

  /**
   * Setup custom performance metrics
   */
  private static setupCustomMetrics() {
    // Page load time
    window.addEventListener("load", () => {
      const navigation = performance.getEntriesByType(
        "navigation"
      )[0] as PerformanceNavigationTiming;
      if (navigation) {
        this.recordMetric("pageLoadTime", navigation.loadEventEnd - navigation.fetchStart);
        this.recordMetric("ttfb", navigation.responseStart - navigation.fetchStart);
      }
    });

    // API response time monitoring
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const start = performance.now();
      try {
        const response = await originalFetch(...args);
        const end = performance.now();
        this.recordMetric("apiResponseTime", end - start);
        return response;
      } catch (_error) {
        const end = performance.now();
        this.recordMetric("apiResponseTime", end - start);
        throw _error;
      }
    };
  }

  /**
   * Setup system metrics monitoring
   */
  private static setupSystemMetrics() {
    // Memory usage
    if ("memory" in performance) {
      setInterval(() => {
        const memory = (
          performance as unknown as { memory: { usedJSHeapSize: number; totalJSHeapSize: number } }
        ).memory;
        if (memory) {
          this.recordMetric("memoryUsage", memory.usedJSHeapSize / memory.totalJSHeapSize);
        }
      }, 5000);
    }

    // Error rate monitoring
    window.addEventListener("error", () => {
      this.recordMetric("errorRate", 1);
    });

    window.addEventListener("unhandledrejection", () => {
      this.recordMetric("errorRate", 1);
    });
  }

  /**
   * Record a performance metric
   */
  static recordMetric(name: keyof PerformanceMetrics, value: number) {
    const metric: Partial<PerformanceMetrics> = {
      [name]: value,
    };

    this.metrics.push(metric as PerformanceMetrics);

    // Send to analytics service
    this.sendToAnalytics(name, value);
  }

  /**
   * Record database query time
   */
  static recordDatabaseQuery(_queryName: string, duration: number) {
    this.recordMetric("databaseQueryTime", duration);
  }

  /**
   * Record cache hit rate
   */
  static recordCacheHit(hit: boolean) {
    this.recordMetric("cacheHitRate", hit ? 1 : 0);
  }

  /**
   * Record user engagement
   */
  static recordUserEngagement(engagement: number) {
    this.recordMetric("userEngagement", engagement);
  }

  /**
   * Record conversion rate
   */
  static recordConversion(converted: boolean) {
    this.recordMetric("conversionRate", converted ? 1 : 0);
  }

  /**
   * Record bounce rate
   */
  static recordBounce(bounced: boolean) {
    this.recordMetric("bounceRate", bounced ? 1 : 0);
  }

  /**
   * Get performance summary
   */
  static getPerformanceSummary(): {
    average: Partial<PerformanceMetrics>;
    current: Partial<PerformanceMetrics>;
    trends: Record<string, number>;
  } {
    if (this.metrics.length === 0) {
      return {
        average: {
          /* Empty */
        },
        current: {
          /* Empty */
        },
        trends: {
          /* Empty */
        },
      };
    }

    const average: Partial<PerformanceMetrics> = {
      /* Empty */
    };
    const current = this.metrics[this.metrics.length - 1];
    const trends: Record<string, number> = {
      /* Empty */
    };

    // Calculate averages
    Object.keys(this.metrics[0]).forEach((key) => {
      const values = this.metrics
        .map((m) => m[key as keyof PerformanceMetrics])
        .filter((v) => v !== undefined);
      if (values.length > 0) {
        average[key as keyof PerformanceMetrics] =
          values.reduce((sum, val) => sum + val, 0) / values.length;
      }
    });

    // Calculate trends (comparing last 10% with first 10%)
    const recentCount = Math.max(1, Math.floor(this.metrics.length * 0.1));
    const recent = this.metrics.slice(-recentCount);
    const early = this.metrics.slice(0, recentCount);

    Object.keys(this.metrics[0]).forEach((key) => {
      const recentValues = recent
        .map((m) => m[key as keyof PerformanceMetrics])
        .filter((v) => v !== undefined);
      const earlyValues = early
        .map((m) => m[key as keyof PerformanceMetrics])
        .filter((v) => v !== undefined);

      if (recentValues.length > 0 && earlyValues.length > 0) {
        const recentAvg = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
        const earlyAvg = earlyValues.reduce((sum, val) => sum + val, 0) / earlyValues.length;
        trends[key] = earlyAvg > 0 ? ((recentAvg - earlyAvg) / earlyAvg) * 100 : 0;
      }
    });

    return { average, current, trends };
  }

  /**
   * Send metrics to analytics service
   */
  private static async sendToAnalytics(name: string, value: number) {
    try {
      // Send to internal analytics endpoint
      await fetch("/api/analytics/metrics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          metric: name,
          value,
          timestamp: new Date().toISOString(),
          url: window.location.href,
          userAgent: navigator.userAgent,
        }),
      });
    } catch (_error) {
      logger.warn(
        "[PERFORMANCE] Failed to send metric to analytics:",
        _error as Record<string, unknown>
      );
    }
  }

  /**
   * Get Core Web Vitals score
   */
  static getWebVitalsScore(): {
    lcp: "good" | "needs-improvement" | "poor";
    fid: "good" | "needs-improvement" | "poor";
    cls: "good" | "needs-improvement" | "poor";
    fcp: "good" | "needs-improvement" | "poor";
  } {
    const latest = this.metrics[this.metrics.length - 1];
    if (!latest) return { lcp: "good", fid: "good", cls: "good", fcp: "good" };

    const score = (value: number, thresholds: [number, number]) => {
      if (value <= thresholds[0]) return "good";
      if (value <= thresholds[1]) return "needs-improvement";
      return "poor";
    };

    return {
      lcp: score(latest.lcp || 0, [2500, 4000]),
      fid: score(latest.fid || 0, [100, 300]),
      cls: score(latest.cls || 0, [0.1, 0.25]),
      fcp: score(latest.fcp || 0, [1800, 3000]),
    };
  }

  /**
   * Cleanup observers
   */
  static cleanup() {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers = [];
  }
}

// Initialize performance monitoring when the module loads
if (typeof window !== "undefined") {
  PerformanceMonitor.initialize();
}
