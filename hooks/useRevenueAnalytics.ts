/**
 * Revenue Analytics Hook
 * Provides revenue-specific analytics data fetching
 */

import { useAnalytics } from "./useAnalytics";
import { DateRangePreset, AnalyticsFilters, RevenueAnalytics } from "@/lib/analytics/types";

interface UseRevenueAnalyticsOptions {
  venueId: string;
  preset?: DateRangePreset;
  startDate?: Date;
  endDate?: Date;
  autoFetch?: boolean;
  refetchInterval?: number;
}

export function useRevenueAnalytics(options: UseRevenueAnalyticsOptions) {
  const { venueId, preset = "last_30_days", startDate, endDate, autoFetch = true, refetchInterval } = options;

  const filters: Partial<AnalyticsFilters> = {
    venueId,
    dateRange: {
      start: startDate || new Date(),
      end: endDate || new Date(),
      preset,
    },
  };

  const endpoint = "/api/analytics/revenue";

  const analytics = useAnalytics<RevenueAnalytics>({
    endpoint,
    filters,
    autoFetch,
    refetchInterval,
  });

  // Computed values
  const totalRevenue = analytics.data?.totalRevenue || 0;
  const averageOrderValue = analytics.data?.averageOrderValue || 0;
  const revenueGrowth = analytics.data?.revenueGrowth || 0;
  const dailyBreakdown = analytics.data?.dailyBreakdown || [];

  return {
    ...analytics,
    totalRevenue,
    averageOrderValue,
    revenueGrowth,
    dailyBreakdown,
  };
}

/**
 * Hook for today's revenue
 */
export function useTodayRevenue(venueId: string) {
  const endpoint = "/api/analytics/revenue";

  const filters: Partial<AnalyticsFilters> = {
    venueId,
    dateRange: {
      start: new Date(new Date().setHours(0, 0, 0, 0)),
      end: new Date(),
      preset: "today",
    },
  };

  return useAnalytics<RevenueAnalytics>({
    endpoint,
    filters,
    autoFetch: true,
    refetchInterval: 60000, // Refresh every minute
  });
}

/**
 * Hook for monthly revenue comparison
 */
export function useMonthlyRevenue(venueId: string) {
  const endpoint = "/api/analytics/revenue";

  const filters: Partial<AnalyticsFilters> = {
    venueId,
    dateRange: {
      start: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      end: new Date(),
      preset: "this_month",
    },
  };

  return useAnalytics<RevenueAnalytics>({
    endpoint,
    filters,
    autoFetch: true,
    refetchInterval: 300000, // Refresh every 5 minutes
  });
}
