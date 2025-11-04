"use client";

import { usePathname } from "next/navigation";
import GlobalBottomNav from "./GlobalBottomNav";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { getRealtimeChannelName } from "@/lib/realtime-device-id";
import { useEffect, useState } from "react";

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

    // Load counts for the venue
    const loadCounts = async () => {
      if (!isMounted) return;

      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .rpc("dashboard_counts", {
            p_venue_id: venueIdFromPath,
            p_tz: "Europe/London",
            p_live_window_mins: 30,
          })
          .single();

        if (!isMounted) return;

        if (!error && data) {
          setCounts({
            live_orders: ((data as Record<string, unknown>).live_count as number) || 0,
            total_orders: ((data as Record<string, unknown>).today_orders_count as number) || 0,
            notifications: 0,
          });
        }
      } catch (_error) {
        // Silent error handling
      }
    };

    // Debounced version of loadCounts
    const debouncedLoadCounts = () => {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
      debounceTimeout = setTimeout(() => {
        loadCounts();
      }, 300);
    };

    loadCounts();

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
        () => {
          if (!isMounted) return;
          debouncedLoadCounts();
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
