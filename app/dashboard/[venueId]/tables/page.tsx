import { Suspense } from 'react';
import { TableManagementRefactored } from './table-management-refactored';
import NavigationBreadcrumb from '@/components/navigation-breadcrumb';
import { createServerSupabase } from '@/lib/supabase-server';

interface TableManagementPageProps {
  params: Promise<{
    venueId: string;
  }>;
}

async function fetchTablesData(venueId: string) {
  const supabase = await createServerSupabase();
  
  console.log('[SERVER] Fetching tables for venue:', venueId);
  console.log('[SERVER] Supabase client created:', !!supabase);
  
  // Fetch tables
  const { data: tables, error: tablesError } = await supabase
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

  console.log('[SERVER] Tables fetched:', tables?.length || 0, 'Error:', tablesError?.message);

  // Fetch table counters
  const { data: countersData, error: countersError } = await supabase.rpc('api_table_counters', {
    p_venue_id: venueId
  });

  console.log('[SERVER] Counters fetched:', countersData, 'Error:', countersError?.message);

  // If no actual tables exist, check for orders to create virtual tables
  let finalTables = tables;
  if ((!tables || tables.length === 0)) {
    console.log('[SERVER] No actual tables found, checking orders for virtual tables');
    
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('table_number, payment_status, order_status, created_at')
      .eq('venue_id', venueId)
      .not('table_number', 'is', null)
      .order('created_at', { ascending: false });

    if (ordersError) {
      console.log('[SERVER] Error fetching orders:', ordersError);
    } else if (orders && orders.length > 0) {
      console.log('[SERVER] Found orders with table numbers:', orders.length);
      
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
      
      console.log('[SERVER] Created virtual tables:', virtualTables.length);
      finalTables = virtualTables;
    }
  }

  // Fetch table sessions
  const tableIds = finalTables?.map((t: any) => t.id) || [];
  const { data: sessions, error: sessionsError } = await supabase
    .from('table_sessions')
    .select('*')
    .eq('venue_id', venueId)
    .is('closed_at', null)
    .in('table_id', tableIds);

  // Process tables with sessions
  const processedTables = finalTables?.map((table: any) => {
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
    };
  }) || [];

  // Process counters
  let counters = Array.isArray(countersData) ? countersData[0] : countersData || {
    total_tables: 0,
    available: 0,
    occupied: 0,
    reserved_now: 0,
    reserved_later: 0,
    unassigned_reservations: 0
  };

  // If we created virtual tables, we need to recalculate counters based on orders
  if (finalTables && finalTables.some((t: any) => t.is_virtual)) {
    console.log('[SERVER] Recalculating counters for virtual tables');
    
    // Get orders to calculate real-time status
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('table_number, payment_status, order_status, created_at')
      .eq('venue_id', venueId)
      .not('table_number', 'is', null)
      .order('created_at', { ascending: false });

    if (!ordersError && orders && orders.length > 0) {
      const uniqueTableNumbers = [...new Set(orders.map((o: any) => o.table_number).filter(Boolean))];
      
      // Calculate occupied tables (unpaid orders or paid orders that are still active)
      const occupiedTables = orders.filter((o: any) => 
        o.payment_status === 'UNPAID' || 
        (o.payment_status === 'PAID' && ['PLACED', 'IN_PREP', 'READY'].includes(o.order_status))
      );
      const occupiedTableNumbers = [...new Set(occupiedTables.map((o: any) => o.table_number))];
      
      counters = {
        total_tables: uniqueTableNumbers.length,
        available: uniqueTableNumbers.length - occupiedTableNumbers.length,
        occupied: occupiedTableNumbers.length,
        reserved_now: 0,
        reserved_later: 0,
        unassigned_reservations: 0
      };
      
      console.log('[SERVER] Virtual table counters:', counters);
    }
  }

  console.log('[SERVER] Processed tables:', processedTables?.length || 0);
  console.log('[SERVER] Final counters:', counters);

  return {
    tables: processedTables,
    counters,
    errors: {
      tables: tablesError?.message,
      counters: countersError?.message,
      sessions: sessionsError?.message
    }
  };
}

export default async function TableManagementPage({ params }: TableManagementPageProps) {
  const { venueId } = await params;
  
  console.log('[SERVER PAGE] venueId:', venueId);
  
  // Fetch data server-side
  const { tables, counters, errors } = await fetchTablesData(venueId);
  
  console.log('[SERVER PAGE] Data to pass to client:', {
    tablesLength: tables?.length || 0,
    counters,
    errors
  });
  
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <NavigationBreadcrumb venueId={venueId} />
        <Suspense fallback={<div className="text-center py-8 text-gray-600">Loading tables...</div>}>
          <TableManagementRefactored 
            venueId={venueId} 
            initialTables={tables}
            initialCounters={counters}
            initialErrors={errors}
          />
        </Suspense>
      </div>
    </div>
  );
}
