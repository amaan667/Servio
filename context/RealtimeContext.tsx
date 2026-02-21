/**
 * RealtimeContext
 * Global context for managing realtime state across the application
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { subscriptionManager, SubscriptionManager } from "@/lib/realtime/subscription-manager";
import type { ConnectionState, RealtimeEvent, SubscriptionEntry } from "@/lib/realtime/types";
import { logger } from "@/lib/monitoring/structured-logger";

// ============================================================================
// Types
// ============================================================================

interface RealtimeContextValue {
  // Connection state
  connectionState: ConnectionState;
  isConnected: boolean;

  // Active subscriptions
  subscriptions: SubscriptionEntry[];
  subscriptionCount: number;

  // Event bus
  publish: (event: RealtimeEvent) => void;
  subscribe: (eventType: string, callback: (event: RealtimeEvent) => void) => () => void;

  // Utility
  getChannelName: (venueId: string, entityType: string, entityId?: string) => string;
}

interface RealtimeProviderProps {
  children: ReactNode;
  venueId?: string;
}

// ============================================================================
// Context Creation
// ============================================================================

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

// ============================================================================
// Provider Component
// ============================================================================

export function RealtimeProvider({ children }: RealtimeProviderProps) {
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const [subscriptions, setSubscriptions] = useState<SubscriptionEntry[]>([]);

  const eventHandlersRef = useRef<Map<string, Set<(event: RealtimeEvent) => void>>>(new Map());
  const eventIdRef = useRef(0);
  const mountedRef = useRef(true);

  // Update mounted state
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // --------------------------------------------------------------------------
  // Connection State Management
  // --------------------------------------------------------------------------

  useEffect(() => {
    // Initial state
    setConnectionState(subscriptionManager.getConnectionState());

    // Poll for connection state changes
    const interval = setInterval(() => {
      if (mountedRef.current) {
        setConnectionState(subscriptionManager.getConnectionState());
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // --------------------------------------------------------------------------
  // Subscriptions Sync
  // --------------------------------------------------------------------------

  useEffect(() => {
    const interval = setInterval(() => {
      if (mountedRef.current) {
        setSubscriptions(subscriptionManager.getSubscriptions());
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // --------------------------------------------------------------------------
  // Event Bus Methods
  // --------------------------------------------------------------------------

  const publish = useCallback((event: RealtimeEvent) => {
    const handlers = eventHandlersRef.current.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch (err) {
          logger.error("[RealtimeContext] Error in event handler", {
            eventType: event.type,
            error: err,
          });
        }
      }
    }
  }, []);

  const subscribe = useCallback((eventType: string, callback: (event: RealtimeEvent) => void) => {
    if (!eventHandlersRef.current.has(eventType)) {
      eventHandlersRef.current.set(eventType, new Set());
    }
    eventHandlersRef.current.get(eventType)!.add(callback);

    // Return unsubscribe function
    return () => {
      const handlers = eventHandlersRef.current.get(eventType);
      if (handlers) {
        handlers.delete(callback);
        if (handlers.size === 0) {
          eventHandlersRef.current.delete(eventType);
        }
      }
    };
  }, []);

  // --------------------------------------------------------------------------
  // Utility Methods
  // --------------------------------------------------------------------------

  const getChannelName = useCallback((vId: string, entityType: string, entityId?: string) => {
    return SubscriptionManager.generateChannelName(vId, entityType, entityId);
  }, []);

  // --------------------------------------------------------------------------
  // Cleanup on Unmount
  // --------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      // Don't unsubscribe here as it might break other components
    };
  }, []);

  // --------------------------------------------------------------------------
  // Context Value
  // --------------------------------------------------------------------------

  const value: RealtimeContextValue = {
    connectionState,
    isConnected: connectionState === "connected",
    subscriptions,
    subscriptionCount: subscriptions.length,
    publish,
    subscribe,
    getChannelName,
  };

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Use the realtime context
 * @throws Error if used outside of RealtimeProvider
 */
export function useRealtime(): RealtimeContextValue {
  const context = useContext(RealtimeContext);

  if (!context) {
    throw new Error("useRealtime must be used within a RealtimeProvider");
  }

  return context;
}

// ============================================================================
// Event Publishing Helper
// ============================================================================

/**
 * Publish an order change event
 */
export function publishOrderChange(
  venueId: string,
  orderId: string,
  action: "insert" | "update" | "delete",
  data?: unknown
) {
  const event: RealtimeEvent = {
    id: `order:${action}:${orderId}:${Date.now()}`,
    type: `order:${action}`,
    venueId,
    timestamp: Date.now(),
    payload: { orderId, action, data },
    source: "realtime",
  };

  // This would be called through context's publish method
  return event;
}

/**
 * Publish a table change event
 */
export function publishTableChange(
  venueId: string,
  tableId: string,
  action: "insert" | "update" | "delete",
  data?: unknown
) {
  const event: RealtimeEvent = {
    id: `table:${action}:${tableId}:${Date.now()}`,
    type: `table:${action}`,
    venueId,
    timestamp: Date.now(),
    payload: { tableId, action, data },
    source: "realtime",
  };

  return event;
}

/**
 * Publish an inventory alert event
 */
export function publishInventoryAlert(
  venueId: string,
  itemId: string,
  alertType: "low_stock" | "out_of_stock" | "restocked",
  data?: unknown
) {
  const event: RealtimeEvent = {
    id: `inventory:${alertType}:${itemId}:${Date.now()}`,
    type: `inventory:${alertType}`,
    venueId,
    timestamp: Date.now(),
    payload: { itemId, alertType, data },
    source: "realtime",
  };

  return event;
}

// ============================================================================
// Export
// ============================================================================

export type { RealtimeContextValue, RealtimeProviderProps };
