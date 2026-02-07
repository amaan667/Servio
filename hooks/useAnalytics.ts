/**
 * Generic Analytics Hook
 * Provides reusable analytics data fetching with caching and automatic refetching
 */

import { useState, useEffect, useCallback } from "react";
import { DateRangePreset, AnalyticsFilters } from "@/lib/analytics/types";

interface UseAnalyticsOptions<T> {
  endpoint: string;
  filters?: Partial<AnalyticsFilters>;
  autoFetch?: boolean;
  refetchInterval?: number;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

interface UseAnalyticsReturn<T> {
  data: T | null;
  isLoading: boolean;
  isError: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  isRefetching: boolean;
}

export function useAnalytics<T>(options: UseAnalyticsOptions<T>): UseAnalyticsReturn<T> {
  const { endpoint, filters, autoFetch = true, refetchInterval, onSuccess, onError } = options;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(autoFetch);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRefetching, setIsRefetching] = useState(false);

  const buildUrl = useCallback(() => {
    const params = new URLSearchParams();

    if (filters?.dateRange?.preset) {
      params.set("preset", filters.dateRange.preset);
    } else if (filters?.dateRange?.start && filters?.dateRange?.end) {
      params.set("startDate", filters.dateRange.start.toISOString());
      params.set("endDate", filters.dateRange.end.toISOString());
    }

    if (filters?.venueId) {
      params.set("venueId", filters.venueId);
    }

    const queryString = params.toString();
    return queryString ? `${endpoint}?${queryString}` : endpoint;
  }, [endpoint, filters]);

  const fetchData = useCallback(async () => {
    const url = buildUrl();

    try {
      if (!isLoading) {
        setIsRefetching(true);
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setData(result.data);
        setIsError(false);
        setError(null);
        onSuccess?.(result.data);
      } else {
        throw new Error(result.error || "Failed to fetch analytics");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      setIsError(true);
      setError(errorMessage);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
    } finally {
      setIsLoading(false);
      setIsRefetching(false);
    }
  }, [buildUrl, onSuccess, onError, isLoading]);

  // Initial fetch
  useEffect(() => {
    if (autoFetch) {
      fetchData();
    }
  }, [autoFetch, fetchData]);

  // Auto refetch interval
  useEffect(() => {
    if (!refetchInterval) return;

    const interval = setInterval(() => {
      fetchData();
    }, refetchInterval);

    return () => clearInterval(interval);
  }, [refetchInterval, fetchData]);

  return {
    data,
    isLoading,
    isError,
    error,
    refetch: fetchData,
    isRefetching,
  };
}

/**
 * Hook options helper for common date range presets
 */
export function useAnalyticsWithPreset<T>(
  endpoint: string,
  preset: DateRangePreset,
  venueId: string,
  options?: Omit<UseAnalyticsOptions<T>, "endpoint" | "filters">
): UseAnalyticsReturn<T> {
  const filters: Partial<AnalyticsFilters> = {
    dateRange: {
      start: new Date(),
      end: new Date(),
      preset,
    },
    venueId,
  };

  return useAnalytics<T>({
    endpoint,
    filters,
    ...options,
  });
}
