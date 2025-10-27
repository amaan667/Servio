import { QueryClient } from "@tanstack/react-query";

/**
 * Global QueryClient with production-optimized settings
 *
 * ANTI-FLICKER FEATURES:
 * - Shows old data while fetching new (no loading spinners)
 * - Caches data for 10 minutes
 * - Data stays fresh for 5 minutes
 * - Doesn't refetch on every window focus/mount
 * - Silent background updates
 */
export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        // CRITICAL: Keep previous data while fetching (eliminates flicker)
        placeholderData: (previousData: unknown) => previousData,

        // Don't refetch on window focus (too aggressive)
        refetchOnWindowFocus: false,

        // Don't refetch on component mount (use cache instead)
        refetchOnMount: false,

        // Data is considered fresh for 5 minutes
        staleTime: 5 * 60 * 1000,

        // Keep unused data in cache for 10 minutes
        gcTime: 10 * 60 * 1000,

        // Retry failed requests once (silently)
        retry: 1,
        retryDelay: 1000,

        // Network mode: online only
        networkMode: "online",
      },
      mutations: {
        // Mutations always run (even if offline, will queue)
        networkMode: "online",
        retry: 0,
      },
    },
  });

// Singleton instance for client-side
let browserQueryClient: QueryClient | undefined = undefined;

export function getQueryClient() {
  if (typeof window === "undefined") {
    // Server: always create new client
    return createQueryClient();
  } else {
    // Browser: reuse existing client
    if (!browserQueryClient) {
      browserQueryClient = createQueryClient();
    }
    return browserQueryClient;
  }
}
