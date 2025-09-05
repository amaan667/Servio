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
import { useTablesData, TableWithSession } from '@/hooks/useTablesData';
import { TableCard } from '@/components/table-management/TableCard';
import { AddTableDialog } from '@/components/table-management/AddTableDialog';
import { TabFilters } from '@/components/table-management/TabFilters';

type FilterType = 'ALL' | 'FREE' | 'OCCUPIED' | 'WAITING' | 'RESERVED' | 'CLOSED';

interface TableManagementClientProps {
  venueId: string;
}

export function TableManagementClient({ venueId }: TableManagementClientProps) {
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const { tables, loading, error, refetch } = useTablesData(venueId);

  // Debug logging
  console.log('[TABLE MANAGEMENT] Component rendering:', { 
    venueId, 
    loading, 
    error, 
    tablesCount: tables?.length || 0,
    timestamp: new Date().toISOString()
  });

  // Additional detailed logging for navigation debugging
  useEffect(() => {
    console.log('[TABLE MANAGEMENT] Navigation debug - Component mounted:', {
      venueId,
      timestamp: new Date().toISOString(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
      url: typeof window !== 'undefined' ? window.location.href : 'server'
    });
  }, [venueId]);

  useEffect(() => {
    console.log('[TABLE MANAGEMENT] Loading state changed:', {
      loading,
      error,
      tablesCount: tables?.length || 0,
      timestamp: new Date().toISOString()
    });
  }, [loading, error, tables]);

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
      case 'WAITING':
        filtered = filtered.filter(table => 
          ['IN_PREP', 'READY', 'SERVED'].includes(table.status)
        );
        break;
      case 'RESERVED':
        filtered = filtered.filter(table => table.status === 'RESERVED');
        break;
      case 'CLOSED':
        filtered = filtered.filter(table => table.status === 'CLOSED');
        break;
      // 'ALL' shows all tables
    }

    return filtered;
  }, [tables, filter, searchQuery]);

  const filterCounts = useMemo(() => {
    const counts = {
      all: tables.length,
      free: tables.filter(t => t.status === 'FREE').length,
      occupied: tables.filter(t => 
        ['ORDERING', 'IN_PREP', 'READY', 'SERVED', 'AWAITING_BILL'].includes(t.status)
      ).length,
      waiting: tables.filter(t => 
        ['IN_PREP', 'READY', 'SERVED'].includes(t.status)
      ).length,
      reserved: tables.filter(t => t.status === 'RESERVED').length,
      closed: tables.filter(t => t.status === 'CLOSED').length,
    };
    return counts;
  }, [tables]);

  const handleTableActionComplete = () => {
    refetch();
  };

  if (loading) {
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
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={refetch} variant="outline">
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
        
        <TabFilters value={filter} onChange={setFilter} counts={filterCounts} />
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
        <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Tables</p>
                  <p className="text-2xl font-bold">{tables.length}</p>
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
                  <p className="text-2xl font-bold text-green-600">{filterCounts.free}</p>
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
                  <p className="text-2xl font-bold text-amber-600">{filterCounts.occupied}</p>
                </div>
                <Users className="h-8 w-8 text-amber-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Waiting</p>
                  <p className="text-2xl font-bold text-violet-600">{filterCounts.waiting}</p>
                </div>
                <Clock className="h-8 w-8 text-violet-400" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
