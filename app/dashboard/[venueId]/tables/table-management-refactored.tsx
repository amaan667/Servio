'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Search, 
  Plus, 
  Users, 
  Clock,
  AlertCircle,
  Loader2,
  QrCode,
  Calendar,
  UserCheck
} from 'lucide-react';
import { useTableRuntimeState, useTableCounters, TableRuntimeState, TableCounters } from '@/hooks/useTableRuntimeState';
import { useTableRealtime } from '@/hooks/useTableRealtime';
import { TableCardRefactored } from '@/components/table-management/TableCardRefactored';
import { AddTableDialog } from '@/components/table-management/AddTableDialog';
import { TabFiltersRefactored } from '@/components/table-management/TabFiltersRefactored';

type FilterType = 'ALL' | 'FREE' | 'OCCUPIED' | 'RESERVED_NOW' | 'RESERVED_LATER';

interface TableManagementRefactoredProps {
  venueId: string;
  initialTables?: TableRuntimeState[];
  initialCounters?: TableCounters;
  initialErrors?: {
    tables?: string;
    counters?: string;
    sessions?: string;
  };
}

export function TableManagementRefactored({ 
  venueId, 
  initialTables = [], 
  initialCounters = {
    total_tables: 0, 
    available: 0, 
    occupied: 0, 
    reserved_now: 0, 
    reserved_later: 0, 
    unassigned_reservations: 0 
  },
  initialErrors = {}
}: TableManagementRefactoredProps) {
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();
  
  console.log('[CLIENT] TableManagementRefactored props:', {
    venueId,
    initialTablesLength: initialTables.length,
    initialCounters,
    initialErrors
  });
  
  // Use initial data if provided, otherwise fall back to hooks
  const { 
    data: tables, 
    isLoading: tablesLoading, 
    error: tablesError, 
    refetch: refetchTables 
  } = useTableRuntimeState(venueId);
  
  const { 
    data: counters, 
    isLoading: countersLoading,
    refetch: refetchCounters
  } = useTableCounters(venueId);

  // Use initial data from server if available, otherwise use data from hooks
  // Prioritize client-side data if server-side data is empty but client has data
  const hasServerTables = initialTables.length > 0;
  const hasServerCounters = initialCounters.total_tables > 0;
  const hasClientTables = (tables && tables.length > 0);
  const hasClientCounters = (counters && counters.total_tables > 0);
  
  // For tables: prefer server data if available, otherwise use client data
  const finalTables = hasServerTables ? initialTables : (tables || []);
  
  // For counters: prefer server data if available, otherwise use client data
  const finalCounters = hasServerCounters ? initialCounters : (counters || {
    total_tables: 0,
    available: 0,
    occupied: 0,
    reserved_now: 0,
    reserved_later: 0,
    unassigned_reservations: 0
  });
  
  console.log('[CLIENT] Final data:', {
    hasServerTables,
    hasServerCounters,
    hasClientTables,
    hasClientCounters,
    finalTablesLength: finalTables.length,
    finalTables: finalTables.slice(0, 2), // Show first 2 tables for debugging
    finalCounters,
    tablesFromHook: tables?.length || 0,
    countersFromHook: counters
  });

  // Set up real-time updates for table changes
  useTableRealtime(venueId, () => {
    console.log('[TABLE_MANAGEMENT] Real-time update triggered, refetching data');
    refetchTables();
    refetchCounters();
  });
  

  const filteredTables = useMemo(() => {
    let filtered = finalTables;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((table: TableRuntimeState) => 
        table.label.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    switch (filter) {
      case 'FREE':
        filtered = filtered.filter((table: TableRuntimeState) => table.primary_status === 'FREE');
        break;
      case 'OCCUPIED':
        filtered = filtered.filter((table: TableRuntimeState) => table.primary_status === 'OCCUPIED');
        break;
      case 'RESERVED_NOW':
        filtered = filtered.filter((table: TableRuntimeState) => table.reservation_status === 'RESERVED_NOW');
        break;
      case 'RESERVED_LATER':
        filtered = filtered.filter((table: TableRuntimeState) => table.reservation_status === 'RESERVED_LATER');
        break;
      // 'ALL' shows all tables
    }

    return filtered;
  }, [finalTables, filter, searchQuery]);

  const filterCounts = useMemo(() => {
    return {
    all: finalCounters.total_tables,
    free: finalCounters.available,
    occupied: finalCounters.occupied,
    reserved_now: finalCounters.reserved_now,
    reserved_later: finalCounters.reserved_later,
    };
  }, [finalCounters]);

  const handleTableActionComplete = () => {
    refetchTables();
  };


  // Only show loading if we don't have any data (neither from server nor client)
  const isLoading = (tablesLoading || countersLoading) && finalTables.length === 0 && !hasServerTables;
  const error = tablesError;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-gray-600">Loading tables...</p>
        </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-red-600 mx-auto mb-4" />
            <p className="text-red-600 mb-4">{error.message}</p>
            <Button onClick={() => refetchTables()} variant="outline">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60">

        <div className="flex flex-wrap items-center gap-3 pb-3">
          <h1 className="text-2xl font-semibold">Table Management</h1>
          
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />

              <Input
                placeholder="Search tables…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-56 pl-10 rounded-xl border border-slate-200 px-3 text-sm shadow-sm"
              />
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => router.push(`/generate-qr?venue=${venueId}`)}
            >
              <QrCode className="h-4 w-4" />
            </Button>
            <AddTableDialog venueId={venueId} onTableAdded={handleTableActionComplete} />
          </div>
        </div>
        
        <TabFiltersRefactored value={filter} onChange={setFilter} counts={filterCounts} />
      </header>


      {/* Content */}
      {filteredTables.length === 0 ? (
        <div className="mt-8">
          {finalTables.length === 0 ? (
            <Card>
              <CardContent className="py-16">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">No tables yet</h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    Create your first table to start managing your venue's seating. Tables will automatically appear when customers place orders.
                  </p>
                  <AddTableDialog venueId={venueId} onTableAdded={handleTableActionComplete} />
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-16">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">No tables found</h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    {searchQuery.trim() 
                      ? `No tables match "${searchQuery}". Try adjusting your search or filter.`
                      : `No tables match the "${filter.toLowerCase().replace('_', ' ')}" filter.`
                    }
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button 
                      variant="outline" 
                      onClick={() => setSearchQuery('')}
                    >
                      Clear Search
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setFilter('ALL')}
                    >
                      Show All
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <section className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {filteredTables.map((table: TableRuntimeState) => (
              <TableCardRefactored
                key={table.table_id}
                table={table}
                venueId={venueId}
                onActionComplete={handleTableActionComplete}
                availableTables={tables}
              />
            ))}
          </div>
        </section>
      )}

      {/* Stats Summary */}
      {finalTables.length > 0 && (
        <div className="mt-8 grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Tables Set Up</p>
                  <p className="text-2xl font-bold text-gray-800">{finalCounters.total_tables}</p>
                </div>
                <Users className="h-8 w-8 text-gray-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Free Now</p>
                  <p className="text-2xl font-bold text-green-600">{finalCounters.available}</p>
                </div>
                <Clock className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">In Use Now</p>
                  <p className="text-2xl font-bold text-amber-600">{finalCounters.occupied}</p>
                </div>
                <UserCheck className="h-8 w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Reserved Now</p>
                  <p className="text-2xl font-bold text-red-600">{finalCounters.reserved_now}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Reserved Later</p>
                  <p className="text-2xl font-bold text-purple-600">{finalCounters.reserved_later}</p>
                </div>
                <Calendar className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}