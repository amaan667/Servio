import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

export interface TableGridItem {
  id: string;
  label: string;
  seat_count: number;
  session_status: 'FREE' | 'OCCUPIED' | 'RESERVED';
  reservation_status: 'RESERVED_NOW' | 'RESERVED_LATER' | 'NONE';
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
  customer_name: string | null;
  customer_phone: string | null;
  status: 'BOOKED' | 'CHECKED_IN' | 'CANCELLED' | 'NO_SHOW' | 'COMPLETED';
  created_at: string;
  updated_at: string;
}

// Get table grid data
export function useTableGrid(venueId: string, leadTimeMinutes: number = 30) {
  const queryClient = useQueryClient();
  
  const query = useQuery({
    queryKey: ['tables', 'grid', venueId, leadTimeMinutes],
    queryFn: async () => {
      // First, get the table data from the main tables table (which has merged_with_table_id)
      const { data: tableData, error: tableError } = await supabase
        .from('tables')
        .select('*')
        .eq('venue_id', venueId)
        .eq('is_active', true)
        .is('merged_with_table_id', null) // Filter out merged tables
        .order('label');
      if (tableError) throw tableError;
      
      // Get all active table sessions for this venue (including FREE status)
      const { data: tableSessions, error: sessionsError } = await supabase
        .from('table_sessions')
        .select('*')
        .eq('venue_id', venueId)
        .in('status', ['FREE', 'ORDERING', 'IN_PREP', 'READY', 'SERVED', 'AWAITING_BILL']) // Include FREE status
        .order('opened_at', { ascending: false });
      if (sessionsError) throw sessionsError;
      
      // Get all active reservations for this venue
      const { data: reservations, error: reservationError } = await supabase
        .from('reservations')
        .select('*')
        .eq('venue_id', venueId)
        .in('status', ['BOOKED', 'CHECKED_IN']) // Active reservation statuses
        .order('start_at', { ascending: true });
      if (reservationError) throw reservationError;
      
      const now = new Date();
      // Use the configurable lead time - reservations become active X minutes before start
      
      // console.log('🔍 [TABLE GRID] All reservations:', reservations);
      // console.log('🔍 [TABLE GRID] Current time:', now.toISOString());
      
      // Transform the data to match the expected TableGridItem interface
      return tableData.map((item: any) => {
        // Find active table session for this table
        const activeSession = tableSessions.find((s: any) => s.table_id === item.id);
        
        // Find reservations for this table
        const tableReservations = reservations.filter((r: any) => r.table_id === item.id);
        
        let reservationStatus = 'NONE';
        let activeReservation = null;
        
        // Check for active reservations based on time and status
        for (const reservation of tableReservations) {
          const startTime = new Date(reservation.start_at);
          const endTime = new Date(reservation.end_at);
          const leadTime = new Date(startTime.getTime() - (leadTimeMinutes * 60 * 1000));
          
          // Reservation is active if:
          // 1. We're within the lead time window (30 minutes before start)
          // 2. We haven't passed the end time
          // 3. Status is not cancelled/completed
          if (now >= leadTime && now <= endTime) {
            activeReservation = reservation;
            
            // Determine if it's "now" or "later"
            if (now >= startTime) {
              reservationStatus = 'RESERVED_NOW';
            } else {
              reservationStatus = 'RESERVED_LATER';
            }
            break; // Use the first active reservation found
          }
        }
        
        // Determine the primary session status
        let sessionStatus = 'FREE';
        let openedAt = null;
        let orderId = null;
        let totalAmount = null;
        let orderStatus = null;
        let orderUpdatedAt = null;
        
        // Priority 1: If there's an active table session with non-FREE status, table is OCCUPIED
        if (activeSession && activeSession.status !== 'FREE') {
          sessionStatus = 'OCCUPIED';
          openedAt = activeSession.opened_at;
          orderId = activeSession.order_id;
          totalAmount = activeSession.total_amount;
          orderStatus = activeSession.status;
          orderUpdatedAt = activeSession.updated_at;
        }
        // Priority 2: If there's an active reservation, the table is RESERVED (overrides FREE session)
        else if (reservationStatus === 'RESERVED_NOW' || reservationStatus === 'RESERVED_LATER') {
          sessionStatus = 'RESERVED';
          // If there's a FREE session, still use its data for consistency
          if (activeSession && activeSession.status === 'FREE') {
            openedAt = activeSession.opened_at;
            orderId = activeSession.order_id;
            totalAmount = activeSession.total_amount;
            orderStatus = activeSession.status;
            orderUpdatedAt = activeSession.updated_at;
          }
        }
        // Priority 3: If there's a FREE session or no session, table is FREE
        else if (activeSession && activeSession.status === 'FREE') {
          sessionStatus = 'FREE';
          openedAt = activeSession.opened_at;
          orderId = activeSession.order_id;
          totalAmount = activeSession.total_amount;
          orderStatus = activeSession.status;
          orderUpdatedAt = activeSession.updated_at;
        }
        // Priority 4: No session and no reservation = FREE
        
        return {
          id: item.id,
          label: item.label,
          seat_count: item.seat_count,
          session_status: sessionStatus,
          reservation_status: reservationStatus,
          opened_at: openedAt,
          order_id: orderId,
          total_amount: totalAmount,
          order_status: orderStatus,
          order_updated_at: orderUpdatedAt
        };
      }) as TableGridItem[];
    },
    refetchInterval: 15000,
    enabled: !!venueId,
    staleTime: 5000, // Consider data fresh for 5 seconds
    gcTime: 30000, // Keep in cache for 30 seconds
    retry: 3, // Retry failed requests 3 times
    retryDelay: 1000 // Wait 1 second between retries
  });

  // Set up real-time subscriptions for table updates
  useEffect(() => {
    if (!venueId) return;

    console.log('[TABLE GRID] Setting up real-time subscriptions for venue:', venueId);

    // Subscribe to table_sessions changes (for session status updates)
    const tableSessionsChannel = supabase
      .channel('table-grid-sessions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'table_sessions',
          filter: `venue_id=eq.${venueId}`,
        },
        (payload: any) => {
          console.log('[TABLE GRID] Real-time table_sessions update received:', payload);
          // Invalidate and refetch the table grid data
          queryClient.invalidateQueries({ queryKey: ['tables', 'grid', venueId, leadTimeMinutes] });
        }
      )
      .subscribe();

    // Subscribe to reservations changes
    const reservationsChannel = supabase
      .channel('table-grid-reservations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
          filter: `venue_id=eq.${venueId}`,
        },
        (payload: any) => {
          console.log('[TABLE GRID] Real-time reservations update received:', payload);
          // Invalidate and refetch the table grid data
          queryClient.invalidateQueries({ queryKey: ['tables', 'grid', venueId, leadTimeMinutes] });
        }
      )
      .subscribe();

    // Subscribe to tables changes
    const tablesChannel = supabase
      .channel('table-grid-tables')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tables',
          filter: `venue_id=eq.${venueId}`,
        },
        (payload: any) => {
          console.log('[TABLE GRID] Real-time tables update received:', payload);
          // Invalidate and refetch the table grid data
          queryClient.invalidateQueries({ queryKey: ['tables', 'grid', venueId, leadTimeMinutes] });
        }
      )
      .subscribe();

    return () => {
      console.log('[TABLE GRID] Cleaning up real-time subscriptions');
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
    queryKey: ['tables', 'counters', venueId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('api_table_counters', { 
        p_venue_id: venueId 
      });
      if (error) throw error;
      return data[0] as TableCounters;
    },
    refetchInterval: 15000,
    enabled: !!venueId,
    staleTime: 5000,
    gcTime: 30000,
    retry: 3,
    retryDelay: 1000
  });
}

// Get reservations for a venue
export function useReservations(venueId: string) {
  return useQuery({
    queryKey: ['reservations', venueId],
    queryFn: async (): Promise<(Reservation & { table?: { label: string } })[]> => {
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          *,
          table:table_id(label)
        `)
        .eq('venue_id', venueId)
        .order('start_at', { ascending: true });
      if (error) throw error;
      return data as (Reservation & { table?: { label: string } })[];
    },
    refetchInterval: 5000, // Reduced from 30 seconds to 5 seconds for faster updates
    enabled: !!venueId,
    staleTime: 2000, // Consider data fresh for 2 seconds (reservations change frequently)
    gcTime: 30000,
    retry: 3,
    retryDelay: 1000
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
      const response = await fetch('/api/reservations/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({
          venueId: payload.venueId,
          tableId: payload.tableId,
          startAt: payload.startAt,
          endAt: payload.endAt,
          partySize: payload.partySize,
          name: payload.name,
          phone: payload.phone
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create reservation');
      }

      return response.json();
    },
    onSuccess: (_, { venueId }) => {
      qc.invalidateQueries({ queryKey: ['tables', 'counters', venueId] });
      qc.invalidateQueries({ queryKey: ['reservations', venueId] });
      qc.invalidateQueries({ queryKey: ['tables', 'grid', venueId] }); // Also invalidate table grid to update reservation status
    }
  });
}

// Check-in a reservation
export function useCheckInReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ reservationId, tableId }: { reservationId: string; tableId: string }) => {
      const response = await fetch('/api/reservations/checkin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({ reservationId, tableId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to check in reservation');
      }

      return response.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tables'] });
      qc.invalidateQueries({ queryKey: ['reservations'] });
      qc.invalidateQueries({ queryKey: ['tables', 'grid'] }); // Also invalidate table grid
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
      qc.invalidateQueries({ queryKey: ['tables', 'grid'] }); // Also invalidate table grid
    }
  });
}

// Auto-complete expired reservations
export function useAutoCompleteReservations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ venueId }: { venueId: string }) => {
      const response = await fetch('/api/reservations/auto-complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({ venueId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to auto-complete reservations');
      }

      return response.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservations'] });
      qc.invalidateQueries({ queryKey: ['tables', 'counters'] });
      qc.invalidateQueries({ queryKey: ['tables', 'grid'] });
    }
  });
}

// Check and complete reservations for a specific table
export function useCheckReservationCompletion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ venueId, tableId }: { venueId: string; tableId: string }) => {
      const response = await fetch('/api/reservations/check-completion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({ venueId, tableId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to check reservation completion');
      }

      return response.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservations'] });
      qc.invalidateQueries({ queryKey: ['tables', 'counters'] });
      qc.invalidateQueries({ queryKey: ['tables', 'grid'] });
    }
  });
}

// Modify an existing reservation
export function useModifyReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      reservationId: string;
      customerName: string;
      startAt: string;
      endAt: string;
      partySize: number;
      customerPhone?: string;
    }) => {
      const response = await fetch(`/api/reservations/${payload.reservationId}/modify`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({
          customerName: payload.customerName,
          startAt: payload.startAt,
          endAt: payload.endAt,
          partySize: payload.partySize,
          customerPhone: payload.customerPhone
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to modify reservation');
      }

      return response.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservations'] });
      qc.invalidateQueries({ queryKey: ['tables', 'counters'] });
      qc.invalidateQueries({ queryKey: ['tables', 'grid'] });
    }
  });
}

// Get reservation by table ID
export function useReservationByTable(tableId: string) {
  return useQuery({
    queryKey: ['reservation', 'by-table', tableId],
    queryFn: async () => {
      const response = await fetch(`/api/reservations/by-table/${tableId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch reservation');
      }

      const result = await response.json();
      return result.reservation;
    },
    enabled: !!tableId,
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
  });
}
