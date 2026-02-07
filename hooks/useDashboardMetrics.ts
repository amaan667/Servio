/**
 * useDashboardMetrics Hook
 *
 * React hook for fetching and managing dashboard metrics data
 */

import { useState, useEffect, useCallback } from "react";
import { DashboardMetrics } from "@/lib/analytics/types";

export interface UseDashboardMetricsOptions {
  venueId: string;
  refreshInterval?: number; // in milliseconds
  enabled?: boolean;
}

export interface UseDashboardMetricsReturn {
  metrics: DashboardMetrics | null;
  isLoading: boolean;
  error: Error | null;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
}

export function useDashboardMetrics(
  options: UseDashboardMetricsOptions
): UseDashboardMetricsReturn {
  const { venueId, refreshInterval = 60000, enabled = true } = options;

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchMetrics = useCallback(async () => {
    if (!enabled || !venueId) return;

    try {
      const response = await fetch(`/api/analytics/dashboard?venueId=${venueId}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Transform API response to DashboardMetrics format
      const dashboardMetrics: DashboardMetrics = {
        activeOrders: data.activeOrders || 0,
        pendingOrders: data.pendingOrders || 0,
        todayRevenue: data.todayRevenue || 0,
        todayOrders: data.todayOrders || 0,
        periodRevenue: data.periodRevenue || 0,
        periodOrders: data.periodOrders || 0,
        periodAverageOrderValue: data.periodAverageOrderValue || 0,
        periodGrowth: data.periodGrowth || 0,
        quickStats: data.quickStats || [],
        alerts: data.alerts || [],
      };

      setMetrics(dashboardMetrics);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      console.error("[useDashboardMetrics] Failed to fetch metrics:", error);
    } finally {
      setIsLoading(false);
    }
  }, [venueId, enabled]);

  // Initial fetch
  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    fetchMetrics();
  }, [venueId, enabled, fetchMetrics]);

  // Auto-refresh interval
  useEffect(() => {
    if (!enabled || !refreshInterval) return;

    const interval = setInterval(fetchMetrics, refreshInterval);
    return () => clearInterval(interval);
  }, [venueId, enabled, refreshInterval, fetchMetrics]);

  return {
    metrics,
    isLoading,
    error,
    lastUpdated,
    refresh: fetchMetrics,
  };
}

/**
 * Calculate dashboard summary from metrics
 */
export function calculateDashboardSummary(metrics: DashboardMetrics | null) {
  if (!metrics) {
    return {
      todayRevenue: "$0.00",
      todayOrders: 0,
      activeOrders: 0,
      pendingOrders: 0,
    };
  }

  return {
    todayRevenue: `$${metrics.todayRevenue.toFixed(2)}`,
    todayOrders: metrics.todayOrders,
    activeOrders: metrics.activeOrders,
    pendingOrders: metrics.pendingOrders,
  };
}
