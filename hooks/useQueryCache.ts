import { useState, useEffect, useCallback, useRef } from "react";

interface CacheEntry<T> {

}

interface QueryOptions {
  staleTime?: number; // Time before data becomes stale (default: 5 minutes)
  cacheTime?: number; // Time before cache entry is removed (default: 10 minutes)
  refetchOnWindowFocus?: boolean;
}

/**
 * High-performance query cache hook for API data
 * Provides intelligent caching, background updates, and stale-while-revalidate pattern
 */
export function useQueryCache<T>(

  }
) {
  const {
    staleTime = 5 * 60 * 1000, // 5 minutes
    cacheTime = 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus = true,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const cacheRef = useRef<Map<string, CacheEntry<T>>>(new Map());
  const fetcherRef = useRef(fetcher);

  // Update fetcher ref when it changes
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const fetchData = useCallback(
    async (forceRefresh = false) => {
      const now = Date.now();
      const cacheEntry = cacheRef.current.get(key);

      // Return cached data if it's still fresh and not forcing refresh
      if (!forceRefresh && cacheEntry && now < cacheEntry.expiresAt) {
        setData(cacheEntry.data);
        setIsLoading(false);
        setError(null);

        // Background refetch if data is stale
        if (now > cacheEntry.timestamp + staleTime) {
          fetchData(true);
        }
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const result = await fetcherRef.current();
        const newCacheEntry: CacheEntry<T> = {

        };

        cacheRef.current.set(key, newCacheEntry);
        setData(result);
      } catch (_err) {
        setError(_err instanceof Error ? _err : new Error("Unknown error"));
        // Return stale data if available
        if (cacheEntry) {
          setData(cacheEntry.data);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [key, staleTime, cacheTime]
  );

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refetch on window focus
  useEffect(() => {
    if (!refetchOnWindowFocus) return;

    const handleFocus = () => {
      fetchData(true);
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [fetchData, refetchOnWindowFocus]);

  // Cleanup expired cache entries
  useEffect(() => {
    const cleanup = () => {
      const now = Date.now();
      for (const [cacheKey, entry] of cacheRef.current.entries()) {
        if (now > entry.expiresAt) {
          cacheRef.current.delete(cacheKey);
        }
      }
    };

    const interval = setInterval(cleanup, 60000); // Cleanup every minute
    return () => clearInterval(interval);
  }, []);

  const refetch = useCallback(() => fetchData(true), [fetchData]);

  return {
    data,
    isLoading,
    error,
    refetch,

  };
}
