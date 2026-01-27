"use client";

import { useEffect, useState } from "react";
import { PerformanceMonitor, type PerformanceMetrics } from "@/lib/analytics/performance-monitor";

interface Summary {
  average: Partial<PerformanceMetrics>;
  current: Partial<PerformanceMetrics>;
  trends: Record<string, number>;
}

export default function PerformanceDebugPage() {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    // Ensure monitoring is initialised on the client
    PerformanceMonitor.initialize();

    const interval = setInterval(() => {
      const s = PerformanceMonitor.getPerformanceSummary();
      setSummary(s);
    }, 5000);

    // Take an immediate snapshot as well
    setSummary(PerformanceMonitor.getPerformanceSummary());

    return () => clearInterval(interval);
  }, []);

  if (!summary) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-gray-500">Collecting performance metrics…</p>
      </div>
    );
  }

  const { average, current, trends } = summary;

  const metricEntries = Object.keys({
    ...average,
    ...current,
  }) as (keyof PerformanceMetrics)[];

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-gray-900">Performance Debug Dashboard</h1>
          <p className="mt-2 text-sm text-gray-600">
            Live snapshot of client-side performance metrics (Core Web Vitals + custom metrics).
          </p>
        </header>

        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">Metrics</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 pr-4 text-left font-medium text-gray-700">Metric</th>
                  <th className="py-2 pr-4 text-left font-medium text-gray-700">Current</th>
                  <th className="py-2 pr-4 text-left font-medium text-gray-700">Average</th>
                  <th className="py-2 pr-4 text-left font-medium text-gray-700">Trend (%)</th>
                </tr>
              </thead>
              <tbody>
                {metricEntries.map((key) => {
                  const currentValue = current[key];
                  const avgValue = average[key];
                  const trend = trends[key] ?? 0;

                  return (
                    <tr key={key} className="border-b last:border-0">
                      <td className="py-2 pr-4 text-gray-800">{key}</td>
                      <td className="py-2 pr-4 text-gray-900">
                        {currentValue !== undefined ? currentValue.toFixed(2) : "—"}
                      </td>
                      <td className="py-2 pr-4 text-gray-900">
                        {avgValue !== undefined ? avgValue.toFixed(2) : "—"}
                      </td>
                      <td className="py-2 pr-4">
                        <span
                          className={
                            trend > 0
                              ? "text-red-600"
                              : trend < 0
                              ? "text-green-600"
                              : "text-gray-500"
                          }
                        >
                          {trend.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <p className="text-xs text-gray-500">
          This page is intended for internal debugging and UX optimisation (LCP, FID, CLS, etc.). Do
          not expose it to end users.
        </p>
      </div>
    </div>
  );
}

