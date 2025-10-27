import { useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase";

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
  useEffect(() => {
    if (!todayWindow || !todayWindow.startUtcISO || !todayWindow.endUtcISO) {
      return;
    }

    const venueId_check =
      venue && typeof venue === "object" && "venue_id" in venue
        ? (venue as { venue_id?: string }).venue_id
        : undefined;
    if (!venueId_check) {
      return;
    }

    const supabase = supabaseBrowser();

    const channel = supabase
      .channel("dashboard-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `venue_id=eq.${venueId}`,
        },
        async (payload: RealtimePayload) => {
          // Always refresh counts and stats for ANY order change - don't filter by date window
          // This ensures instant updates regardless of when the order was created
          await refreshCounts();

          // Always reload stats to ensure accuracy
          const venueIdForStats =
            venue && typeof venue === "object" && "venue_id" in venue
              ? (venue as { venue_id?: string }).venue_id
              : venueId;
          if (venueIdForStats && todayWindow) {
            await loadStats(venueIdForStats, todayWindow);
          }

          if (payload.eventType === "INSERT" && payload.new) {
            const order = payload.new as { order_status: string; total_amount?: number };
            const orderCreatedAt = payload.new?.created_at as string | undefined;
            // Only incrementally update if order is from today's window
            if (
              orderCreatedAt &&
              todayWindow &&
              orderCreatedAt >= todayWindow.startUtcISO &&
              orderCreatedAt < todayWindow.endUtcISO
            ) {
              updateRevenueIncrementally(order);
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
          await refreshCounts();
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
          await refreshCounts();
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
          try {
            const { data: menuItems } = await supabase
              .from("menu_items")
              .select("id")
              .eq("venue_id", venueId)
              .eq("is_available", true);

            // Update menu items count in parent component
            // This will be handled by the parent component
          } catch (_error) {
            // Error silently handled
          }
        }
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          // Empty block
        } else if (status === "CHANNEL_ERROR") {
          // Empty block
        } else if (status === "TIMED_OUT") {
          // Empty block
        }
      });

    const handleOrderCreated = (event: CustomEvent) => {
      if (event.detail.venueId === venueId) {
        refreshCounts();
        if (event.detail.order) {
          updateRevenueIncrementally(event.detail.order);
        }
      }
    };

    window.addEventListener("orderCreated", handleOrderCreated as EventListener);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("orderCreated", handleOrderCreated as EventListener);
    };
  }, [venueId, venue, todayWindow, refreshCounts, loadStats, updateRevenueIncrementally]);
}
