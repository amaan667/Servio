import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { todayWindowForTZ } from "@/lib/time";
import { logger } from "@/lib/logger";

const supabase = createClient();

export interface TableOrder {
  id: string;
  table_number: number;
  customer_name: string | null;
  customer_phone: string | null;
  order_status: string;
  payment_status: string;
  payment_mode?: string;
  payment_method?: string;
  total_amount: number;
  created_at: string;
  updated_at: string;
  source: "qr" | "counter";
  table_label: string | null;
  items: Array<{
    item_name: string;
    quantity: number;
    price: number;
  }>;
}

// Get active table orders (orders with source = 'qr' and active status)
export function useTableOrders(venueId: string) {
  return useQuery({
    queryKey: ["table-orders", venueId],
    queryFn: async () => {
      // Only show today's active orders for table management (respects daily reset)
      const todayStart = new Date();
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
        .eq("source", "qr")
        // Only show today's active orders (respects daily reset)
        .in("order_status", ["PLACED", "IN_PREP", "READY", "SERVING"])
        .gte("created_at", todayStart.toISOString())
        .lte("created_at", todayEnd.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get table labels for each order using table_number
      const ordersWithTableLabels = await Promise.all(
        (data || []).map(async (order: Record<string, unknown>) => {
          let tableLabel = null;

          // Get table label using table_number
          if (order.table_number) {
            // Check if this is a counter order or table order
            const defaultLabel =
              order.source === "counter"
                ? `Counter ${order.table_number}`
                : `Table ${order.table_number}`;

            const { data: tableData } = await supabase
              .from("table_runtime_state")
              .select("label")
              .eq("venue_id", venueId)
              .eq("label", defaultLabel)
              .single();
            tableLabel = tableData?.label || defaultLabel;
          }

          return {
            ...order,
            table_label:
              tableLabel ||
              (order.table_number
                ? order.source === "counter"
                  ? `Counter ${order.table_number}`
                  : `Table ${order.table_number}`
                : "Unknown Table"),
          } as TableOrder;
        })
      );

      return ordersWithTableLabels;
    },
    refetchInterval: 15000,
    staleTime: 0, // Always consider data stale to ensure fresh data on navigation
    refetchOnMount: true, // Always refetch when component mounts
    gcTime: 30000,
    retry: 3,
    retryDelay: 1000,
  });
}

// Get table order counts
export function useTableOrderCounts(venueId: string) {
  return useQuery({
    queryKey: ["table-order-counts", venueId],
    queryFn: async () => {
      // Count all active orders regardless of date for consistency
      const { data, error } = await supabase
        .from("orders")
        .select("order_status, source, created_at")
        .eq("venue_id", venueId)
        .eq("source", "qr")
        // Count all active orders regardless of date
        .in("order_status", ["PLACED", "IN_PREP", "READY", "SERVING"]);

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
        placed: byStatus.PLACED || 0,
        in_prep: byStatus.IN_PREP || 0,
        ready: byStatus.READY || 0,
        serving: byStatus.SERVING || 0,
      };
    },
    refetchInterval: 15000,
    staleTime: 0, // Always consider data stale to ensure fresh data on navigation
    refetchOnMount: true, // Always refetch when component mounts
    gcTime: 30000,
    retry: 3,
    retryDelay: 1000,
  });
}

// Real-time subscription hook for table orders
export function useTableOrdersRealtime(venueId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!venueId) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`table-orders-${venueId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `venue_id=eq.${venueId}`,
        },
        (payload: {
          eventType: string;
          new?: Record<string, unknown>;
          old?: Record<string, unknown>;
        }) => {
          // Check if this is a table order (QR order)
          const order = payload.new || payload.old;
          if (order?.source === "qr") {
            // Invalidate both queries to trigger refetch
            queryClient.invalidateQueries({ queryKey: ["table-orders", venueId] });
            queryClient.invalidateQueries({ queryKey: ["table-order-counts", venueId] });
          }
        }
      )
      .subscribe((_status: string) => {
        // Subscription maintained for real-time updates
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [venueId, queryClient]);
}
