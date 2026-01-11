#!/usr/bin/env node
/**
 * Bundle Size Analyzer
 * Run in browser console to see what's actually downloading
 */

// Run this in browser console to analyze bundle sizes

// Get all resources
const resources = performance.getEntriesByType("resource");

// Group by type
const byType = {};
resources.forEach((r) => {
  const type = r.initiatorType || "other";
  if (!byType[type]) byType[type] = [];
  byType[type].push(r);
});

// Show largest resources overall

const sorted = resources.sort((a, b) => (b.transferSize || 0) - (a.transferSize || 0)).slice(0, 10);

sorted.forEach((r, i) => {
  const size = (r.transferSize / 1024).toFixed(2);
  const duration = r.duration.toFixed(2);
  const name = r.name.split("/").pop() || r.name;
});

Object.keys(byType).forEach((type) => {
  const items = byType[type];
  const totalSize = items.reduce((sum, r) => sum + (r.transferSize || 0), 0);
  const totalTime = items.reduce((sum, r) => sum + r.duration, 0);

  // Show top 3 for this type
  const top3 = items.sort((a, b) => (b.transferSize || 0) - (a.transferSize || 0)).slice(0, 3);
  top3.forEach((r) => {
    const size = (r.transferSize / 1024).toFixed(2);
    const name = r.name.split("/").pop() || r.name;
  });
});

// Show vendor chunks specifically

const vendorChunks = resources
  .filter((r) => r.name.includes("_next/static/chunks") && r.name.includes("vendor"))
  .sort((a, b) => (b.transferSize || 0) - (a.transferSize || 0));

if (vendorChunks.length > 0) {
  vendorChunks.forEach((r) => {
    const size = (r.transferSize / 1024).toFixed(2);
    const duration = r.duration.toFixed(2);
    const name = r.name.split("/").pop() || r.name;
  });
} else {
  /* Else case handled */
}

// Show CSS files

const cssFiles = resources
  .filter((r) => r.name.includes(".css"))
  .sort((a, b) => (b.transferSize || 0) - (a.transferSize || 0));

cssFiles.forEach((r) => {
  const size = (r.transferSize / 1024).toFixed(2);
  const duration = r.duration.toFixed(2);
  const name = r.name.split("/").pop() || r.name;
});

// Calculate totals
const totalJS = resources
  .filter((r) => r.name.includes(".js") || r.name.includes("chunks"))
  .reduce((sum, r) => sum + (r.transferSize || 0), 0);
const totalCSS = resources
  .filter((r) => r.name.includes(".css"))
  .reduce((sum, r) => sum + (r.transferSize || 0), 0);
const totalOther = resources
  .filter((r) => !r.name.includes(".js") && !r.name.includes(".css") && !r.name.includes("chunks"))
  .reduce((sum, r) => sum + (r.transferSize || 0), 0);
