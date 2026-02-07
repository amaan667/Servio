/**
 * useRealtimeReservations Hook
 * Subscribe to reservation changes in real-time
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { subscriptionManager, SubscriptionManager } from "@/lib/realtime/subscription-manager";
import type { RealtimeReservation, PostgresPayload, ConnectionState, SubscriptionStatus } from "@/lib/realtime/types";

// ============================================================================
// Types
// ============================================================================

interface UseRealtimeReservationsOptions {
  venueId: string;
  date?: string; // Optional date filter (YYYY-MM-DD)
  upcomingOnly?: boolean;
  onReservationChange?: (payload: PostgresPayload<RealtimeReservation>) => void;
  enabled?: boolean;
}

interface UseRealtimeReservationsReturn {
  reservations: RealtimeReservation[];
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

export function useRealtimeReservations(options: UseRealtimeReservationsOptions): UseRealtimeReservationsReturn {
  const { 
    venueId, 
    date,
    upcomingOnly = false,
    onReservationChange, 
    enabled = true 
  } = options;

  const [reservations, setReservations] = useState<RealtimeReservation[]>([]);
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
  // Fetch Initial Data
  // --------------------------------------------------------------------------

  const fetchReservations = useCallback(async () => {
    if (!venueId || !enabled) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setIsError(false);
    setError(null);

    try {
      const supabase = createClient();

      let query = supabase
        .from("reservations")
        .select("*")
        .eq("venue_id", venueId)
        .order("reservation_time", { ascending: true });

      // Filter by date if provided
      if (date) {
        const startOfDay = `${date}T00:00:00`;
        const endOfDay = `${date}T23:59:59`;
        query = query
          .gte("reservation_time", startOfDay)
          .lte("reservation_time", endOfDay);
      }

      // Filter for upcoming only
      if (upcomingOnly) {
        const now = new Date().toISOString();
        query = query.gte("reservation_time", now);
      }

      const { data: reservationsData, error: reservationsError } = await query;

      if (reservationsError) {
        throw reservationsError;
      }

      if (mountedRef.current) {
        setReservations(reservationsData as RealtimeReservation[] || []);
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
  }, [venueId, date, upcomingOnly, enabled]);

  // --------------------------------------------------------------------------
  // Subscribe to Realtime Changes
  // --------------------------------------------------------------------------

  const subscribe = useCallback(() => {
    if (!venueId || !enabled) {
      return;
    }

    const channelName = SubscriptionManager.generateChannelName(venueId, 'reservations');
    
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
            table: 'reservations',
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

        const reservationPayload = payload as PostgresPayload<RealtimeReservation>;

        // Call custom callback
        if (onReservationChange) {
          onReservationChange(reservationPayload);
        }

        // Update local data
        setReservations((prevReservations) => {
          const newReservations = [...prevReservations];

          switch (reservationPayload.eventType) {
            case 'INSERT':
              if (reservationPayload.new) {
                // Filter by date if applicable
                if (date) {
                  const resDate = reservationPayload.new.reservation_time.split('T')[0];
                  if (resDate === date) {
                    newReservations.push(reservationPayload.new);
                    newReservations.sort((a, b) => 
                      new Date(a.reservation_time).getTime() - new Date(b.reservation_time).getTime()
                    );
                  }
                } else if (upcomingOnly) {
                  const now = new Date().toISOString();
                  if (reservationPayload.new.reservation_time >= now) {
                    newReservations.push(reservationPayload.new);
                  }
                } else {
                  newReservations.push(reservationPayload.new);
                }
              }
              break;

            case 'UPDATE':
              if (reservationPayload.new) {
                const index = newReservations.findIndex((r) => r.id === reservationPayload.new!.id);
                if (index >= 0) {
                  newReservations[index] = reservationPayload.new;
                } else {
                  newReservations.push(reservationPayload.new);
                }
                // Re-sort
                newReservations.sort((a, b) => 
                  new Date(a.reservation_time).getTime() - new Date(b.reservation_time).getTime()
                );
              }
              break;

            case 'DELETE':
              if (reservationPayload.old) {
                const index = newReservations.findIndex((r) => r.id === reservationPayload.old!.id);
                if (index >= 0) {
                  newReservations.splice(index, 1);
                }
              }
              break;
          }

          return newReservations;
        });
      },
    });
  }, [venueId, enabled, date, upcomingOnly, onReservationChange]);

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
      fetchReservations();
    }
    return () => {
      unsubscribe();
    };
  }, [enabled, venueId, fetchReservations, unsubscribe]);

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
    reservations,
    isLoading,
    isError,
    error,
    connectionState,
    subscribe,
    unsubscribe,
    refresh: fetchReservations,
  };
}

// ============================================================================
// Export
// ============================================================================

export type { UseRealtimeReservationsOptions, UseRealtimeReservationsReturn };
