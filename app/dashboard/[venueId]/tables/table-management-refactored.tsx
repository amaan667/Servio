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
import { useTableRuntimeState, TableRuntimeState } from '@/hooks/useTableRuntimeState';
import { useTableRealtime } from '@/hooks/useTableRealtime';
import { TableCardRefactored } from '@/components/table-management/TableCardRefactored';
import { AddTableDialog } from '@/components/table-management/AddTableDialog';
import { TabFiltersRefactored } from '@/components/table-management/TabFiltersRefactored';

type FilterType = 'ALL' | 'FREE' | 'OCCUPIED' | 'RESERVED_NOW' | 'RESERVED_LATER';

interface TableManagementRefactoredProps {
  venueId: string;
}

export function TableManagementRefactored({ venueId }: TableManagementRefactoredProps) {
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();
  
  const { 
    data: tables = [], 
    isLoading: tablesLoading, 
    error: tablesError, 
    refetch: refetchTables 
  } = useTableRuntimeState(venueId);
  
  // Calculate counters from actual table data instead of separate API call
  const counters = useMemo(() => {
    const total_tables = tables.length;
    const available = tables.filter(t => t.primary_status === 'FREE' && t.reservation_status === 'NONE').length;
    const occupied = tables.filter(t => t.primary_status === 'OCCUPIED').length;
    const reserved_now = tables.filter(t => t.reservation_status === 'RESERVED_NOW').length;
    const reserved_later = tables.filter(t => t.reservation_status === 'RESERVED_LATER').length;
    
    return {
      total_tables,
      available,
      occupied,
      reserved_now,
      reserved_later,
      unassigned_reservations: 0 // This would need to be fetched separately if needed
    };
  }, [tables]);

  // Set up real-time updates for table changes
  useTableRealtime(venueId, () => {
    console.log('[TABLE_MANAGEMENT] Real-time update triggered, refetching data');
    refetchTables();
    // Counters are now calculated from table data, so no need to refetch separately
  });
  

  const filteredTables = useMemo(() => {
    let filtered = tables;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(table => 
        table.label.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    switch (filter) {
      case 'FREE':
        filtered = filtered.filter(table => table.primary_status === 'FREE');
        break;
      case 'OCCUPIED':
        filtered = filtered.filter(table => table.primary_status === 'OCCUPIED');
        break;
      case 'RESERVED_NOW':
        filtered = filtered.filter(table => table.reservation_status === 'RESERVED_NOW');
        break;
      case 'RESERVED_LATER':
        filtered = filtered.filter(table => table.reservation_status === 'RESERVED_LATER');
        break;
      // 'ALL' shows all tables
    }

    return filtered;
  }, [tables, filter, searchQuery]);

  const filterCounts = useMemo(() => {
    // Calculate client-side counts as fallback and for debugging
    const clientSideCounts = {
      all: tables.length,
      free: tables.filter(table => table.primary_status === 'FREE').length,
      occupied: tables.filter(table => table.primary_status === 'OCCUPIED').length,
      reserved_now: tables.filter(table => table.reservation_status === 'RESERVED_NOW').length,
      reserved_later: tables.filter(table => table.reservation_status === 'RESERVED_LATER').length,
    };

    console.log('[TABLE_MANAGEMENT] Client-side counts:', clientSideCounts);
    console.log('[TABLE_MANAGEMENT] Server-side counts:', {
      all: counters.total_tables,
      free: counters.available,
      occupied: counters.occupied,
      reserved_now: counters.reserved_now,
      reserved_later: counters.reserved_later,
    });

    // Use client-side counts if server counts seem wrong or are missing
    const useClientSide = !counters.total_tables || counters.total_tables === 0 || 
                         Math.abs(counters.total_tables - tables.length) > 0;

    if (useClientSide) {
      console.log('[TABLE_MANAGEMENT] Using client-side counts due to server count issues');
      return clientSideCounts;
    }

    return {
      all: counters.total_tables,
      free: counters.available,
      occupied: counters.occupied,
      reserved_now: counters.reserved_now,
      reserved_later: counters.reserved_later,
    };
  }, [counters, tables]);

  const handleTableActionComplete = () => {
    refetchTables();
  };

  const isLoading = tablesLoading;
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
          {tables.length === 0 ? (
            <Card>
              <CardContent className="py-16">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">No tables yet</h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    Create your first table to start managing your venue's seating. Tables will automatically get a free session when created.
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
            {filteredTables.map((table) => (
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
      {tables.length > 0 && (
        <div className="mt-8 grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Tables Set Up</p>
                  <p className="text-2xl font-bold text-gray-800">{filterCounts.all}</p>
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
                  <p className="text-2xl font-bold text-green-600">{filterCounts.free}</p>
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
                  <p className="text-2xl font-bold text-amber-600">{filterCounts.occupied}</p>
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
                  <p className="text-2xl font-bold text-red-600">{filterCounts.reserved_now}</p>
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
                  <p className="text-2xl font-bold text-purple-600">{filterCounts.reserved_later}</p>
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