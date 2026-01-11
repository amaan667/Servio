import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";

/**
 * Hook for intelligent prefetching of routes and data
 * Improves perceived performance by loading resources before they're needed
 */
export function usePrefetch() {
  const router = useRouter();

  const prefetchRoute = useCallback(
    (href: string) => {
      if (typeof window !== "undefined") {
        router.prefetch(href);
      }
    },
    [router]
  );

  const prefetchOnHover = useCallback(
    (href: string) => {
      const handleMouseEnter = () => {
        prefetchRoute(href);
      };

      return handleMouseEnter;
    },
    [prefetchRoute]
  );

  return {
    prefetchRoute,
    prefetchOnHover,
  };
}

/**
 * Hook for prefetching dashboard routes based on user behavior
 */
export function useDashboardPrefetch(venueId: string) {
  const { prefetchRoute } = usePrefetch();

  useEffect(() => {
    if (!venueId) return;

    // Prefetch common dashboard routes
    const routesToPrefetch = [
      `/dashboard/${venueId}/tables`,
      `/dashboard/${venueId}/menu-management`,
      `/dashboard/${venueId}/live-orders`,
      `/dashboard/${venueId}/analytics`,
      `/dashboard/${venueId}/staff`,
    ];

    // Prefetch routes after a short delay to not block initial load
    const timeoutId = setTimeout(() => {
      routesToPrefetch.forEach((route) => {
        prefetchRoute(route);

    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [venueId, prefetchRoute]);
}
