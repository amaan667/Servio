/**
 * Performance Metrics API
 * Returns real-time performance metrics
 */

import { NextResponse } from "next/server";
import { performanceMonitor } from "@/lib/monitoring/performance";
import { apiErrors } from "@/lib/api/standard-response";

export async function GET() {
  try {
    const summary = performanceMonitor.getSummary();

    // Calculate metrics
    const endpoints = Object.entries(summary).map(([endpoint, stats]) => ({
      endpoint,
      avgTime: Math.round(stats.avg),
      count: stats.count,
      errorRate: 0, // Error tracking not yet implemented in summary
    }));

    // Calculate overall response times
    const allP95s = Object.values(summary).map((s) => s.p95);
    const sortedP95s = allP95s.sort((a, b) => a - b);
    const p50 = sortedP95s[Math.floor(sortedP95s.length * 0.5)] || 0;
    const p95 = sortedP95s[Math.floor(sortedP95s.length * 0.95)] || 0;
    const p99 = sortedP95s[Math.floor(sortedP95s.length * 0.99)] || 0;

    const totalRequests = Object.values(summary).reduce((sum, s) => sum + s.count, 0);
    const errorRate = 0; // Error tracking not yet implemented

    return NextResponse.json({
      apiResponseTime: { p50, p95, p99 },
      errorRate,
      requestCount: totalRequests,
      endpointStats: endpoints,
      timestamp: new Date().toISOString(),
    });
  } catch (_error) {
    return apiErrors.internal("Failed to fetch performance metrics");
  }
}
