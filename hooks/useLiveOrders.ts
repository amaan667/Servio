import { useState, useEffect, useCallback } from "react";
import { supabaseBrowser as createClient } from "@/lib/supabase";

export type Order = {

  }>;

};

const LIVE_STATUSES = [
  "PLACED",
  "ACCEPTED",
  "IN_PREP",
  "READY",
  "OUT_FOR_DELIVERY",
  "SERVING",
] as const;

const ORDER_STATUS_LABELS: Record<string, string> = {

};

// Optional: add a 4s safety timeout (never spin forever)
async function withTimeout<T>(p: Promise<T>, _ms = 4000): Promise<T> {
  // Remove artificial timeout - let real promises handle timing
  return await p;
}

export function useLiveOrders(venueId: string) {
  const [data, setData] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!venueId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setIsError(false);
    setError(null);

    try {
      const supabase = createClient();

      if (!supabase) {
        throw new Error("Supabase client not available");
      }

      // Calculate date bounds
      const startOfToday = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
      const endOfToday = new Date(new Date().setHours(23, 59, 59, 999)).toISOString();

      // IMPORTANT: mirror the exact filter logic used for the badge count
      const queryPromise = supabase
        .from("orders")
        .select(
          "id, venue_id, table_number, table_id, customer_name, customer_phone, customer_email, order_status, payment_status, payment_method, total_amount, items, created_at, updated_at, source, tables!left (id, label, area)",
          { count: "exact" }
        )
        .eq("venue_id", venueId)
        .in("order_status", ["READY", "SERVED", "COMPLETED"] as unknown as string[])
        .in("payment_status", ["PAID", "UNPAID"]) // Include both paid and unpaid orders
        .gte("created_at", startOfToday) // today only
        .lte("created_at", endOfToday)
        .order("created_at", { ascending: false })
        .limit(100) // avoid accidental infinite loading
        .throwOnError();

      const result = await withTimeout(
        queryPromise as unknown as Promise<{ data: unknown; error: unknown }>
      );
      const { data, error } = result;

      if (error) {
        throw error;
      }

      // Transform orders to include table_label
      const dataArray = Array.isArray(data) ? data : [];
      const transformedOrders = dataArray.map((order: unknown) => {
        const orderRecord = order as Record<string, unknown>;
        const tables = orderRecord.tables as { label?: string } | undefined;
        const orderStatus = orderRecord.order_status as string;
        const statusLabel =
          ORDER_STATUS_LABELS[orderStatus as keyof typeof ORDER_STATUS_LABELS] || orderStatus;
        return {
          ...orderRecord,

              ? `Counter ${orderRecord.table_number}`
              : `Table ${orderRecord.table_number}`),

        } as unknown as Order;

      setData(transformedOrders);
    } catch (err) {
      setIsError(true);
      setError((err as Error)?.message || "Failed to load orders");
    } finally {
      setIsLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Auto-refresh every 2 minutes
  useEffect(() => {
    if (!venueId) return;

    const interval = setInterval(() => {
      fetchOrders();
    }, 120000);

    return () => clearInterval(interval);
  }, [venueId, fetchOrders]);

  return {
    data,
    isLoading,
    isError,
    error,

  };
}
