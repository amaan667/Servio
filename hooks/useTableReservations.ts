import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { getCachedQueryData, setCachedQueryData } from "@/lib/persistent-cache";

const supabase = createClient();

export interface TableGridItem {

}

export interface TableCounters {

}

export interface Reservation {

}

// Get table grid data
export function useTableGrid(venueId: string, leadTimeMinutes: number = 30) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["tables", "grid", venueId, leadTimeMinutes],
    // ANTI-FLICKER: Use cached data as placeholder

      getCachedQueryData<TableGridItem[]>(["tables", "grid", venueId, String(leadTimeMinutes)]),

      // First, get the table data from the main tables table (which has merged_with_table_id)
      const { data: tableData, error: tableError } = await supabase
        .from("tables")
        .select("*")
        .eq("venue_id", venueId)
        .eq("is_active", true)
        .is("merged_with_table_id", null) // Filter out merged tables
        .order("label");
      if (tableError) throw tableError;

      // Get all active table sessions for this venue (including FREE and OCCUPIED status)
      const { data: tableSessions, error: sessionsError } = await supabase
        .from("table_sessions")
        .select("*")
        .eq("venue_id", venueId)
        .in("status", [
          "FREE",
          "OCCUPIED",
          "ORDERING",
          "IN_PREP",
          "READY",
          "SERVED",
          "AWAITING_BILL",
        ]) // Include FREE and OCCUPIED status
        .order("opened_at", { ascending: false });
      if (sessionsError) throw sessionsError;

      // Get all active reservations for this venue
      const { data: reservations, error: reservationError } = await supabase
        .from("reservations")
        .select("*")
        .eq("venue_id", venueId)
        .in("status", ["BOOKED", "CHECKED_IN"]) // Active reservation statuses
        .order("start_at", { ascending: true });
      if (reservationError) throw reservationError;

      const now = new Date();
      // Use the configurable lead time - reservations become active X minutes before start

      interface TableSession {

      }

      // Transform the data to match the expected TableGridItem interface
      return tableData.map((item: Record<string, unknown>) => {
        // Find active table session for this table
        const activeSession = tableSessions.find(
          (s: unknown) => (s as TableSession).table_id === item.id
        ) as TableSession | undefined;

        // Find reservations for this table
        const tableReservations = reservations.filter(
          (r: unknown) => (r as Reservation).table_id === item.id
        ) as Reservation[];

        let reservationStatus = "NONE";
        let activeReservation: unknown = null;

        // Check for active reservations based on time and status
        for (const reservation of tableReservations) {
          const res = reservation as { start_at: string; end_at: string; status?: string };
          const startTime = new Date(res.start_at);
          const endTime = new Date(res.end_at);
          const leadTime = new Date(startTime.getTime() - leadTimeMinutes * 60 * 1000);

          // Reservation is active if:
          // 1. We're within the lead time window (30 minutes before start)
          // 2. We haven't passed the end time
          // 3. Status is not cancelled/completed
          if (now >= leadTime && now <= endTime) {
            activeReservation = reservation;

            // Determine if it's "now" or "later"
            if (now >= startTime) {
              reservationStatus = "RESERVED_NOW";
            } else {
              reservationStatus = "RESERVED_LATER";
            }
            break; // Use the first active reservation found
          }
        }

        // Determine the primary session status
        let sessionStatus = "FREE";
        let openedAt = null;
        let orderId = null;
        let totalAmount = null;
        let orderStatus = null;
        let paymentStatus = null;
        let orderUpdatedAt = null;

        // Priority 1: If there's an active table session with OCCUPIED status or non-FREE status, table is OCCUPIED
        if (
          activeSession &&
          (activeSession.status === "OCCUPIED" || activeSession.status !== "FREE")
        ) {
          sessionStatus = "OCCUPIED";
          openedAt = activeSession.opened_at;
          orderId = activeSession.order_id;
          totalAmount = activeSession.total_amount;
          orderStatus = activeSession.order_status;
          paymentStatus = activeSession.payment_status;
          orderUpdatedAt = activeSession.updated_at;
        }
        // Priority 2: If there's an active reservation, the table is RESERVED (overrides FREE session)
        else if (reservationStatus === "RESERVED_NOW" || reservationStatus === "RESERVED_LATER") {
          sessionStatus = "RESERVED";
          // If there's a FREE session, still use its data for consistency
          if (activeSession && activeSession.status === "FREE") {
            openedAt = activeSession.opened_at;
            orderId = activeSession.order_id;
            totalAmount = activeSession.total_amount;
            orderStatus = activeSession.status;
            orderUpdatedAt = activeSession.updated_at;
          }
        }
        // Priority 3: If there's a FREE session or no session, table is FREE
        else if (activeSession && activeSession.status === "FREE") {
          sessionStatus = "FREE";
          openedAt = activeSession.opened_at;
          orderId = activeSession.order_id;
          totalAmount = activeSession.total_amount;
          orderStatus = activeSession.status;
          orderUpdatedAt = activeSession.updated_at;
        }
        // Priority 4: No session and no reservation = FREE

        return {

        };
      }) as TableGridItem[];
    },
    // ANTI-FLICKER: Don't refetch too frequently
    refetchInterval: 30000, // 30 seconds (was 15)
    refetchIntervalInBackground: true, // Refetch silently in background

    staleTime: 15000, // Data fresh for 15 seconds (was 0)
    refetchOnMount: false, // Don't refetch on mount (use cache, was true)
    refetchOnWindowFocus: false, // Don't refetch on window focus
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes (was 30 seconds)
    retry: 1, // Retry failed requests once (was 3)
    retryDelay: 1000, // Wait 1 second between retries

  // ANTI-FLICKER: Cache query data when it changes
  useEffect(() => {
    if (query.data) {
      setCachedQueryData(
        ["tables", "grid", venueId, String(leadTimeMinutes)],
        query.data,
        5 * 60 * 1000
      );
    }
  }, [query.data, venueId, leadTimeMinutes]);

  // Set up real-time subscriptions for table updates
  useEffect(() => {
    if (!venueId) return;

    // Subscribe to table_sessions changes (for session status updates)
    const tableSessionsChannel = supabase
      .channel("table-grid-sessions")
      .on(
        "postgres_changes",
        {

          filter: `venue_id=eq.${venueId}`,
        },
        () => {
          // Invalidate and refetch the table grid data
          queryClient.invalidateQueries({ queryKey: ["tables", "grid", venueId, leadTimeMinutes] });
        }
      )
      .subscribe();

    // Subscribe to reservations changes
    const reservationsChannel = supabase
      .channel("table-grid-reservations")
      .on(
        "postgres_changes",
        {

          filter: `venue_id=eq.${venueId}`,
        },
        () => {
          // Invalidate and refetch the table grid data
          queryClient.invalidateQueries({ queryKey: ["tables", "grid", venueId, leadTimeMinutes] });
        }
      )
      .subscribe();

    // Subscribe to tables changes
    const tablesChannel = supabase
      .channel("table-grid-tables")
      .on(
        "postgres_changes",
        {

          filter: `venue_id=eq.${venueId}`,
        },
        () => {
          // Invalidate and refetch the table grid data
          queryClient.invalidateQueries({ queryKey: ["tables", "grid", venueId, leadTimeMinutes] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(tableSessionsChannel);
      supabase.removeChannel(reservationsChannel);
      supabase.removeChannel(tablesChannel);
    };
  }, [venueId, leadTimeMinutes, queryClient]);

  return query;
}

// Get table counters
export function useTableCounters(venueId: string) {
  return useQuery({
    queryKey: ["tables", "counters", venueId],

      const { data, error } = await supabase.rpc("api_table_counters", {

      if (error) throw error;
      return data[0] as TableCounters;
    },

    staleTime: 0, // Always consider data stale to ensure fresh data on navigation
    refetchOnMount: true, // Always refetch when component mounts

}

// Get reservations for a venue
export function useReservations(venueId: string) {
  return useQuery({
    queryKey: ["reservations", venueId],
    queryFn: async (): Promise<(Reservation & { table?: { label: string } })[]> => {
      const { data, error } = await supabase
        .from("reservations")
        .select(
          `
          *,

        .eq("venue_id", venueId)
        .order("start_at", { ascending: true });
      if (error) throw error;
      return data as (Reservation & { table?: { label: string } })[];
    },
    refetchInterval: 5000, // Reduced from 30 seconds to 5 seconds for faster updates

    staleTime: 0, // Always consider data stale to ensure fresh data on navigation
    refetchOnMount: true, // Always refetch when component mounts

}

// Seat a walk-in customer
export function useSeatWalkIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ venueId, tableId }: { venueId: string; tableId: string }) => {
      const { error } = await supabase.rpc("api_seat_walkin", {

      if (error) throw error;
    },
    onSuccess: (_, { venueId }) => {
      qc.invalidateQueries({ queryKey: ["tables", "grid", venueId] });
      qc.invalidateQueries({ queryKey: ["tables", "counters", venueId] });
    },

}

// Reserve a table
export function useReserveTable() {
  const qc = useQueryClient();
  return useMutation({

    }) => {
      const response = await fetch("/api/reservations/create", {

        },
        credentials: "include", // Include cookies for authentication

        }),

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create reservation");
      }

      return response.json();
    },
    onSuccess: (_, { venueId }) => {
      qc.invalidateQueries({ queryKey: ["tables", "counters", venueId] });
      qc.invalidateQueries({ queryKey: ["reservations", venueId] });
      qc.invalidateQueries({ queryKey: ["tables", "grid", venueId] }); // Also invalidate table grid to update reservation status
    },

}

// Check-in a reservation
export function useCheckInReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ reservationId, tableId }: { reservationId: string; tableId: string }) => {
      const response = await fetch("/api/reservations/checkin", {

        },
        credentials: "include", // Include cookies for authentication
        body: JSON.stringify({ reservationId, tableId }),

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to check in reservation");
      }

      return response.json();
    },

      qc.invalidateQueries({ queryKey: ["tables"] });
      qc.invalidateQueries({ queryKey: ["reservations"] });
      qc.invalidateQueries({ queryKey: ["tables", "grid"] }); // Also invalidate table grid
    },

}

// Close a table
export function useCloseTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tableId, venueId }: { tableId: string; venueId: string }) => {
      const { error } = await supabase.rpc("api_close_table", {

      if (error) throw error;
    },

      qc.invalidateQueries({ queryKey: ["tables"] });
    },

}

// Cancel a reservation
export function useCancelReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ reservationId }: { reservationId: string }) => {
      const { error } = await supabase
        .from("reservations")
        .update({ status: "CANCELLED", updated_at: new Date().toISOString() })
        .eq("id", reservationId);
      if (error) throw error;
    },

      qc.invalidateQueries({ queryKey: ["reservations"] });
      qc.invalidateQueries({ queryKey: ["tables", "counters"] });
      qc.invalidateQueries({ queryKey: ["tables", "grid"] }); // Also invalidate table grid
    },

}

// Auto-complete expired reservations
export function useAutoCompleteReservations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ venueId }: { venueId: string }) => {
      const response = await fetch("/api/reservations/auto-complete", {

        },
        credentials: "include", // Include cookies for authentication
        body: JSON.stringify({ venueId }),

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to auto-complete reservations");
      }

      return response.json();
    },

      qc.invalidateQueries({ queryKey: ["reservations"] });
      qc.invalidateQueries({ queryKey: ["tables", "counters"] });
      qc.invalidateQueries({ queryKey: ["tables", "grid"] });
    },

}

// Check and complete reservations for a specific table
export function useCheckReservationCompletion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ venueId, tableId }: { venueId: string; tableId: string }) => {
      const response = await fetch("/api/reservations/check-completion", {

        },
        credentials: "include", // Include cookies for authentication
        body: JSON.stringify({ venueId, tableId }),

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to check reservation completion");
      }

      return response.json();
    },

      qc.invalidateQueries({ queryKey: ["reservations"] });
      qc.invalidateQueries({ queryKey: ["tables", "counters"] });
      qc.invalidateQueries({ queryKey: ["tables", "grid"] });
    },

}

// Modify an existing reservation
export function useModifyReservation() {
  const qc = useQueryClient();
  return useMutation({

    }) => {
      const response = await fetch(`/api/reservations/${payload.reservationId}/modify`, {

        },
        credentials: "include", // Include cookies for authentication

        }),

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to modify reservation");
      }

      return response.json();
    },

      qc.invalidateQueries({ queryKey: ["reservations"] });
      qc.invalidateQueries({ queryKey: ["tables", "counters"] });
      qc.invalidateQueries({ queryKey: ["tables", "grid"] });
    },

}

// Get reservation by table ID
export function useReservationByTable(tableId: string) {
  return useQuery({
    queryKey: ["reservation", "by-table", tableId],

      const response = await fetch(`/api/reservations/by-table/${tableId}`, {

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch reservation");
      }

      const result = await response.json();
      return result.reservation;
    },

    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates

}

// Delete table with instant optimistic updates
export function useDeleteTable(venueId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tableId, force = false }: { tableId: string; force?: boolean }) => {
      const { apiClient } = await import("@/lib/api-client");
      const url = force ? `/api/tables/${tableId}?force=true` : `/api/tables/${tableId}`;
      const response = await apiClient.delete(url);

      if (!response.ok) {
        const errorData = await response.json();
        // Extract error message properly - handle nested error objects
        let errorMessage = "Failed to delete table";

        if (errorData.error) {
          if (typeof errorData.error === "string") {
            errorMessage = errorData.error;
          } else if (errorData.error.message) {
            errorMessage = errorData.error.message;
          } else if (errorData.error.code) {
            errorMessage = `Error code: ${errorData.error.code}`;
          }
        }

        throw new Error(errorMessage);
      }

      return await response.json();
    },
    // Optimistic update - remove table INSTANTLY from UI
    onMutate: async ({ tableId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["tables", "grid", venueId] });

      // Get current table data
      const previousTables = queryClient.getQueryData(["tables", "grid", venueId]);

      // Optimistically remove the table from cache
      queryClient.setQueryData(["tables", "grid", venueId], (old: TableGridItem[] | undefined) => {
        if (!old) return [];
        return old.filter((table) => table.id !== tableId);

      // Return context with previous data for rollback
      return { previousTables };
    },
    // On error, rollback to previous state
    onError: (error, _tableId, context) => {
      if (context?.previousTables) {
        queryClient.setQueryData(["tables", "grid", venueId], context.previousTables);
      }

      toast({

    },
    // Always refetch to ensure we're in sync

      queryClient.invalidateQueries({ queryKey: ["tables", "grid", venueId] });
      queryClient.invalidateQueries({ queryKey: ["tables", "counters", venueId] });
    },

    },

}
