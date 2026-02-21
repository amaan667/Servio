/**
 * useRealtimeTables Hook
 * Subscribe to table and table session changes in real-time
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { subscriptionManager, SubscriptionManager } from "@/lib/realtime/subscription-manager";
import type {
  RealtimeTable,
  RealtimeTableSession,
  PostgresPayload,
  ConnectionState,
  SubscriptionStatus,
} from "@/lib/realtime/types";

// ============================================================================
// Types
// ============================================================================

interface UseRealtimeTablesOptions {
  venueId: string;
  includeSessions?: boolean;
  onTableChange?: (payload: PostgresPayload<RealtimeTable>) => void;
  onSessionChange?: (payload: PostgresPayload<RealtimeTableSession>) => void;
  enabled?: boolean;
}

interface UseRealtimeTablesReturn {
  tables: RealtimeTable[];
  sessions: RealtimeTableSession[];
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

export function useRealtimeTables(options: UseRealtimeTablesOptions): UseRealtimeTablesReturn {
  const {
    venueId,
    includeSessions = true,
    onTableChange,
    onSessionChange,
    enabled = true,
  } = options;

  const [tables, setTables] = useState<RealtimeTable[]>([]);
  const [sessions, setSessions] = useState<RealtimeTableSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");

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
  // Fetch Initial Data
  // --------------------------------------------------------------------------

  const fetchTables = useCallback(async () => {
    if (!venueId || !enabled) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setIsError(false);
    setError(null);

    try {
      const supabase = createClient();

      // Fetch tables
      const { data: tablesData, error: tablesError } = await supabase
        .from("tables")
        .select("*")
        .eq("venue_id", venueId)
        .eq("is_active", true)
        .order("table_number", { ascending: true });

      if (tablesError) {
        throw tablesError;
      }

      setTables((tablesData as RealtimeTable[]) || []);

      // Fetch sessions if needed
      if (includeSessions) {
        const { data: sessionsData, error: sessionsError } = await supabase
          .from("table_sessions")
          .select("*")
          .eq("venue_id", venueId)
          .is("closed_at", null);

        if (sessionsError) {
          throw sessionsError;
        }

        setSessions((sessionsData as RealtimeTableSession[]) || []);
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
  }, [venueId, includeSessions, enabled]);

  // --------------------------------------------------------------------------
  // Subscribe to Realtime Changes
  // --------------------------------------------------------------------------

  const subscribe = useCallback(() => {
    if (!venueId || !enabled) {
      return;
    }

    const channelName = SubscriptionManager.generateChannelName(venueId, "tables");

    if (channelRef.current === channelName) {
      return;
    }

    channelRef.current = channelName;

    const postgresConfigs = [
      {
        schema: "public",
        table: "tables",
        event: "*" as const,
        filters: [{ column: "venue_id", operator: "eq" as const, value: venueId }],
      },
    ];

    if (includeSessions) {
      postgresConfigs.push({
        schema: "public",
        table: "table_sessions",
        event: "*" as const,
        filters: [{ column: "venue_id", operator: "eq" as const, value: venueId }],
      });
    }

    subscriptionManager.createSubscription({
      channelName,
      config: {
        channelName,
        postgres: postgresConfigs,
      },
      onStatusChange: (status: SubscriptionStatus) => {
        if (mountedRef.current) {
          setConnectionState(
            status === "SUBSCRIBED"
              ? "connected"
              : status === "CHANNEL_ERROR"
                ? "error"
                : "connecting"
          );
        }
      },
      onEvent: (payload: unknown) => {
        if (!mountedRef.current) return;

        const tablePayload = payload as PostgresPayload<RealtimeTable>;
        const sessionPayload = payload as PostgresPayload<RealtimeTableSession>;

        // Determine which table the change belongs to
        if ("table_number" in (tablePayload.new || {})) {
          // This is a table change
          if (onTableChange) {
            onTableChange(tablePayload);
          }

          setTables((prevTables) => {
            const newTables = [...prevTables];

            switch (tablePayload.eventType) {
              case "INSERT":
                if (tablePayload.new) {
                  newTables.push(tablePayload.new);
                }
                break;

              case "UPDATE":
                if (tablePayload.new) {
                  const index = newTables.findIndex((t) => t.id === tablePayload.new!.id);
                  if (index >= 0) {
                    newTables[index] = tablePayload.new;
                  }
                }
                break;

              case "DELETE":
                if (tablePayload.old) {
                  const index = newTables.findIndex((t) => t.id === tablePayload.old!.id);
                  if (index >= 0) {
                    newTables.splice(index, 1);
                  }
                }
                break;
            }

            return newTables;
          });
        } else {
          // This is a session change
          if (onSessionChange) {
            onSessionChange(sessionPayload);
          }

          setSessions((prevSessions) => {
            const newSessions = [...prevSessions];

            switch (sessionPayload.eventType) {
              case "INSERT":
                if (sessionPayload.new) {
                  newSessions.push(sessionPayload.new);
                }
                break;

              case "UPDATE":
                if (sessionPayload.new) {
                  const index = newSessions.findIndex((s) => s.id === sessionPayload.new!.id);
                  if (index >= 0) {
                    newSessions[index] = sessionPayload.new;
                  } else {
                    newSessions.push(sessionPayload.new);
                  }
                }
                break;

              case "DELETE":
                if (sessionPayload.old) {
                  const index = newSessions.findIndex((s) => s.id === sessionPayload.old!.id);
                  if (index >= 0) {
                    newSessions.splice(index, 1);
                  }
                }
                break;
            }

            return newSessions;
          });
        }
      },
    });
  }, [venueId, includeSessions, enabled, onTableChange, onSessionChange]);

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
      fetchTables();
    }
    return () => {
      unsubscribe();
    };
  }, [enabled, venueId, fetchTables, unsubscribe]);

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
    tables,
    sessions,
    isLoading,
    isError,
    error,
    connectionState,
    subscribe,
    unsubscribe,
    refresh: fetchTables,
  };
}

// ============================================================================
// Export
// ============================================================================

export type { UseRealtimeTablesOptions, UseRealtimeTablesReturn };
