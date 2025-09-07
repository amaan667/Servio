import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

export interface TableRuntimeState {
  table_id: string;
  venue_id: string;
  label: string;
  seat_count: number;
  is_active: boolean;
  session_id: string | null;
  
  // PRIMARY STATE: FREE (available for seating) or OCCUPIED (currently seated)
  primary_status: 'FREE' | 'OCCUPIED' | null;
  opened_at: string | null;
  server_id: string | null;
  
  // SECONDARY LAYER: Reservation status underneath the primary state
  reservation_status: 'RESERVED_NOW' | 'RESERVED_LATER' | 'NONE';
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
  status: 'BOOKED' | 'CHECKED_IN' | 'CANCELLED' | 'NO_SHOW';
  created_at: string;
}

// Get table runtime state (layered state)
export function useTableRuntimeState(venueId: string) {
  return useQuery({
    queryKey: ['tables', 'runtime-state', venueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('table_runtime_state')
        .select('*')
        .eq('venue_id', venueId)
        .order('label');
      if (error) throw error;
      return data as TableRuntimeState[];
    },
    refetchInterval: 10000, // Refresh every 10 seconds
    enabled: !!venueId
  });
}

// Get table counters with new logic
export function useTableCounters(venueId: string) {
  return useQuery({
    queryKey: ['tables', 'counters', venueId],
    queryFn: async () => {
      console.log('[TABLE COUNTERS] Fetching counters for venue:', venueId);
      const { data, error } = await supabase.rpc('api_table_counters', { 
        p_venue_id: venueId 
      });
      if (error) {
        console.error('[TABLE COUNTERS] Error:', error);
        throw error;
      }
      console.log('[TABLE COUNTERS] Raw data:', data);
      const result = data[0] as TableCounters;
      console.log('[TABLE COUNTERS] Processed result:', result);
      return result;
    },
    refetchInterval: 10000,
    enabled: !!venueId
  });
}

// Get unassigned reservations
export function useUnassignedReservations(venueId: string) {
  return useQuery({
    queryKey: ['reservations', 'unassigned', venueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('unassigned_reservations')
        .select('*')
        .eq('venue_id', venueId);
      if (error) throw error;
      return data as UnassignedReservation[];
    },
    refetchInterval: 15000,
    enabled: !!venueId
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
      serverId 
    }: { 
      tableId: string; 
      venueId: string;
      reservationId?: string; 
      serverId?: string; 
    }) => {
      console.log('[TABLE HOOK] Seating party:', { tableId, venueId, reservationId, serverId });
      const { error } = await supabase.rpc('api_seat_party', {
        p_table_id: tableId,
        p_venue_id: venueId,
        p_reservation_id: reservationId || null,
        p_server_id: serverId || null
      });
      if (error) {
        console.error('[TABLE HOOK] api_seat_party error:', error);
        throw error;
      }
      console.log('[TABLE HOOK] api_seat_party success');
    },
    onSuccess: (_, { tableId }) => {
      // Invalidate all table-related queries
      qc.invalidateQueries({ queryKey: ['tables'] });
      qc.invalidateQueries({ queryKey: ['reservations'] });
    }
  });
}

// Close table (OCCUPIED → FREE)
export function useCloseTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tableId, venueId }: { tableId: string; venueId: string }) => {
      console.log('[TABLE HOOK] Closing table:', tableId);
      const { error } = await supabase.rpc('api_close_table', { 
        p_table_id: tableId,
        p_venue_id: venueId
      });
      if (error) {
        console.error('[TABLE HOOK] api_close_table error:', error);
        throw error;
      }
      console.log('[TABLE HOOK] api_close_table success');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tables'] });
    }
  });
}

// Assign reservation to table
export function useAssignReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ 
      reservationId, 
      tableId 
    }: { 
      reservationId: string; 
      tableId: string; 
    }) => {
      const { error } = await supabase.rpc('api_assign_reservation', {
        p_reservation_id: reservationId,
        p_table_id: tableId
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tables'] });
      qc.invalidateQueries({ queryKey: ['reservations'] });
    }
  });
}

// Cancel reservation
export function useCancelReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ reservationId }: { reservationId: string }) => {
      const { error } = await supabase.rpc('api_cancel_reservation', {
        p_reservation_id: reservationId
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tables'] });
      qc.invalidateQueries({ queryKey: ['reservations'] });
    }
  });
}

// Mark reservation as no-show
export function useNoShowReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ reservationId }: { reservationId: string }) => {
      const { error } = await supabase.rpc('api_no_show_reservation', {
        p_reservation_id: reservationId
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tables'] });
      qc.invalidateQueries({ queryKey: ['reservations'] });
    }
  });
}
