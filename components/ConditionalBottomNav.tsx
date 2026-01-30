"use client";

import { usePathname } from "next/navigation";
import GlobalBottomNav from "./GlobalBottomNav";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { getRealtimeChannelName } from "@/lib/realtime-device-id";
import { useEffect, useState } from "react";
import { getCachedCounts, setCachedCounts, isCacheFresh } from "@/lib/cache/count-cache";

export default function ConditionalBottomNav() {
  const pathname = usePathname();
  const [venueId, setVenueId] = useState<string | null>(null);
  const [counts, setCounts] = useState({
    live_orders: 0,
    total_orders: 0,
    notifications: 0,
  });

  // Don't show bottom nav on customer-facing pages, auth pages, or home page
  const isCustomerOrderPage = pathname?.startsWith("/order");
  const isPaymentPage = pathname?.startsWith("/payment");
  const isOrderSummaryPage = pathname?.startsWith("/order-summary");
  const isOrderTrackingPage = pathname?.startsWith("/order-tracking");
  const isHomePage = pathname === "/";
  const isAuthPage =
    pathname?.startsWith("/sign-in") ||
    pathname?.startsWith("/sign-up") ||
    pathname?.startsWith("/auth");
  const isCompleteProfilePage = pathname?.startsWith("/complete-profile");

  const shouldHide =
    isCustomerOrderPage ||
    isPaymentPage ||
    isOrderSummaryPage ||
    isOrderTrackingPage ||
    isHomePage ||
    isAuthPage ||
    isCompleteProfilePage;

  // Get venue ID from pathname and set up real-time updates - MUST be called before unknown returns
  useEffect(() => {
    const venueIdFromPath = pathname?.match(/\/dashboard\/([^/]+)/)?.[1];
    if (!venueIdFromPath) return;

    setVenueId(venueIdFromPath);

    let isMounted = true;
    let debounceTimeout: NodeJS.Timeout | null = null;

    // Load counts for the venue - use cache to prevent unnecessary refreshes
    const loadCounts = async (forceRefresh = false) => {
      if (!isMounted) return;

      // Always hydrate from cache first if available, but never skip the network fetch
      // This ensures we never get stuck showing stale counts from a "fresh" cache
      if (!forceRefresh) {
        const cached = getCachedCounts(venueIdFromPath);
        if (cached && isCacheFresh(venueIdFromPath)) {
          setCounts({
            live_orders: cached.live_count || 0,
            total_orders: cached.today_orders_count || 0,
            notifications: 0,
          });
        }
      }

      try {
        const params = new URLSearchParams({
          venueId: venueIdFromPath,
          tz: "Europe/London",
          live_window_mins: "30",
        });
        const res = await fetch(`/api/dashboard/counts?${params.toString()}`, {
          credentials: "include",
          headers: { Accept: "application/json" },
        });

        if (!isMounted) return;

        const body = res.ok ? await res.json() : null;
        const data = body?.data ?? body;
        if (data) {
          const countsData = {
            live_orders: ((data as Record<string, unknown>).live_count as number) || 0,
            total_orders: ((data as Record<string, unknown>).today_orders_count as number) || 0,
            notifications: 0,
          };
          setCounts(countsData);

          if (data && typeof data === "object") {
            setCachedCounts(
              venueIdFromPath,
              data as {
                live_count?: number;
                earlier_today_count?: number;
                history_count?: number;
                today_orders_count?: number;
                active_tables_count?: number;
                tables_set_up?: number;
                tables_in_use?: number;
                tables_reserved_now?: number;
                in_use_now?: number;
                reserved_now?: number;
                reserved_later?: number;
                waiting?: number;
              }
            );
          }
        }
      } catch (_error) {
        // Silent error handling - use cached data if available
        const cached = getCachedCounts(venueIdFromPath);
        if (cached) {
          setCounts({
            live_orders: cached.live_count || 0,
            total_orders: cached.today_orders_count || 0,
            notifications: 0,
          });
        }
      }
    };

    // Debounced version of loadCounts (for realtime updates)
    const debouncedLoadCounts = () => {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
      debounceTimeout = setTimeout(() => {
        loadCounts(true); // Force refresh on realtime updates
      }, 300);
    };

    // Load counts on mount - use cache if available
    loadCounts(false);

    // Set up real-time subscription for order updates with unique channel name
    const supabase = createClient();
    const channelName = getRealtimeChannelName("bottom-nav", venueIdFromPath);
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `venue_id=eq.${venueIdFromPath}`,
        },
        (payload) => {
          if (!isMounted) return;
          // For INSERT events (new orders), update immediately with force refresh
          // For UPDATE/DELETE events, use debounced update
          if (payload.eventType === "INSERT") {
            loadCounts(true); // Force refresh on new orders
          } else {
            debouncedLoadCounts();
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
      supabase.removeChannel(channel);
    };
  }, [pathname]);

  // Return null AFTER all hooks have been called
  if (shouldHide) {
    return null;
  }

  return <GlobalBottomNav venueId={venueId || undefined} counts={counts} />;
}
