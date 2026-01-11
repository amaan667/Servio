"use client";

import { useEffect } from "react";
import { onCLS, onINP, onFCP, onLCP, onTTFB, Metric } from "web-vitals";

export function WebVitals() {
  useEffect(() => {
    const reportMetric = (metric: Metric) => {
      // Send to analytics endpoint with keepalive to prevent socket errors
      // Use sendBeacon if available, fallback to fetch with keepalive
      const data = JSON.stringify(metric);

      if (navigator.sendBeacon) {
        // sendBeacon is more reliable for analytics
        const blob = new Blob([data], { type: "application/json" });
        navigator.sendBeacon("/api/analytics/vitals", blob);
      } else {
        // Fallback to fetch with keepalive flag
        fetch("/api/analytics/vitals", {

          headers: { "Content-Type": "application/json" },

          keepalive: true, // Prevents ERR_SOCKET_NOT_CONNECTED
        }).catch(() => {
          // Silently fail if analytics endpoint is down

      }
    };

    onCLS(reportMetric);
    onINP(reportMetric);
    onFCP(reportMetric);
    onLCP(reportMetric);
    onTTFB(reportMetric);
  }, []);

  return null;
}
