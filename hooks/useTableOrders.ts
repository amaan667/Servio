import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabaseBrowser as createClient } from "@/lib/supabase";

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
  stripe_session_id?: string | null;
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

const ACTIVE_TABLE_ORDER_STATUSES = ["PLACED", "IN_PREP", "READY", "SERVING", "SERVED"] as const;

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

      // Try to use completion_status first (unified lifecycle), fallback to order_status
      let query = supabase
        .from("orders")
        .select(
          `
					id,
					table_number,
					customer_name,
					customer_phone,
					order_status,
					completion_status,
					payment_status,
          payment_mode,
          payment_method,
          stripe_session_id,
					total_amount,
					created_at,
					updated_at,
					source,
					items
				`
        )
        .eq("venue_id", venueId)
        .eq("source", "qr")
        .gte("created_at", todayStart.toISOString())
        .lte("created_at", todayEnd.toISOString());

      // Filter by completion_status if available, otherwise use order_status
      // This ensures backward compatibility during migration rollout
      try {
        query = query.eq("completion_status", "OPEN");
      } catch {
        // Fallback: use order_status if completion_status column doesn't exist
        query = query.in("order_status", [...ACTIVE_TABLE_ORDER_STATUSES]);
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;

      // Best-effort reconciliation: if a PAY_NOW order has a Stripe session but is still UNPAID,
      // reconcile payment status via server endpoint (webhook may be delayed/missed).
      const suspicious = (data || []).filter((o: Record<string, unknown>) => {
        const paymentStatus = String(o.payment_status || "").toUpperCase();
        const paymentMethod = String(o.payment_method || "").toUpperCase();
        const sessionId = o.stripe_session_id;
        return (
          paymentStatus === "UNPAID" &&
          paymentMethod === "PAY_NOW" &&
          typeof sessionId === "string" &&
          sessionId.length > 0
        );
      });

      // Limit reconciliation to avoid spamming Stripe in extreme edge cases
      await Promise.allSettled(
        suspicious.slice(0, 3).map(async (o: Record<string, unknown>) => {
          const sessionId = String(o.stripe_session_id || "");
          await fetch(`/api/orders/verify?sessionId=${encodeURIComponent(sessionId)}`).catch(
            () => null
          );
        })
      );

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

          // Always ensure we have a proper table label
          let finalTableLabel = tableLabel;

          if (!finalTableLabel && order.table_number) {
            finalTableLabel =
              order.source === "counter"
                ? `Counter ${order.table_number}`
                : `Table ${order.table_number}`;
          }

          // If still no label, try to get from table_id or use a default
          if (!finalTableLabel) {
            if (order.table_id) {
              // Try to get table label from table_id
              const { data: tableFromId } = await supabase
                .from("tables")
                .select("table_number")
                .eq("id", order.table_id)
                .single();

              if (tableFromId?.table_number) {
                finalTableLabel = `Table ${tableFromId.table_number}`;
              }
            }
          }

          // Last resort: use order ID or a generic label
          if (!finalTableLabel) {
            finalTableLabel = order.source === "counter" ? `Counter Order` : `Table Order`;
          }

          return {
            ...order,
            table_label: finalTableLabel,
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
      // Count today's active orders (must match useTableOrders filter to keep UI consistent)
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      // Try to use completion_status first (unified lifecycle), fallback to order_status
      let query = supabase
        .from("orders")
        .select("order_status, completion_status, source, created_at")
        .eq("venue_id", venueId)
        .eq("source", "qr")
        .gte("created_at", todayStart.toISOString())
        .lte("created_at", todayEnd.toISOString());

      // Filter by completion_status if available, otherwise use order_status
      try {
        query = query.eq("completion_status", "OPEN");
      } catch {
        // Fallback: use order_status if completion_status column doesn't exist
        query = query.in("order_status", [...ACTIVE_TABLE_ORDER_STATUSES]);
      }

      const { data, error } = await query;

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
        serving: (byStatus.SERVING || 0) + (byStatus.SERVED || 0),
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
