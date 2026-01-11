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

        // Don't refetch on window focus (too aggressive)

        // Don't refetch on component mount (use cache instead)

        // Data is considered fresh for 5 minutes

        // Keep unused data in cache for 10 minutes

        // Retry failed requests once (silently)

        // Network mode: online only

      },

        // Mutations always run (even if offline, will queue)

      },
    },

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
