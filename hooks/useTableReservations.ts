import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

export interface TableGridItem {
  id: string;
  label: string;
  seat_count: number;
  session_status: 'FREE' | 'OCCUPIED';
  opened_at: string | null;
  order_id: string | null;
  total_amount: number | null;
  order_status: string | null;
  order_updated_at: string | null;
}

export interface TableCounters {
  total_tables: number;
  available: number;
  occupied: number;
  reserved_overlapping_now: number;
}

export interface Reservation {
  id: string;
  venue_id: string;
  table_id: string | null;
  start_at: string;
  end_at: string;
  party_size: number;
  name: string | null;
  phone: string | null;
  status: 'BOOKED' | 'CHECKED_IN' | 'CANCELLED' | 'NO_SHOW';
  created_at: string;
  updated_at: string;
}

// Get table grid data
export function useTableGrid(venueId: string) {
  return useQuery({
    queryKey: ['tables', 'grid', venueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('table_runtime_state')
        .select('*')
        .eq('venue_id', venueId)
        .order('label');
      if (error) throw error;
      
      // Transform the data to match the expected TableGridItem interface
      return data.map((item: any) => ({
        id: item.table_id,
        label: item.label,
        seat_count: item.seat_count,
        session_status: item.primary_status === 'OCCUPIED' ? 'OCCUPIED' : 'FREE',
        opened_at: item.opened_at,
        order_id: null, // This would need to be fetched separately if needed
        total_amount: null, // This would need to be fetched separately if needed
        order_status: null, // This would need to be fetched separately if needed
        order_updated_at: null // This would need to be fetched separately if needed
      })) as TableGridItem[];
    },
    refetchInterval: 15000,
    enabled: !!venueId
  });
}

// Get table counters
export function useTableCounters(venueId: string) {
  return useQuery({
    queryKey: ['tables', 'counters', venueId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('api_table_counters', { 
        p_venue_id: venueId 
      });
      if (error) throw error;
      return data[0] as TableCounters;
    },
    refetchInterval: 15000,
    enabled: !!venueId
  });
}

// Get reservations for a venue
export function useReservations(venueId: string) {
  return useQuery({
    queryKey: ['reservations', venueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .eq('venue_id', venueId)
        .order('start_at', { ascending: true });
      if (error) throw error;
      return data as Reservation[];
    },
    refetchInterval: 30000,
    enabled: !!venueId
  });
}

// Seat a walk-in customer
export function useSeatWalkIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ venueId, tableId }: { venueId: string; tableId: string }) => {
      const { error } = await supabase.rpc('api_seat_walkin', { 
        p_venue_id: venueId, 
        p_table_id: tableId 
      });
      if (error) throw error;
    },
    onSuccess: (_, { venueId }) => {
      qc.invalidateQueries({ queryKey: ['tables', 'grid', venueId] });
      qc.invalidateQueries({ queryKey: ['tables', 'counters', venueId] });
    }
  });
}

// Reserve a table
export function useReserveTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      venueId: string;
      tableId: string | null;
      startAt: string;
      endAt: string;
      partySize: number;
      name?: string;
      phone?: string;
    }) => {
      const { error } = await supabase.rpc('api_reserve_table', {
        p_venue_id: payload.venueId,
        p_table_id: payload.tableId,
        p_start_at: payload.startAt,
        p_end_at: payload.endAt,
        p_party_size: payload.partySize,
        p_name: payload.name ?? null,
        p_phone: payload.phone ?? null
      });
      if (error) throw error;
    },
    onSuccess: (_, { venueId }) => {
      qc.invalidateQueries({ queryKey: ['tables', 'counters', venueId] });
      qc.invalidateQueries({ queryKey: ['reservations', venueId] });
    }
  });
}

// Check-in a reservation
export function useCheckInReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ reservationId, tableId }: { reservationId: string; tableId: string }) => {
      const { error } = await supabase.rpc('api_checkin_reservation', {
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

// Close a table
export function useCloseTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tableId, venueId }: { tableId: string; venueId: string }) => {
      const { error } = await supabase.rpc('api_close_table', { 
        p_table_id: tableId,
        p_venue_id: venueId
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tables'] });
    }
  });
}

// Cancel a reservation
export function useCancelReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ reservationId }: { reservationId: string }) => {
      const { error } = await supabase
        .from('reservations')
        .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
        .eq('id', reservationId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservations'] });
      qc.invalidateQueries({ queryKey: ['tables', 'counters'] });
    }
  });
}
