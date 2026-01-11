import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabaseBrowser as createClient } from "@/lib/supabase";

const supabase = createClient();

export interface CounterOrder {

  }>;
}

// Get active counter orders (orders with source = 'counter' and active status)
export function useCounterOrders(venueId: string) {
  return useQuery({
    queryKey: ["counter-orders", venueId],

      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from("orders")
        .select(
          `
					id,
					table_number,
					customer_name,
					customer_phone,
					order_status,
					payment_status,
					total_amount,
					created_at,
					updated_at,
					source,
					items
				`
        )
        .eq("venue_id", venueId)
        .eq("source", "counter")
        // Only show today's active orders (respects daily reset)
        .in("order_status", ["PLACED", "IN_PREP", "READY", "SERVING", "COMPLETED"])
        .gte("created_at", todayStart.toISOString())
        .lte("created_at", todayEnd.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as CounterOrder[];
    },

    staleTime: 0, // Always consider data stale to ensure fresh data on navigation
    refetchOnMount: true, // Always refetch when component mounts

}

// Get counter order counts
export function useCounterOrderCounts(venueId: string) {
  return useQuery({
    queryKey: ["counter-order-counts", venueId],

      const { data, error } = await supabase
        .from("orders")
        .select("order_status, source, created_at")
        .eq("venue_id", venueId)
        .eq("source", "counter")
        // Count all active orders regardless of date
        .in("order_status", ["PLACED", "IN_PREP", "READY", "SERVING", "COMPLETED"]);

      if (error) throw error;

      const total = data?.length || 0;
      const byStatus =
        data?.reduce(
          (acc: Record<string, number>, order: unknown) => {
            const orderStatus = (order as { order_status: string }).order_status;
            acc[orderStatus] = (acc[orderStatus] || 0) + 1;
            return acc;
          },
          {
            /* Empty */
          } as Record<string, number>
        ) ||
        {
          /* Empty */
        };

      return {
        total,

      };
    },

    staleTime: 0, // Always consider data stale to ensure fresh data on navigation
    refetchOnMount: true, // Always refetch when component mounts

}

// Real-time subscription hook for counter orders
export function useCounterOrdersRealtime(venueId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!venueId) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`counter-orders-${venueId}`)
      .on(
        "postgres_changes",
        {

          filter: `venue_id=eq.${venueId}`,
        },
        (payload: {

          new?: Record<string, unknown>;
          old?: Record<string, unknown>;
        }) => {
          // Check if this is a counter order
          const order = payload.new || payload.old;
          if (order?.source === "counter") {
            // Invalidate both queries to trigger refetch
            queryClient.invalidateQueries({ queryKey: ["counter-orders", venueId] });
            queryClient.invalidateQueries({ queryKey: ["counter-order-counts", venueId] });
          }
        }
      )
      .subscribe((_status: string) => {
        // Subscription maintained for real-time updates

    return () => {
      supabase.removeChannel(channel);
    };
  }, [venueId, queryClient]);
}
