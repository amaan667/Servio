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

  // Fetch table counters
  const { data: countersData, error: countersError } = await supabase.rpc('api_table_counters', {
    p_venue_id: venueId
  });

  // Fetch table sessions
  const tableIds = tables?.map((t: any) => t.id) || [];
  const { data: sessions, error: sessionsError } = await supabase
    .from('table_sessions')
    .select('*')
    .eq('venue_id', venueId)
    .is('closed_at', null)
    .in('table_id', tableIds);

  // Process tables with sessions
  const processedTables = tables?.map((table: any) => {
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
  const counters = Array.isArray(countersData) ? countersData[0] : countersData || {
    total_tables: 0,
    available: 0,
    occupied: 0,
    reserved_now: 0,
    reserved_later: 0,
    unassigned_reservations: 0
  };

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
  
  // Fetch data server-side
  const { tables, counters, errors } = await fetchTablesData(venueId);
  
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
