import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { invalidateCountsForVenue } from "@/lib/cache/count-cache";

const supabase = createClient();

export interface TableRuntimeState {
  table_id: string;
  venue_id: string;
  label: string;
  seat_count: number;
  is_active: boolean;
  session_id: string | null;

  // PRIMARY STATE: FREE (available for seating) or OCCUPIED (currently seated)
  primary_status: "FREE" | "OCCUPIED" | null;
  opened_at: string | null;
  server_id: string | null;

  // SECONDARY LAYER: Reservation status underneath the primary state
  reservation_status: "RESERVED_NOW" | "RESERVED_LATER" | "NONE";
  reserved_now_id: string | null;
  reserved_now_start: string | null;
  reserved_now_end: string | null;
  reserved_now_party_size: number | null;
  reserved_now_name: string | null;
  reserved_now_phone: string | null;
  next_reservation_id: string | null;
  next_reservation_start: string | null;
  next_reservation_end: string | null;
  next_reservation_party_size: number | null;
  next_reservation_name: string | null;
  next_reservation_phone: string | null;
}

export interface TableCounters {
  total_tables: number;
  available: number;
  occupied: number;
  reserved_now: number;
  reserved_later: number;
  unassigned_reservations: number;
}

export interface UnassignedReservation {
  id: string;
  venue_id: string;
  start_at: string;
  end_at: string;
  party_size: number;
  name: string | null;
  phone: string | null;
  status: "BOOKED" | "CHECKED_IN" | "CANCELLED" | "NO_SHOW";
  created_at: string;
}

// Get table runtime state (layered state)
export function useTableRuntimeState(venueId: string) {
  return useQuery({
    queryKey: ["tables", "runtime-state", venueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("table_runtime_state")
        .select("*")
        .eq("venue_id", venueId)
        .order("label");
      if (error) throw error;
      return data as TableRuntimeState[];
    },
    enabled: !!venueId,
  });
}

// Get table counters with new logic
export function useTableCounters(venueId: string) {
  return useQuery({
    queryKey: ["tables", "counters", venueId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("api_table_counters", {
        p_venue_id: venueId,
      });
      if (error) {
        throw error;
      }

      // The function returns a single JSON object, not an array
      const result = Array.isArray(data) ? data[0] : data;

      return result;
    },
    enabled: !!venueId,
  });
}

// Get unassigned reservations
export function useUnassignedReservations(venueId: string) {
  return useQuery({
    queryKey: ["reservations", "unassigned", venueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unassigned_reservations")
        .select("*")
        .eq("venue_id", venueId);
      if (error) throw error;
      return data as UnassignedReservation[];
    },
    refetchInterval: 15000,
    enabled: !!venueId,
  });
}

// Seat party (FREE → OCCUPIED)
export function useSeatParty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      tableId,
      venueId,
      reservationId,
      serverId,
    }: {
      tableId: string;
      venueId: string;
      reservationId?: string;
      serverId?: string;
    }) => {
      const { error } = await supabase.rpc("api_seat_party", {
        p_table_id: tableId,
        p_venue_id: venueId,
        p_reservation_id: reservationId || null,
        p_server_id: serverId || null,
      });
      if (error) {
        throw error;
      }
    },
    onSuccess: (_, { venueId: vId }) => {
      qc.invalidateQueries({ queryKey: ["tables"] });
      qc.invalidateQueries({ queryKey: ["reservations"] });
      if (typeof window !== "undefined") invalidateCountsForVenue(vId);
    },
  });
}

// Close table (OCCUPIED → FREE)
export function useCloseTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tableId, venueId }: { tableId: string; venueId: string }) => {
      const { error } = await supabase.rpc("api_close_table", {
        p_table_id: tableId,
        p_venue_id: venueId,
      });
      if (error) {
        throw error;
      }
    },
    onSuccess: (_, { venueId: vId }) => {
      qc.invalidateQueries({ queryKey: ["tables"] });
      if (typeof window !== "undefined") invalidateCountsForVenue(vId);
    },
  });
}

// Assign reservation to table
export function useAssignReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      reservationId,
      tableId,
      venueId: _vId,
    }: {
      reservationId: string;
      tableId: string;
      venueId?: string;
    }) => {
      const { error } = await supabase.rpc("api_assign_reservation", {
        p_reservation_id: reservationId,
        p_table_id: tableId,
      });
      if (error) throw error;
    },
    onSuccess: (_, { venueId: vId }) => {
      qc.invalidateQueries({ queryKey: ["tables"] });
      qc.invalidateQueries({ queryKey: ["reservations"] });
      if (vId && typeof window !== "undefined") invalidateCountsForVenue(vId);
    },
  });
}

// Cancel reservation
export function useCancelReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      reservationId,
      venueId: _vId,
    }: {
      reservationId: string;
      venueId?: string;
    }) => {
      const { error } = await supabase.rpc("api_cancel_reservation", {
        p_reservation_id: reservationId,
      });
      if (error) throw error;
    },
    onSuccess: (_, { venueId: vId }) => {
      qc.invalidateQueries({ queryKey: ["tables"] });
      qc.invalidateQueries({ queryKey: ["reservations"] });
      if (vId && typeof window !== "undefined") invalidateCountsForVenue(vId);
    },
  });
}

// Mark reservation as no-show
export function useNoShowReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      reservationId,
      venueId: _vId,
    }: {
      reservationId: string;
      venueId?: string;
    }) => {
      const { error } = await supabase.rpc("api_no_show_reservation", {
        p_reservation_id: reservationId,
      });
      if (error) throw error;
    },
    onSuccess: (_, { venueId: vId }) => {
      qc.invalidateQueries({ queryKey: ["tables"] });
      qc.invalidateQueries({ queryKey: ["reservations"] });
      if (vId && typeof window !== "undefined") invalidateCountsForVenue(vId);
    },
  });
}

// Remove table (hard delete)
export function useRemoveTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      tableId,
      venueId: _venueId,
      force = false,
    }: {
      tableId: string;
      venueId: string;
      force?: boolean;
    }) => {
      // Build URL with force parameter if needed
      const url = new URL(`/api/tables/${tableId}`, window.location.origin);
      if (force) {
        url.searchParams.set("force", "true");
      }

      const response = await fetch(url.toString(), {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData?.error?.message || errorData?.error || "Failed to delete table";

        throw new Error(errorMessage);
      }

      const responseData = await response.json();
      return responseData;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["tables"] });
      qc.invalidateQueries({ queryKey: ["tables", "runtime-state"] });
      qc.invalidateQueries({ queryKey: ["tables", "counters"] });
      qc.invalidateQueries({ queryKey: ["tables", "runtime-state", variables.venueId] });
      qc.invalidateQueries({ queryKey: ["tables", "counters", variables.venueId] });
      if (typeof window !== "undefined") invalidateCountsForVenue(variables.venueId);
    },
    onError: (_error) => {
      // Error handled silently
    },
  });
}

// Clear all table runtime state (for new day)
export function useClearAllTables() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ venueId }: { venueId: string }) => {
      const response = await fetch("/api/tables/clear", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ venue_id: venueId }),
      });

      if (!response.ok) {
        const errorData = await response.json();

        throw new Error(errorData.error || "Failed to clear table runtime state");
      }

      const responseData = await response.json();
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["tables"] });
      qc.invalidateQueries({ queryKey: ["tables", "runtime-state"] });
      qc.invalidateQueries({ queryKey: ["tables", "counters"] });
      qc.invalidateQueries({ queryKey: ["tables", "runtime-state", variables.venueId] });
      qc.invalidateQueries({ queryKey: ["tables", "counters", variables.venueId] });
      if (typeof window !== "undefined") invalidateCountsForVenue(variables.venueId);
    },
    onError: (_error) => {
      // Error handled silently
    },
  });
}
