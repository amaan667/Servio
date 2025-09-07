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
import { useTablesData, TableWithSession } from '@/hooks/useTablesData';
import { useTableCounters } from '@/hooks/useTableCounters';
import { TableCard } from '@/components/table-management/TableCard';
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
    tables = [], 
    loading: tablesLoading, 
    error: tablesError, 
    refetch: refetchTables 
  } = useTablesData(venueId);
  
  const { 
    counters, 
    loading: countersLoading,
    refetch: refetchCounters
  } = useTableCounters(venueId);

  // Provide default values to prevent null reference errors
  const safeCounters = counters || { 
    tables_set_up: 0, 
    free_now: 0, 
    in_use_now: 0, 
    reserved_now: 0, 
    reserved_later: 0, 
    block_window_mins: 0
  };
  

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
        filtered = filtered.filter(table => table.status === 'FREE');
        break;
      case 'OCCUPIED':
        filtered = filtered.filter(table => 
          ['ORDERING', 'IN_PREP', 'READY', 'SERVED', 'AWAITING_BILL'].includes(table.status)
        );
        break;
      case 'RESERVED_NOW':
        filtered = filtered.filter(table => table.status === 'RESERVED' && table.reserved_now_id);
        break;
      case 'RESERVED_LATER':
        filtered = filtered.filter(table => table.status === 'RESERVED' && table.reserved_later_id);
        break;
      // 'ALL' shows all tables
    }

    return filtered;
  }, [tables, filter, searchQuery]);

  const filterCounts = useMemo(() => {
    return {
      all: safeCounters.tables_set_up,
      free: safeCounters.free_now,
      occupied: safeCounters.in_use_now,
      reserved_now: safeCounters.reserved_now,
      reserved_later: safeCounters.reserved_later,
    };
  }, [safeCounters]);

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
              <TableCard
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
        <div className="mt-8 grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Tables Set Up</p>
                  <p className="text-2xl font-bold text-gray-800">{safeCounters.tables_set_up}</p>
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
                  <p className="text-2xl font-bold text-green-600">{safeCounters.free_now}</p>
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
                  <p className="text-2xl font-bold text-amber-600">{safeCounters.in_use_now}</p>
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
                  <p className="text-2xl font-bold text-red-600">{counters.reserved_now}</p>
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
                  <p className="text-2xl font-bold text-purple-600">{counters.reserved_later}</p>
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
