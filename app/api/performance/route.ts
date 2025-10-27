/**
 * Performance Metrics API
 * Returns real-time performance metrics
 */

import { NextResponse } from "next/server";
import { performanceMonitor } from "@/lib/monitoring/performance";

export async function GET() {
  try {
    const summary = performanceMonitor.getSummary();

    // Calculate metrics
    const endpoints = Object.entries(summary).map(([endpoint, stats]) => ({
      endpoint,
      avgTime: Math.round(stats.avg),
      count: stats.count,
      errorRate: stats.count > 0 ? (stats.errors / stats.count) * 100 : 0,
    }));

    // Calculate overall response times
    const allTimes = Object.values(summary).flatMap((s) => s.times || []);
    const sortedTimes = allTimes.sort((a, b) => a - b);
    const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)] || 0;
    const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)] || 0;
    const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)] || 0;

    const totalRequests = Object.values(summary).reduce((sum, s) => sum + s.count, 0);
    const totalErrors = Object.values(summary).reduce((sum, s) => sum + s.errors, 0);
    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

    return NextResponse.json({
      apiResponseTime: { p50, p95, p99 },
      errorRate,
      requestCount: totalRequests,
      endpointStats: endpoints,
      timestamp: new Date().toISOString(),
    });
  } catch (_error) {
    return NextResponse.json({ error: "Failed to fetch performance metrics" }, { status: 500 });
  }
}
