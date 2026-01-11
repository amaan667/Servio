/**
 * Web Vitals monitoring for production
 * Tracks Core Web Vitals: LCP, FID, CLS, FCP, TTFB
 */

import type { Metric } from "web-vitals";

const vitalsUrl = "/api/vitals";

function sendToAnalytics(metric: Metric) {
  if (typeof window === "undefined") return;

  const body = JSON.stringify({

  // Use `navigator.sendBeacon()` if available, falling back to `fetch()`
  if (navigator.sendBeacon) {
    navigator.sendBeacon(vitalsUrl, body);
  } else {
    fetch(vitalsUrl, {
      body,

      headers: { "Content-Type": "application/json" },

    }).catch((error) => {

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
