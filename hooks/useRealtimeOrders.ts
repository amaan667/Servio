/**
 * useRealtimeOrders Hook
 * Subscribe to order changes (INSERT, UPDATE, DELETE) in real-time
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { subscriptionManager, SubscriptionManager } from "@/lib/realtime/subscription-manager";
import type { RealtimeOrder, PostgresPayload, ConnectionState, SubscriptionStatus } from "@/lib/realtime/types";

// ============================================================================
// Types
// ============================================================================

interface UseRealtimeOrdersOptions {
  venueId: string;
  initialStatus?: string[];
  onOrderChange?: (payload: PostgresPayload<RealtimeOrder>) => void;
  enabled?: boolean;
}

interface UseRealtimeOrdersReturn {
  data: RealtimeOrder[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  connectionState: ConnectionState;
  subscribe: () => void;
  unsubscribe: () => void;
  refresh: () => Promise<void>;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useRealtimeOrders(options: UseRealtimeOrdersOptions): UseRealtimeOrdersReturn {
  const { venueId, initialStatus, onOrderChange, enabled = true } = options;

  const [data, setData] = useState<RealtimeOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');

  const dataRef = useRef<RealtimeOrder[]>([]);
  const channelRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  // Update ref when data changes
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Update mounted state
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // --------------------------------------------------------------------------
  // Fetch Initial Data
  // --------------------------------------------------------------------------

  const fetchOrders = useCallback(async () => {
    if (!venueId || !enabled) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setIsError(false);
    setError(null);

    try {
      const supabase = createClient();

      // Calculate date bounds for today
      const startOfToday = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
      const endOfToday = new Date(new Date().setHours(23, 59, 59, 999)).toISOString();

      // Build query
      let query = supabase
        .from("orders")
        .select(
          "id, venue_id, table_number, table_id, customer_name, customer_phone, customer_email, order_status, payment_status, payment_method, total_amount, items, created_at, updated_at, source, tables!left (id, label, area)"
        )
        .eq("venue_id", venueId)
        .gte("created_at", startOfToday)
        .lte("created_at", endOfToday)
        .order("created_at", { ascending: false })
        .limit(100);

      // Apply status filter if provided
      if (initialStatus && initialStatus.length > 0) {
        query = query.in("order_status", initialStatus);
      }

      const { data: ordersData, error: ordersError } = await query;

      if (ordersError) {
        throw ordersError;
      }

      // Transform orders
      const orders: RealtimeOrder[] = (ordersData || []).map((order: Record<string, unknown>) => {
        const tables = order.tables as { label?: string } | undefined;
        return {
          ...order,
          table_label:
            tables?.label ||
            (order.source === "counter"
              ? `Counter ${order.table_number}`
              : `Table ${order.table_number}`),
        } as RealtimeOrder;
      });

      if (mountedRef.current) {
        setData(orders);
        dataRef.current = orders;
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (mountedRef.current) {
        setIsError(true);
        setError(error);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [venueId, initialStatus, enabled]);

  // --------------------------------------------------------------------------
  // Subscribe to Realtime Changes
  // --------------------------------------------------------------------------

  const subscribe = useCallback(() => {
    if (!venueId || !enabled) {
      return;
    }

    const channelName = SubscriptionManager.generateChannelName(venueId, 'orders');
    
    // Don't re-subscribe if already subscribed
    if (channelRef.current === channelName) {
      return;
    }

    channelRef.current = channelName;

    // Create subscription
    subscriptionManager.createSubscription({
      channelName,
      config: {
        channelName,
        postgres: [
          {
            schema: 'public',
            table: 'orders',
            event: '*',
            filters: [{ column: 'venue_id', operator: 'eq', value: venueId }],
          },
        ],
      },
      onStatusChange: (status: SubscriptionStatus) => {
        if (mountedRef.current) {
          setConnectionState(status === 'SUBSCRIBED' ? 'connected' : status === 'CHANNEL_ERROR' ? 'error' : 'connecting');
        }
      },
      onEvent: (payload: unknown) => {
        if (!mountedRef.current) return;

        const orderPayload = payload as PostgresPayload<RealtimeOrder>;

        // Call custom callback
        if (onOrderChange) {
          onOrderChange(orderPayload);
        }

        // Update local data
        setData((prevData) => {
          const newData = [...prevData];

          switch (orderPayload.eventType) {
            case 'INSERT':
              if (orderPayload.new) {
                const newOrder = transformNewOrder(orderPayload.new);
                newData.unshift(newOrder);
              }
              break;

            case 'UPDATE':
              if (orderPayload.new) {
                const updatedOrder = orderPayload.new;
                const index = newData.findIndex((o) => o.id === updatedOrder.id);
                if (index >= 0) {
                  newData[index] = transformNewOrder(updatedOrder);
                } else {
                  // Order might have been filtered out initially, add it
                  newData.unshift(transformNewOrder(updatedOrder));
                }
              }
              break;

            case 'DELETE':
              if (orderPayload.old) {
                const deletedId = orderPayload.old.id;
                const index = newData.findIndex((o) => o.id === deletedId);
                if (index >= 0) {
                  newData.splice(index, 1);
                }
              }
              break;
          }

          return newData;
        });
      },
    });
  }, [venueId, enabled, onOrderChange]);

  // --------------------------------------------------------------------------
  // Unsubscribe from Changes
  // --------------------------------------------------------------------------

  const unsubscribe = useCallback(() => {
    if (channelRef.current) {
      subscriptionManager.removeSubscription(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  // --------------------------------------------------------------------------
  // Initial Fetch and Subscribe
  // --------------------------------------------------------------------------

  useEffect(() => {
    if (enabled && venueId) {
      fetchOrders();
    }
    return () => {
      unsubscribe();
    };
  }, [enabled, venueId, fetchOrders, unsubscribe]);

  // Auto-subscribe after initial fetch
  useEffect(() => {
    if (!isLoading && enabled && venueId) {
      subscribe();
    }
  }, [isLoading, enabled, venueId, subscribe]);

  // --------------------------------------------------------------------------
  // Auto-refresh every 2 minutes as fallback
  // --------------------------------------------------------------------------

  useEffect(() => {
    if (!venueId || !enabled) return;

    const interval = setInterval(() => {
      fetchOrders();
    }, 120000);

    return () => clearInterval(interval);
  }, [venueId, enabled, fetchOrders]);

  // --------------------------------------------------------------------------
  // Return
  // --------------------------------------------------------------------------

  return {
    data,
    isLoading,
    isError,
    error,
    connectionState,
    subscribe,
    unsubscribe,
    refresh: fetchOrders,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function transformNewOrder(order: RealtimeOrder): RealtimeOrder {
  const tableData = order as unknown as { tables?: { label?: string } };
  const tables = tableData.tables;
  return {
    ...order,
    table_label:
      tables?.label ||
      (order.source === "counter"
        ? `Counter ${order.table_number}`
        : `Table ${order.table_number}`),
  };
}

// ============================================================================
// Export
// ============================================================================

export type { UseRealtimeOrdersOptions, UseRealtimeOrdersReturn };
