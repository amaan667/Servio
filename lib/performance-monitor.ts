/**
 * Performance monitoring utilities for Real User Monitoring (RUM)
 * and Core Web Vitals tracking
 */

import React from "react";

interface PerformanceMetric {

}

interface WebVitalsMetric {

}

interface PerformanceData {

}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private webVitals: WebVitalsMetric[] = [];
  private isEnabled: boolean = true;
  private endpoint: string = "/api/performance";

  constructor() {
    if (typeof window === "undefined") return;
    this.initializeMonitoring();
  }

  private initializeMonitoring() {
    // Monitor Core Web Vitals
    this.observeWebVitals();

    // Monitor custom performance metrics
    this.observeCustomMetrics();

    // Monitor page load performance
    this.observePageLoad();

    // Monitor resource loading
    this.observeResources();

    // Monitor long tasks
    this.observeLongTasks();
  }

  private observeWebVitals() {
    // First Contentful Paint (FCP)
    this.observeMetric("FCP", (entry) => {
      this.recordWebVital("FCP", entry.startTime);

    // Largest Contentful Paint (LCP)
    this.observeMetric("LCP", (entry) => {
      this.recordWebVital("LCP", entry.startTime);

    // First Input Delay (FID)
    this.observeMetric("FID", (entry) => {
      interface FIDEntry extends PerformanceEntry {

      }
      this.recordWebVital("FID", (entry as FIDEntry).processingStart - entry.startTime);

    // Cumulative Layout Shift (CLS)
    this.observeMetric("CLS", (entry) => {
      interface CLSEntry extends PerformanceEntry {

      }
      this.recordWebVital("CLS", (entry as CLSEntry).value);

    // Time to First Byte (TTFB)
    this.observeNavigationTiming();
  }

  private observeMetric(name: string, callback: (entry: PerformanceEntry) => void) {
    if ("PerformanceObserver" in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            callback(entry);
          }

        observer.observe({ entryTypes: [name.toLowerCase()] });
      } catch (_error) {
        // Error handled silently
      }
    }
  }

  private observeNavigationTiming() {
    if ("PerformanceObserver" in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === "navigation") {
              const navEntry = entry as PerformanceNavigationTiming;
              const ttfb = navEntry.responseStart - navEntry.requestStart;
              this.recordWebVital("TTFB", ttfb);
            }
          }

        observer.observe({ entryTypes: ["navigation"] });
      } catch (_error) {
        // Error handled silently
      }
    }
  }

  private observeCustomMetrics() {
    // Monitor component render times
    this.observeComponentPerformance();

    // Monitor API response times
    this.observeAPIPerformance();

    // Monitor user interactions
    this.observeUserInteractions();
  }

  private observeComponentPerformance() {
    // Monitor React component render times
    if (typeof window !== "undefined" && window.React) {
      const originalCreateElement = window.React.createElement;
      window.React.createElement = ((...args: Parameters<typeof originalCreateElement>) => {
        const start = performance.now();
        const result = originalCreateElement.apply(window.React, args);
        const end = performance.now();

        this.recordCustomMetric("component-render", end - start, {
          component: (args[0] as { name?: string })?.name || "Unknown",

        return result;
      }) as typeof originalCreateElement;
    }
  }

  private observeAPIPerformance() {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const start = performance.now();
      const url = args[0]?.toString() || "unknown";

      try {
        const response = await originalFetch(...args);
        const end = performance.now();

        this.recordCustomMetric("api-response-time", end - start, {
          url,

          method: (args[1] as { method?: string })?.method || "GET",

        return response;
      } catch (_error) {
        const end = performance.now();
        this.recordCustomMetric("api-error", end - start, {
          url,

        throw _error;
      }
    };
  }

  private observeUserInteractions() {
    // Monitor click interactions
    document.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      const start = performance.now();

      setTimeout(() => {
        const end = performance.now();
        this.recordCustomMetric("user-interaction", end - start, {

      }, 0);

    // Monitor scroll performance
    let scrollTimeout: NodeJS.Timeout;
    window.addEventListener("scroll", () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        this.recordCustomMetric("scroll-performance", 0, {

      }, 100);

  }

  private observePageLoad() {
    window.addEventListener("load", () => {
      const navigation = performance.getEntriesByType(
        "navigation"
      )[0] as PerformanceNavigationTiming;

      if (navigation) {
        this.recordCustomMetric("page-load-time", navigation.loadEventEnd - navigation.fetchStart);
        this.recordCustomMetric(
          "dom-content-loaded",
          navigation.domContentLoadedEventEnd - navigation.fetchStart
        );
        this.recordCustomMetric(
          "dom-interactive",
          navigation.domInteractive - navigation.fetchStart
        );
      }

  }

  private observeResources() {
    if ("PerformanceObserver" in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === "resource") {
              const resourceEntry = entry as PerformanceResourceTiming;
              this.recordCustomMetric("resource-load-time", resourceEntry.duration, {

            }
          }

        observer.observe({ entryTypes: ["resource"] });
      } catch (_error) {
        // Error handled silently
      }
    }
  }

  private observeLongTasks() {
    if ("PerformanceObserver" in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.recordCustomMetric("long-task", entry.duration, {

          }

        observer.observe({ entryTypes: ["longtask"] });
      } catch (_error) {
        // Error handled silently
      }
    }
  }

  private recordWebVital(name: WebVitalsMetric["name"], value: number) {
    const metric: WebVitalsMetric = {
      name,
      value,

    };

    this.webVitals.push(metric);
    this.sendMetric(metric);
  }

  private recordCustomMetric(name: string, value: number, metadata?: Record<string, unknown>) {
    const metric: PerformanceMetric = {
      name,
      value,

      ...metadata,
    };

    this.metrics.push(metric);
    this.sendMetric(metric);
  }

  private sendMetric(metric: PerformanceMetric | WebVitalsMetric) {
    if (!this.isEnabled) return;

    // Send to analytics endpoint
    fetch(this.endpoint, {

      },

        connection:
          (navigator as { connection?: { effectiveType?: string } }).connection?.effectiveType ||
          "unknown",
        deviceMemory: (navigator as { deviceMemory?: number }).deviceMemory,

      }),
    }).catch((_error) => {
      /* Empty */

  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  public getMetrics(): PerformanceData {
    return {

      connection:
        (navigator as { connection?: { effectiveType?: string } }).connection?.effectiveType ||
        "unknown",
      deviceMemory: (navigator as { deviceMemory?: number }).deviceMemory,

    };
  }

  public setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }

  public setEndpoint(endpoint: string) {
    this.endpoint = endpoint;
  }
}

// Singleton instance
let performanceMonitor: PerformanceMonitor | null = null;

export function getPerformanceMonitor(): PerformanceMonitor {
  if (!performanceMonitor && typeof window !== "undefined") {
    performanceMonitor = new PerformanceMonitor();
  }
  return performanceMonitor!;
}

// React hook for performance monitoring
export function usePerformanceMonitor() {
  const [metrics, setMetrics] = React.useState<PerformanceData | null>(null);

  React.useEffect(() => {
    const monitor = getPerformanceMonitor();

    // Get current metrics
    setMetrics(monitor.getMetrics());

    // Update metrics every 30 seconds
    const interval = setInterval(() => {
      setMetrics(monitor.getMetrics());
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return metrics;
}

export default PerformanceMonitor;
