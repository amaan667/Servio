import { useEffect, useRef, useCallback } from "react";
import { supabaseBrowser } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { getRealtimeChannelName } from "@/lib/realtime-device-id";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface RealtimePayload {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new?: Record<string, unknown>;
  old?: Record<string, unknown>;
}

interface UseDashboardRealtimeProps {
  venueId: string;
  todayWindow: { startUtcISO: string; endUtcISO: string } | null | undefined;
  refreshCounts: () => Promise<void>;
  loadStats: (venueId: string, window: { startUtcISO: string; endUtcISO: string }) => Promise<void>;
  updateRevenueIncrementally: (order: { order_status: string; total_amount?: number }) => void;
  venue: unknown;
}

export function useDashboardRealtime({
  venueId,
  todayWindow,
  refreshCounts,
  loadStats,
  updateRevenueIncrementally,
  venue,
}: UseDashboardRealtimeProps) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const authSubscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Store refreshCounts in a ref to avoid recreating callbacks
  const refreshCountsRef = useRef(refreshCounts);
  useEffect(() => {
    refreshCountsRef.current = refreshCounts;
  }, [refreshCounts]);

  // Debounced refresh function to prevent excessive calls
  const debouncedRefresh = useCallback(async () => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(async () => {
      if (!isMountedRef.current) return;
      try {
        await refreshCountsRef.current();
      } catch (_error) {
        logger.error("[Dashboard Realtime] ❌ Error refreshing counts:", _error);
      }
    }, 300); // 300ms debounce
  }, []); // No dependencies - uses ref

  // Immediate refresh (no debounce) for critical updates
  const immediateRefresh = useCallback(async () => {
    if (!isMountedRef.current) return;
    try {
      await refreshCountsRef.current();
    } catch (_error) {
      logger.error("[Dashboard Realtime] ❌ Error in immediate refresh:", _error);
    }
  }, []); // No dependencies - uses ref

  // Store loadStats in a ref to avoid recreating callbacks
  const loadStatsRef = useRef(loadStats);
  useEffect(() => {
    loadStatsRef.current = loadStats;
  }, [loadStats]);

  // Store updateRevenueIncrementally in a ref
  const updateRevenueIncrementallyRef = useRef(updateRevenueIncrementally);
  useEffect(() => {
    updateRevenueIncrementallyRef.current = updateRevenueIncrementally;
  }, [updateRevenueIncrementally]);

  // Debounced stats load function
  const debouncedLoadStats = useCallback(async () => {
    if (!todayWindow) return;

    const venueIdForStats =
      venue && typeof venue === "object" && "venue_id" in venue
        ? (venue as { venue_id?: string }).venue_id
        : venueId;

    if (venueIdForStats && todayWindow) {
      try {
        await loadStatsRef.current(venueIdForStats, todayWindow);
      } catch (_error) {
        // Error handled silently
      }
    }
  }, [venueId, venue, todayWindow]); // Removed loadStats from deps, using ref

  useEffect(() => {
    isMountedRef.current = true;

    if (!todayWindow || !todayWindow.startUtcISO || !todayWindow.endUtcISO) {
      return;
    }

    const venueId_check =
      venue && typeof venue === "object" && "venue_id" in venue
        ? (venue as { venue_id?: string }).venue_id
        : venueId;
    if (!venueId_check) {
      return;
    }

    const supabase = supabaseBrowser();

    // Set up session refresh listener to reconnect when token refreshes
    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "TOKEN_REFRESHED" && channelRef.current) {
        // Token refreshed - ensure channel is still connected
        const channel = channelRef.current;
        if (channel && channel.state !== "joined") {
          // Reconnect if disconnected
          channel.subscribe();
        }
      }
    });
    authSubscriptionRef.current = authSubscription;

    const setupChannel = () => {
      // Use unique channel name with device ID to prevent conflicts
      const channelName = getRealtimeChannelName("dashboard-realtime", venueId);
      const channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "orders",
            filter: `venue_id=eq.${venueId}`,
          },
          async (payload: RealtimePayload) => {
            if (!isMountedRef.current) return;

            // For INSERT (new orders), refresh immediately to show new data
            // For UPDATE/DELETE, use debounced refresh
            if (payload.eventType === "INSERT") {
              immediateRefresh();
            } else {
              debouncedRefresh();
            }
            debouncedLoadStats();

            if (payload.eventType === "INSERT" && payload.new) {
              const order = payload.new as { order_status: string; total_amount?: number; created_at?: string };
              const orderCreatedAt = payload.new?.created_at as string | undefined;
              // Only incrementally update if order is from today's window
              if (
                orderCreatedAt &&
                todayWindow &&
                orderCreatedAt >= todayWindow.startUtcISO &&
                orderCreatedAt < todayWindow.endUtcISO
              ) {
                updateRevenueIncrementallyRef.current(order);
              }
              
              // Dispatch revenue changed event for instant updates
              if (typeof window !== "undefined" && order.total_amount) {
                window.dispatchEvent(
                  new CustomEvent("revenueChanged", {
                    detail: { venueId, amount: order.total_amount },
                  })
                );
              }
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "tables",
            filter: `venue_id=eq.${venueId}`,
          },
          async (_payload: RealtimePayload) => {
            if (!isMountedRef.current) return;
            debouncedRefresh();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "table_sessions",
            filter: `venue_id=eq.${venueId}`,
          },
          async (_payload: RealtimePayload) => {
            if (!isMountedRef.current) return;
            debouncedRefresh();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "menu_items",
            filter: `venue_id=eq.${venueId}`,
          },
          async (_payload: unknown) => {
            if (!isMountedRef.current) return;
            try {
              // Normalize venueId for query
              const normalizedVenueId = venueId.startsWith("venue-") ? venueId : `venue-${venueId}`;
              
              // Fetch ALL menu items (not just available) to match dashboard count
              const { data: menuItems } = await supabase
                .from("menu_items")
                .select("id")
                .eq("venue_id", normalizedVenueId)
                .order("created_at", { ascending: false });

              const count = menuItems?.length || 0;

              // Dispatch custom event for instant updates across all components
              if (typeof window !== "undefined") {
                window.dispatchEvent(
                  new CustomEvent("menuItemsChanged", {
                    detail: { venueId, count },
                  })
                );
              }
            } catch (_error) {
              // Error silently handled
            }
          }
        )
        .subscribe((status: string) => {
          if (status === "SUBSCRIBED") {
            channelRef.current = channel;
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            logger.error("[Dashboard Realtime] Channel error or timeout:", status);
            // Clear any existing reconnect timeout
            if (reconnectTimeoutRef.current) {
              clearTimeout(reconnectTimeoutRef.current);
            }

            // Try to reconnect after a delay, but only if we still have a valid session
            reconnectTimeoutRef.current = setTimeout(async () => {
              try {
                const {
                  data: { session },
                } = await supabase.auth.getSession();
                if (session) {
                  // Session is valid, resubscribe
                  if (channelRef.current) {
                    channelRef.current.subscribe();
                  } else {
                    // Channel lost, recreate it
                    setupChannel();
                  }
                }
              } catch (_error) {
                // Session invalid - will need to refresh page or re-login
              }
            }, 3000);
          }
        });

      return channel;
    };

    const channel = setupChannel();
    channelRef.current = channel;

    const handleOrderCreated = (event: CustomEvent) => {
      if (event.detail.venueId === venueId) {
        refreshCountsRef.current();
        if (event.detail.order) {
          updateRevenueIncrementallyRef.current(event.detail.order);
        }
      }
    };

    window.addEventListener("orderCreated", handleOrderCreated as EventListener);

    return () => {
      isMountedRef.current = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
      if (authSubscriptionRef.current) {
        authSubscriptionRef.current.unsubscribe();
        authSubscriptionRef.current = null;
      }
      window.removeEventListener("orderCreated", handleOrderCreated as EventListener);
    };
  }, [
    venueId,
    todayWindow,
    // Removed callback dependencies to prevent re-subscription
    // Using refs for functions instead
  ]);
}
