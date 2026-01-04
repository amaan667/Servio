#!/usr/bin/env node
/**
 * Performance Testing Script
 * Run this in browser console to test loading times
 */

// Copy-paste this into browser console (F12) when on dashboard page

// Method 1: Simple console timing
console.log("=== Performance Test Started ===");

// Test page load
if (window.performance && window.performance.timing) {
  const perf = window.performance.timing;
  const metrics = {
    "DNS Lookup": perf.domainLookupEnd - perf.domainLookupStart,
    "TCP Connect": perf.connectEnd - perf.connectStart,
    "Server Response (TTFB)": perf.responseStart - perf.requestStart,
    "Download Time": perf.responseEnd - perf.responseStart,
    "DOM Processing": perf.domComplete - perf.domInteractive,
    "Page Load Total": perf.loadEventEnd - perf.fetchStart,
  };

  console.table(metrics);
}

// Method 2: Navigation Timing API (modern)
if (window.performance && window.performance.getEntriesByType) {
  const navigation = performance.getEntriesByType("navigation")[0];
  if (navigation) {
    const navMetrics = {
      DNS: (navigation.domainLookupEnd - navigation.domainLookupStart).toFixed(2) + "ms",
      TCP: (navigation.connectEnd - navigation.connectStart).toFixed(2) + "ms",
      TTFB: (navigation.responseStart - navigation.requestStart).toFixed(2) + "ms",
      Download: (navigation.responseEnd - navigation.responseStart).toFixed(2) + "ms",
      "DOM Interactive": (navigation.domInteractive - navigation.fetchStart).toFixed(2) + "ms",
      "DOM Complete": (navigation.domComplete - navigation.fetchStart).toFixed(2) + "ms",
      "Load Complete": (navigation.loadEventEnd - navigation.fetchStart).toFixed(2) + "ms",
    };
    console.table(navMetrics);
  }
}

// Method 3: Measure RPC call (paste this before navigating)
window.__perfMark = performance.now();
window.addEventListener("load", () => {
  const loadTime = performance.now() - window.__perfMark;
  console.log(`📊 Page Load: ${loadTime.toFixed(2)}ms`);
});

console.log("=== Performance Test Complete ===");
console.log("💡 Tip: Open DevTools > Network tab to see individual request times");
console.log("💡 Tip: Open DevTools > Performance tab and click Record to profile");
