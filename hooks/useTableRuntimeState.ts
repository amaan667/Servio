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
      console.log('[TABLE_RUNTIME_STATE] Fetching tables for venue:', venueId);
      console.log('[TABLE_RUNTIME_STATE] Venue ID type:', typeof venueId);
      
      // First, let's check all tables (including inactive ones) to debug
      const { data: allTables, error: allTablesError } = await supabase
        .from('tables')
        .select(`
          id,
          venue_id,
          label,
          seat_count,
          is_active,
          created_at
        `)
        .eq('venue_id', venueId)
        .order('label');
      
      console.log('[TABLE_RUNTIME_STATE] All tables (including inactive):', allTables);
      console.log('[TABLE_RUNTIME_STATE] All tables error:', allTablesError);
      
      // Let's also check what venues exist
      const { data: allVenues, error: venuesError } = await supabase
        .from('venues')
        .select('venue_id, name')
        .limit(10);
      
      console.log('[TABLE_RUNTIME_STATE] All venues in database:', allVenues);
      console.log('[TABLE_RUNTIME_STATE] Current venue ID being used:', venueId);
      
      // Let's check what orders exist for this venue to see table numbers
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, table_number, customer_name, order_status, payment_status, created_at')
        .eq('venue_id', venueId)
        .order('created_at', { ascending: false })
        .limit(10);
      
      console.log('[TABLE_RUNTIME_STATE] Orders for this venue:', orders);
      console.log('[TABLE_RUNTIME_STATE] Orders error:', ordersError);
      
      // Use the raw tables API instead of the problematic view
      const { data, error } = await supabase
        .from('tables')
        .select(`
          id,
          venue_id,
          label,
          seat_count,
          is_active,
          created_at
        `)
        .eq('venue_id', venueId)
        .eq('is_active', true)
        .order('label');
      
      // If no tables exist in database, create virtual tables from orders
      if ((!data || data.length === 0) && orders && orders.length > 0) {
        console.log('[TABLE_RUNTIME_STATE] No tables in database, creating virtual tables from orders');
        
        // Get unique table numbers from orders
        const uniqueTableNumbers = [...new Set(orders.map((o: any) => o.table_number).filter(Boolean))];
        
        // Create virtual table objects
        const virtualTables = uniqueTableNumbers.map((tableNumber, index) => ({
          id: `virtual-${tableNumber}`,
          venue_id: venueId,
          label: `Table ${tableNumber}`,
          seat_count: 4,
          is_active: true,
          created_at: new Date().toISOString(),
          is_virtual: true // Flag to indicate this is a virtual table from orders
        }));
        
        console.log('[TABLE_RUNTIME_STATE] Created virtual tables:', virtualTables);
        data = virtualTables;
      }
      
      if (error) {
        console.error('[TABLE_RUNTIME_STATE] Error fetching tables:', error);
        throw error;
      }
      
      console.log('[TABLE_RUNTIME_STATE] Raw tables data:', data);
      console.log('[TABLE_RUNTIME_STATE] Tables count:', data?.length || 0);
      
      // Get table sessions for each table
      const tableIds = data.map((t: any) => t.id);
      const { data: sessions, error: sessionsError } = await supabase
        .from('table_sessions')
        .select('*')
        .eq('venue_id', venueId)
        .in('table_id', tableIds);
      
      if (sessionsError) {
        console.warn('Failed to fetch table sessions:', sessionsError);
      }
      
      // Combine tables with their sessions
      const result = data.map((table: any) => {
        const session = sessions?.find((s: any) => s.table_id === table.id);
        return {
          table_id: table.id,
          venue_id: table.venue_id,
          label: table.label,
          seat_count: table.seat_count,
          is_active: table.is_active,
          session_id: session?.id || null,
          primary_status: session?.status || 'FREE',
          opened_at: session?.opened_at || null,
          server_id: session?.server_id || null,
          reservation_status: 'NONE' as const,
          reserved_now_id: null,
          reserved_now_start: null,
          reserved_now_end: null,
          reserved_now_party_size: null,
          reserved_now_name: null,
          reserved_now_phone: null,
          next_reservation_id: null,
          next_reservation_start: null,
          next_reservation_end: null,
          next_reservation_party_size: null,
          next_reservation_name: null,
          next_reservation_phone: null
        } as TableRuntimeState;
      });
      
      return result;
    },
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
      console.log('[TABLE COUNTERS] Raw data type:', typeof data, 'Array?', Array.isArray(data));
      
      // The function returns a single JSON object, not an array
      const result = Array.isArray(data) ? data[0] : data;
      console.log('[TABLE COUNTERS] Processed data:', result);
      console.log('[TABLE COUNTERS] Result keys:', result ? Object.keys(result) : 'No data');
      console.log('[TABLE COUNTERS] Processed result:', result);
      console.log('[TABLE COUNTERS] Field mapping check:', {
        total_tables: result?.total_tables,
        available: result?.available,
        occupied: result?.occupied,
        reserved_now: result?.reserved_now,
        reserved_later: result?.reserved_later
      });
      
      // Log the actual counter values
      console.log('[TABLE COUNTERS] ACTUAL COUNTER VALUES:', {
        total_tables: result?.total_tables,
        available: result?.available,
        occupied: result?.occupied,
        reserved_now: result?.reserved_now,
        reserved_later: result?.reserved_later,
        unassigned_reservations: result?.unassigned_reservations,
        block_window_mins: result?.block_window_mins
      });
      
      // Let's also check what tables actually exist in the database
      const { data: debugTables, error: debugError } = await supabase
        .from('tables')
        .select('*')
        .eq('venue_id', venueId);
      
      console.log('[TABLE COUNTERS] Debug - All tables in database for venue:', debugTables);
      console.log('[TABLE COUNTERS] Debug - Tables count:', debugTables?.length || 0);
      
      // If there are no tables in the database, check if we should create virtual tables
      // based on orders or return zero counts
      if (!debugTables || debugTables.length === 0) {
        console.log('[TABLE COUNTERS] No tables found in database');
        
        // Check if there are any orders that would indicate tables exist
        const { data: orderTables, error: orderError } = await supabase
          .from('orders')
          .select('table_number, payment_status, order_status')
          .eq('venue_id', venueId)
          .not('table_number', 'is', null)
          .in('payment_status', ['PAID', 'UNPAID'])
          .order('created_at', { ascending: false });
        
        if (orderError) {
          console.log('[TABLE COUNTERS] Error checking order tables:', orderError);
        } else {
          console.log('[TABLE COUNTERS] Tables from orders:', orderTables);
          
          // If we have orders with table numbers, return counts based on those
          if (orderTables && orderTables.length > 0) {
            const uniqueTables = [...new Set(orderTables.map((o: any) => o.table_number))];
            const occupiedTables = orderTables.filter((o: any) => 
              o.payment_status === 'UNPAID' || 
              (o.payment_status === 'PAID' && ['PLACED', 'IN_PREP', 'READY'].includes(o.order_status))
            );
            const occupiedTableNumbers = [...new Set(occupiedTables.map((o: any) => o.table_number))];
            
            return {
              total_tables: uniqueTables.length,
              available: uniqueTables.length - occupiedTableNumbers.length,
              occupied: occupiedTableNumbers.length,
              reserved_now: 0,
              reserved_later: 0,
              unassigned_reservations: 0,
              block_window_mins: 0
            };
          }
        }
        
        // For now, return zero counts to match the empty state
        return {
          total_tables: 0,
          available: 0,
          occupied: 0,
          reserved_now: 0,
          reserved_later: 0,
          unassigned_reservations: 0,
          block_window_mins: 0
        };
      }
      
      return result;
    },
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

// Remove table (soft delete)
export function useRemoveTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tableId, venueId }: { tableId: string; venueId: string }) => {
      console.log('[TABLE HOOK] Removing table:', tableId);
      const { error } = await supabase.rpc('api_remove_table', {
        p_table_id: tableId,
        p_venue_id: venueId
      });
      if (error) {
        console.error('[TABLE HOOK] api_remove_table error:', error);
        throw error;
      }
      console.log('[TABLE HOOK] api_remove_table success');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tables'] });
    }
  });
}
