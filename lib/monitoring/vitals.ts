/**
 * Web Vitals monitoring for production
 * Tracks Core Web Vitals: LCP, FID, CLS, FCP, TTFB
 */

import type { Metric } from "web-vitals";
import { logger } from "@/lib/logger";

const vitalsUrl = "/api/vitals";

function sendToAnalytics(metric: Metric) {
  if (typeof window === "undefined") return;

  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType,
    url: window.location.href,
    timestamp: Date.now(),
  });

  // Use `navigator.sendBeacon()` if available, falling back to `fetch()`
  if (navigator.sendBeacon) {
    navigator.sendBeacon(vitalsUrl, body);
  } else {
    fetch(vitalsUrl, {
      body,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
    }).catch(console.error);
  }
}

export function reportWebVitals(metric: Metric) {
  // Log to console in development
  if (process.env.NODE_ENV === "development") {
    // Development logging handled elsewhere
  }

  // Send to analytics in production
  if (process.env.NODE_ENV === "production") {
    sendToAnalytics(metric);
  }
}
