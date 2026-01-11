"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { getCachedQueryData } from "@/lib/persistent-cache";

interface PrefetchLinkProps {

  }[];
}

/**
 * Link component with automatic prefetching
 *
 * Features:
 * - Prefetches route on hover
 * - Prefetches data queries on hover
 * - Uses cached data if available
 * - Makes navigation instant
 */
export function PrefetchLink({
  href,
  children,
  className,
  prefetchQueries = [],
}: PrefetchLinkProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const handleMouseEnter = () => {
    // Prefetch the route
    router.prefetch(href);

    // Prefetch associated queries
    prefetchQueries.forEach(({ queryKey, queryFn }) => {
      // Check if already cached
      const cachedData = getCachedQueryData(queryKey);

      if (!cachedData) {
        // Not cached, prefetch it
        queryClient.prefetchQuery({
          queryKey,
          queryFn,

      }

  };

  return (
    <Link href={href} className={className} onMouseEnter={handleMouseEnter}>
      {children}
    </Link>
  );
}

/**
 * Prefetch utility for programmatic use
 */
export function usePrefetch() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return {

    },
    prefetchQuery: (queryKey: string[], queryFn: () => Promise<unknown>) => {
      const cachedData = getCachedQueryData(queryKey);
      if (!cachedData) {
        queryClient.prefetchQuery({ queryKey, queryFn });
      }
    },
  };
}
