'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Search, 
  Plus, 
  HelpCircle, 
  Users, 
  Clock,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useTableGrid, useTableCounters, useReservations } from '@/hooks/useTableReservations';
import { TableCardNew } from '@/components/table-management/TableCardNew';
import { AddTableDialog } from '@/components/table-management/AddTableDialog';
import { TabFiltersNew } from '@/components/table-management/TabFiltersNew';
import { ReservationsPanel } from '@/components/table-management/ReservationsPanel';

type FilterType = 'ALL' | 'FREE' | 'OCCUPIED' | 'RESERVED';

interface TableManagementClientNewProps {
  venueId: string;
}

export function TableManagementClientNew({ venueId }: TableManagementClientNewProps) {
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  const { 
    data: tables = [], 
    isLoading: tablesLoading, 
    error: tablesError, 
    refetch: refetchTables 
  } = useTableGrid(venueId);
  
  const { 
    data: counters = { total_tables: 0, available: 0, occupied: 0, reserved_overlapping_now: 0 }, 
    isLoading: countersLoading 
  } = useTableCounters(venueId);
  
  const { 
    data: reservations = [], 
    isLoading: reservationsLoading 
  } = useReservations(venueId);

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
        filtered = filtered.filter(table => table.session_status === 'FREE');
        break;
      case 'OCCUPIED':
        filtered = filtered.filter(table => table.session_status === 'OCCUPIED');
        break;
      case 'RESERVED':
        // For now, show all tables when "Reserved" is selected
        // In a full implementation, you'd filter by tables with overlapping reservations
        break;
      // 'ALL' shows all tables
    }

    return filtered;
  }, [tables, filter, searchQuery]);

  const filterCounts = useMemo(() => {
    return {
      all: counters.total_tables,
      free: counters.available,
      occupied: counters.occupied,
      reserved: counters.reserved_overlapping_now,
    };
  }, [counters]);

  const handleTableActionComplete = () => {
    refetchTables();
  };

  const isLoading = tablesLoading || countersLoading;
  const error = tablesError;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-purple-600" />
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
            <AddTableDialog venueId={venueId} onTableAdded={handleTableActionComplete} />
            <Button variant="outline" size="sm">
              <HelpCircle className="h-4 w-4 mr-2" />
              Help
            </Button>
          </div>
        </div>
        
        <TabFiltersNew value={filter} onChange={setFilter} counts={filterCounts} />
      </header>

      {/* Reservations Panel */}
      {!reservationsLoading && reservations.length > 0 && (
        <div className="mt-6">
          <ReservationsPanel 
            venueId={venueId} 
            reservations={reservations}
            onActionComplete={handleTableActionComplete}
          />
        </div>
      )}

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
                      : `No tables match the "${filter.toLowerCase()}" filter.`
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
              <TableCardNew
                key={table.id}
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
        <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Tables</p>
                  <p className="text-2xl font-bold">{counters.total_tables}</p>
                </div>
                <Users className="h-8 w-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Available</p>
                  <p className="text-2xl font-bold text-green-600">{counters.available}</p>
                </div>
                <Clock className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Occupied</p>
                  <p className="text-2xl font-bold text-amber-600">{counters.occupied}</p>
                </div>
                <Users className="h-8 w-8 text-amber-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Reserved</p>
                  <p className="text-2xl font-bold text-blue-600">{counters.reserved_overlapping_now}</p>
                </div>
                <Clock className="h-8 w-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
