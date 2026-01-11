/**
 * @fileoverview Web Vitals performance tracking
 * @module lib/monitoring/web-vitals
 */

import { onCLS, onFCP, onINP, onLCP, onTTFB, Metric } from "web-vitals";
import { EnhancedErrorTracker } from "./sentry-enhanced";

export interface PerformanceMetric {
  name: string;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  delta: number;
  id: string;
  navigationType?: string;
}

/**
 * Send performance metric to analytics
 */
function sendToAnalytics(metric: Metric) {
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType,
    timestamp: Date.now(),
    url: window.location.href,
    userAgent: navigator.userAgent,
  });

  // Send to analytics endpoint
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/analytics/vitals", body);
  } else {
    fetch("/api/analytics/vitals", {
      method: "POST",
      body,
      headers: { "Content-Type": "application/json" },
      keepalive: true,
    }).catch((_error) => {
      // Web vitals sending error handled silently
    });
  }

  // Send to Sentry for monitoring
  EnhancedErrorTracker.addBreadcrumb(
    `Web Vital: ${metric.name}`,
    "performance",
    metric.rating === "good" ? "info" : metric.rating === "needs-improvement" ? "warning" : "error",
    {
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
    }
  );

  // Log poor ratings
  if (metric.rating === "poor") { /* Condition handled */ }
}

/**
 * Initialize Web Vitals tracking
 */
export function initWebVitals() {
  if (typeof window === "undefined") return;

  try {
    // Core Web Vitals
    onCLS(sendToAnalytics); // Cumulative Layout Shift
    // Note: onFID is deprecated in web-vitals v3+, use onINP instead
    onLCP(sendToAnalytics); // Largest Contentful Paint

    // Other important metrics
    onFCP(sendToAnalytics); // First Contentful Paint
    onINP(sendToAnalytics); // Interaction to Next Paint
    onTTFB(sendToAnalytics); // Time to First Byte
  } catch (_error) { /* Error handled silently */ }
}

/**
 * Performance observer for custom metrics
 */
export class PerformanceTracker {
  private static marks: Map<string, number> = new Map();

  /**
   * Mark start of a performance measurement
   */
  static mark(name: string) {
    if (typeof window === "undefined") return;

    try {
      this.marks.set(name, performance.now());
      performance.mark(name);
    } catch (_error) { /* Error handled silently */ }
  }

  /**
   * Measure and report performance
   */
  static measure(name: string, startMark: string, endMark?: string) {
    if (typeof window === "undefined") return;

    try {
      const end = endMark || `${startMark}-end`;
      performance.mark(end);

      const measure = performance.measure(name, startMark, end);

      // Send to analytics if significant
      if (measure.duration > 1000) {
        fetch("/api/analytics/vitals", {
          method: "POST",
          body: JSON.stringify({
            name: `custom-${name}`,
            value: measure.duration,
            timestamp: Date.now(),
            url: window.location.href,
          }),
          headers: { "Content-Type": "application/json" },
        }).catch(() => {
          // Silent fail
        });
      }

      return measure.duration;
    } catch (_error) {

      return null;
    }
  }

  /**
   * Measure time since mark
   */
  static measureSinceMark(markName: string): number | null {
    if (typeof window === "undefined") return null;

    const startTime = this.marks.get(markName);
    if (!startTime) return null;

    return performance.now() - startTime;
  }

  /**
   * Track page load performance
   */
  static trackPageLoad() {
    if (typeof window === "undefined") return;

    window.addEventListener("load", () => {
      setTimeout(() => {
        const perfData = performance.getEntriesByType(
          "navigation"
        )[0] as PerformanceNavigationTiming;

        if (perfData) {
          const metrics = {
            dns: perfData.domainLookupEnd - perfData.domainLookupStart,
            tcp: perfData.connectEnd - perfData.connectStart,
            ttfb: perfData.responseStart - perfData.requestStart,
            download: perfData.responseEnd - perfData.responseStart,
            domInteractive: perfData.domInteractive - perfData.fetchStart,
            domComplete: perfData.domComplete - perfData.fetchStart,
            loadComplete: perfData.loadEventEnd - perfData.fetchStart,
          };

          // Send to analytics
          fetch("/api/analytics/vitals", {
            method: "POST",
            body: JSON.stringify({
              name: "page-load",
              metrics,
              timestamp: Date.now(),
              url: window.location.href,
            }),
            headers: { "Content-Type": "application/json" },
          }).catch(() => {
            // Silent fail
          });
        }
      }, 0);
    });
  }

  /**
   * Track resource loading
   */
  static trackResources() {
    if (typeof window === "undefined") return;

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 2000) { /* Condition handled */ }
      }
    });

    observer.observe({ entryTypes: ["resource"] });
  }

  /**
   * Track long tasks (tasks taking >50ms)
   */
  static trackLongTasks() {
    if (typeof window === "undefined") return;

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {

          EnhancedErrorTracker.addBreadcrumb("Long Task", "performance", "warning", {
            duration: entry.duration,
            startTime: entry.startTime,
          });
        }
      });

      observer.observe({ entryTypes: ["longtask"] });
    } catch (_error) {
      // Long task API not supported
    }
  }
}

/**
 * Initialize all performance tracking
 */
export function initPerformanceMonitoring() {
  if (typeof window === "undefined") return;

  initWebVitals();
  PerformanceTracker.trackPageLoad();
  PerformanceTracker.trackResources();
  PerformanceTracker.trackLongTasks();
}
