import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseBrowser as createClient } from "@/lib/supabase";

const supabase = createClient();

export interface TableRuntimeState {

}

export interface TableCounters {

}

export interface UnassignedReservation {

}

// Get table runtime state (layered state)
export function useTableRuntimeState(venueId: string) {
  return useQuery({
    queryKey: ["tables", "runtime-state", venueId],

      const { data, error } = await supabase
        .from("table_runtime_state")
        .select("*")
        .eq("venue_id", venueId)
        .order("label");
      if (error) throw error;
      return data as TableRuntimeState[];
    },

}

// Get table counters with new logic
export function useTableCounters(venueId: string) {
  return useQuery({
    queryKey: ["tables", "counters", venueId],

      const { data, error } = await supabase.rpc("api_table_counters", {

      if (error) {
        
        throw error;
      }

      // The function returns a single JSON object, not an array
      const result = Array.isArray(data) ? data[0] : data;
      
      return result;
    },

}

// Get unassigned reservations
export function useUnassignedReservations(venueId: string) {
  return useQuery({
    queryKey: ["reservations", "unassigned", venueId],

      const { data, error } = await supabase
        .from("unassigned_reservations")
        .select("*")
        .eq("venue_id", venueId);
      if (error) throw error;
      return data as UnassignedReservation[];
    },

}

// Seat party (FREE → OCCUPIED)
export function useSeatParty() {
  const qc = useQueryClient();
  return useMutation({

      venueId,
      reservationId,
      serverId,
    }: {

    }) => {
      const { error } = await supabase.rpc("api_seat_party", {

      if (error) {
        
        throw error;
      }
    },
    onSuccess: (_, { tableId: _tableId }) => {
      // Invalidate all table-related queries
      qc.invalidateQueries({ queryKey: ["tables"] });
      qc.invalidateQueries({ queryKey: ["reservations"] });
    },

}

// Close table (OCCUPIED → FREE)
export function useCloseTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tableId, venueId }: { tableId: string; venueId: string }) => {
      const { error } = await supabase.rpc("api_close_table", {

      if (error) {
        
        throw error;
      }
    },

      qc.invalidateQueries({ queryKey: ["tables"] });
    },

}

// Assign reservation to table
export function useAssignReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ reservationId, tableId }: { reservationId: string; tableId: string }) => {
      const { error } = await supabase.rpc("api_assign_reservation", {

      if (error) throw error;
    },

      qc.invalidateQueries({ queryKey: ["tables"] });
      qc.invalidateQueries({ queryKey: ["reservations"] });
    },

}

// Cancel reservation
export function useCancelReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ reservationId }: { reservationId: string }) => {
      const { error } = await supabase.rpc("api_cancel_reservation", {

      if (error) throw error;
    },

      qc.invalidateQueries({ queryKey: ["tables"] });
      qc.invalidateQueries({ queryKey: ["reservations"] });
    },

}

// Mark reservation as no-show
export function useNoShowReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ reservationId }: { reservationId: string }) => {
      const { error } = await supabase.rpc("api_no_show_reservation", {

      if (error) throw error;
    },

      qc.invalidateQueries({ queryKey: ["tables"] });
      qc.invalidateQueries({ queryKey: ["reservations"] });
    },

}

// Remove table (hard delete)
export function useRemoveTable() {
  const qc = useQueryClient();
  return useMutation({

      force = false,
    }: {

    }) => {
      // Build URL with force parameter if needed
      const url = new URL(`/api/tables/${tableId}`, window.location.origin);
      if (force) {
        url.searchParams.set("force", "true");
      }

      const response = await fetch(url.toString(), {

        },

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
    },

    },

}

// Clear all table runtime state (for new day)
export function useClearAllTables() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ venueId }: { venueId: string }) => {
      const response = await fetch("/api/tables/clear", {

        },
        body: JSON.stringify({ venue_id: venueId }),

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
    },

    },

}
