/**
 * useRealtimeInventory Hook
 * Subscribe to inventory changes and low stock alerts in real-time
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { subscriptionManager, SubscriptionManager } from "@/lib/realtime/subscription-manager";
import type { RealtimeInventoryItem, PostgresPayload, ConnectionState, SubscriptionStatus } from "@/lib/realtime/types";

// ============================================================================
// Types
// ============================================================================

interface UseRealtimeInventoryOptions {
  venueId: string;
  lowStockThreshold?: number;
  onInventoryChange?: (payload: PostgresPayload<RealtimeInventoryItem>) => void;
  onLowStockAlert?: (item: RealtimeInventoryItem) => void;
  enabled?: boolean;
}

interface UseRealtimeInventoryReturn {
  items: RealtimeInventoryItem[];
  lowStockItems: RealtimeInventoryItem[];
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

export function useRealtimeInventory(options: UseRealtimeInventoryOptions): UseRealtimeInventoryReturn {
  const { 
    venueId, 
    lowStockThreshold = 10,
    onInventoryChange, 
    onLowStockAlert,
    enabled = true 
  } = options;

  const [items, setItems] = useState<RealtimeInventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');

  const channelRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  // Update mounted state
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // --------------------------------------------------------------------------
  // Computed: Low stock items
  // --------------------------------------------------------------------------

  const lowStockItems = items.filter((item) => {
    const threshold = item.min_quantity ?? lowStockThreshold;
    return item.quantity <= threshold;
  });

  // --------------------------------------------------------------------------
  // Fetch Initial Data
  // --------------------------------------------------------------------------

  const fetchInventory = useCallback(async () => {
    if (!venueId || !enabled) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setIsError(false);
    setError(null);

    try {
      const supabase = createClient();

      const { data: inventoryData, error: inventoryError } = await supabase
        .from("inventory_items")
        .select("*")
        .eq("venue_id", venueId)
        .order("name", { ascending: true });

      if (inventoryError) {
        throw inventoryError;
      }

      if (mountedRef.current) {
        setItems(inventoryData as RealtimeInventoryItem[] || []);
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
  }, [venueId, enabled]);

  // --------------------------------------------------------------------------
  // Subscribe to Realtime Changes
  // --------------------------------------------------------------------------

  const subscribe = useCallback(() => {
    if (!venueId || !enabled) {
      return;
    }

    const channelName = SubscriptionManager.generateChannelName(venueId, 'inventory');
    
    if (channelRef.current === channelName) {
      return;
    }

    channelRef.current = channelName;

    subscriptionManager.createSubscription({
      channelName,
      config: {
        channelName,
        postgres: [
          {
            schema: 'public',
            table: 'inventory_items',
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

        const inventoryPayload = payload as PostgresPayload<RealtimeInventoryItem>;

        // Call custom callback
        if (onInventoryChange) {
          onInventoryChange(inventoryPayload);
        }

        // Check for low stock alert on INSERT or UPDATE
        if (onLowStockAlert && (inventoryPayload.eventType === 'INSERT' || inventoryPayload.eventType === 'UPDATE')) {
          if (inventoryPayload.new) {
            const threshold = inventoryPayload.new.min_quantity ?? lowStockThreshold;
            if (inventoryPayload.new.quantity <= threshold) {
              onLowStockAlert(inventoryPayload.new);
            }
          }
        }

        // Update local data
        setItems((prevItems) => {
          const newItems = [...prevItems];

          switch (inventoryPayload.eventType) {
            case 'INSERT':
              if (inventoryPayload.new) {
                newItems.push(inventoryPayload.new);
              }
              break;

            case 'UPDATE':
              if (inventoryPayload.new) {
                const index = newItems.findIndex((i) => i.id === inventoryPayload.new!.id);
                if (index >= 0) {
                  newItems[index] = inventoryPayload.new;
                } else {
                  newItems.push(inventoryPayload.new);
                }
              }
              break;

            case 'DELETE':
              if (inventoryPayload.old) {
                const index = newItems.findIndex((i) => i.id === inventoryPayload.old!.id);
                if (index >= 0) {
                  newItems.splice(index, 1);
                }
              }
              break;
          }

          return newItems;
        });
      },
    });
  }, [venueId, enabled, lowStockThreshold, onInventoryChange, onLowStockAlert]);

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
      fetchInventory();
    }
    return () => {
      unsubscribe();
    };
  }, [enabled, venueId, fetchInventory, unsubscribe]);

  // Auto-subscribe after initial fetch
  useEffect(() => {
    if (!isLoading && enabled && venueId) {
      subscribe();
    }
  }, [isLoading, enabled, venueId, subscribe]);

  // --------------------------------------------------------------------------
  // Return
  // --------------------------------------------------------------------------

  return {
    items,
    lowStockItems,
    isLoading,
    isError,
    error,
    connectionState,
    subscribe,
    unsubscribe,
    refresh: fetchInventory,
  };
}

// ============================================================================
// Export
// ============================================================================

export type { UseRealtimeInventoryOptions, UseRealtimeInventoryReturn };
