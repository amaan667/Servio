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
  Loader2,
  Receipt,
  CheckCircle2
} from 'lucide-react';
import { useTableGrid, useTableCounters, useReservations } from '@/hooks/useTableReservations';
import { useCounterOrders, useCounterOrderCounts } from '@/hooks/useCounterOrders';
import { useTableOrders, useTableOrderCounts } from '@/hooks/useTableOrders';
import { useDailyReset } from '@/hooks/useDailyReset';
import { TableCardNew } from '@/components/table-management/TableCardNew';
import { CounterOrderCard } from '@/components/table-management/CounterOrderCard';
import { TableOrderCard } from '@/components/table-management/TableOrderCard';
import { TableOrderGroupCard } from '@/components/table-management/TableOrderGroupCard';
import { AddTableDialog } from '@/components/table-management/AddTableDialog';
import { ReservationsPanel } from '@/components/table-management/ReservationsPanel';
import { DailyResetModal } from '@/components/daily-reset/DailyResetModal';

interface TableManagementClientNewProps {
  venueId: string;
}

export function TableManagementClientNew({ venueId }: TableManagementClientNewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [isManualResetting, setIsManualResetting] = useState(false);
  
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

  // Check for daily reset when component loads
  const { isChecking: isResetting, resetResult, checkAndReset } = useDailyReset(venueId);

  const handleManualReset = () => {
    setShowResetModal(true);
  };

  const handleConfirmReset = async () => {
    try {
      setIsManualResetting(true);
      console.log('🔄 [MANUAL RESET] Starting manual reset...');
      
      const response = await fetch('/api/daily-reset/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ venueId }),
      });

      const result = await response.json();

      if (response.ok) {
        console.log('🔄 [MANUAL RESET] Reset completed successfully:', result);
        
        // Refresh all data after reset
        refetchTables();
        refetchCounterOrders();
        refetchTableOrders();
        
        // Close modal and show success message
        setShowResetModal(false);
        alert(`Daily reset completed successfully!\n\nSummary:\n- Completed orders: ${result.summary.completedOrders}\n- Canceled reservations: ${result.summary.canceledReservations}\n- Deleted tables: ${result.summary.deletedTables}`);
      } else {
        console.error('🔄 [MANUAL RESET] Reset failed:', result);
        alert(`Reset failed: ${result.error}`);
      }
    } catch (error) {
      console.error('🔄 [MANUAL RESET] Error during reset:', error);
      alert('Reset failed: Network error');
    } finally {
      setIsManualResetting(false);
    }
  };

  const { 
    data: counterOrders = [], 
    isLoading: counterOrdersLoading, 
    error: counterOrdersError, 
    refetch: refetchCounterOrders 
  } = useCounterOrders(venueId);
  
  const { 
    data: counterOrderCounts = { total: 0, placed: 0, in_prep: 0, ready: 0, serving: 0 }, 
    isLoading: counterOrderCountsLoading 
  } = useCounterOrderCounts(venueId);

  const { 
    data: tableOrders = [], 
    isLoading: tableOrdersLoading, 
    error: tableOrdersError, 
    refetch: refetchTableOrders 
  } = useTableOrders(venueId);
  
  const { 
    data: tableOrderCounts = { total: 0, placed: 0, in_prep: 0, ready: 0, serving: 0 }, 
    isLoading: tableOrderCountsLoading 
  } = useTableOrderCounts(venueId);

  const filteredTables = useMemo(() => {
    let filtered = tables;

    // Apply search filter only
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(table => 
        table.label.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [tables, searchQuery]);

  const filterCounts = useMemo(() => {
    // Calculate counts from the actual tables data
    const totalTables = tables.length;
    const freeTables = tables.filter(table => table.session_status === 'FREE').length;
    const occupiedTables = tables.filter(table => table.session_status === 'OCCUPIED').length;
    const reservedTables = tables.filter(table => table.reservation_status === 'RESERVED_NOW' || table.reservation_status === 'RESERVED_LATER').length;
    
    return {
      all: totalTables,
      free: freeTables,
      occupied: occupiedTables,
      reserved: reservedTables,
    };
  }, [tables]);

  // Group table orders by table
  const groupedTableOrders = useMemo(() => {
    const groups: { [key: string]: any[] } = {};
    
    tableOrders.forEach(order => {
      const tableKey = order.table_label || `Table ${order.table_number}`;
      if (!groups[tableKey]) {
        groups[tableKey] = [];
      }
      groups[tableKey].push(order);
    });
    
    return groups;
  }, [tableOrders]);

  const handleTableActionComplete = () => {
    refetchTables();
    refetchCounterOrders();
    refetchTableOrders();
  };

  const error = tablesError || counterOrdersError || tableOrdersError;

  // Remove loading state - render immediately with empty state if needed
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
          
          {/* Daily Reset Status */}
          {isResetting && (
            <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Checking daily reset...</span>
            </div>
          )}
          
          {resetResult && resetResult.success && !resetResult.alreadyReset && (
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full">
              <CheckCircle2 className="h-4 w-4" />
              <span>Daily reset completed</span>
            </div>
          )}
          
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
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleManualReset}
              disabled={isResetting}
              className="text-orange-600 border-orange-200 hover:bg-orange-50"
            >
              {isResetting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              {isResetting ? 'Resetting...' : 'Daily Reset'}
            </Button>
            <Button variant="outline" size="sm">
              <HelpCircle className="h-4 w-4 mr-2" />
              Help
            </Button>
          </div>
        </div>
        
      </header>

      {/* 🔹 COUNTER ORDERS - Always at the top (lane view) */}
      {counterOrders.length > 0 ? (
        <section className="mt-6">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Counter Orders</h2>
            <p className="text-sm text-gray-600">
              Fast-moving orders from counter service - work FIFO ({counterOrders.length} active)
            </p>
          </div>
          
          {/* Horizontal scroll lane for counter orders */}
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-max">
              {counterOrders
                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) // Oldest first
                .map((order) => (
                <div key={order.id} className="flex-shrink-0 w-80">
                  <CounterOrderCard
                    order={order}
                    venueId={venueId}
                    onActionComplete={handleTableActionComplete}
                  />
                </div>
              ))}
            </div>
          </div>
          
          {/* Counter Orders Quick Stats */}
          <div className="mt-4 grid grid-cols-4 gap-3">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="text-center">
                <p className="text-sm font-medium text-yellow-800">Placed</p>
                <p className="text-xl font-bold text-yellow-600">
                  {counterOrders.filter(order => order.order_status === 'PLACED').length}
                </p>
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="text-center">
                <p className="text-sm font-medium text-blue-800">Preparing</p>
                <p className="text-xl font-bold text-blue-600">
                  {counterOrders.filter(order => order.order_status === 'IN_PREP').length}
                </p>
              </div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="text-center">
                <p className="text-sm font-medium text-green-800">Completed</p>
                <p className="text-xl font-bold text-green-600">
                  {counterOrders.filter(order => order.order_status === 'COMPLETED').length}
                </p>
              </div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="text-center">
                <p className="text-sm font-medium text-gray-800">Total</p>
                <p className="text-xl font-bold text-gray-600">{counterOrders.length}</p>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="mt-6">
          <Card>
            <CardContent className="py-10">
              <div className="text-center text-sm text-gray-600">
                <p>Currently no counter orders.</p>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* 🔹 TABLE ORDERS - Active orders only in grid format */}
      {tableOrders.length > 0 ? (
        <section className="mt-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Table Orders (Active Only)</h2>
            <p className="text-sm text-gray-600">
              Dine-in orders requiring staff attention - grouped by table ({tableOrders.length} active orders)
            </p>
          </div>
          
          {/* Table Orders Grid - Each table shows active orders */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Object.entries(groupedTableOrders).map(([tableLabel, orders]) => (
              <div key={tableLabel} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">{tableLabel}</h3>
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs text-gray-600">{orders.length} active</span>
                  </div>
                </div>
                
                {/* Show mixed status if orders are at different stages */}
                <div className="mb-3">
                  {(() => {
                    const statuses = [...new Set(orders.map(o => o.order_status))];
                    if (statuses.length > 1) {
                      return (
                        <div className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                          Mixed status
                        </div>
                      );
                    } else {
                      const status = statuses[0];
                      const statusColors = {
                        'PLACED': 'bg-yellow-100 text-yellow-800',
                        'IN_PREP': 'bg-blue-100 text-blue-800',
                        'READY': 'bg-green-100 text-green-800',
                        'SERVING': 'bg-purple-100 text-purple-800'
                      };
                      return (
                        <div className={`text-xs px-2 py-1 rounded ${statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800'}`}>
                          {status.replace('_', ' ').toLowerCase()}
                        </div>
                      );
                    }
                  })()}
                </div>
                
                {/* Click to expand orders */}
                <div className="space-y-2">
                  {orders.slice(0, 2).map((order) => (
                    <div key={order.id} className="text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">#{order.id.slice(0, 6)}</span>
                        <span className="font-medium">£{order.total_amount?.toFixed(2) || '0.00'}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(order.created_at).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                  {orders.length > 2 && (
                    <div className="text-xs text-gray-500 text-center">
                      +{orders.length - 2} more orders
                    </div>
                  )}
                </div>
                
                {/* Quick action button */}
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <Button 
                    size="sm" 
                    className="w-full text-xs"
                    onClick={() => {
                      // This would open a drawer with full order details
                      console.log('Open table orders drawer for', tableLabel);
                    }}
                  >
                    View Orders
                  </Button>
                </div>
              </div>
            ))}
          </div>
          
          {/* Table Orders Quick Stats */}
          <div className="mt-4 grid grid-cols-4 gap-3">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="text-center">
                <p className="text-sm font-medium text-yellow-800">Placed</p>
                <p className="text-xl font-bold text-yellow-600">
                  {tableOrders.filter(order => order.order_status === 'PLACED').length}
                </p>
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="text-center">
                <p className="text-sm font-medium text-blue-800">Preparing</p>
                <p className="text-xl font-bold text-blue-600">
                  {tableOrders.filter(order => order.order_status === 'IN_PREP').length}
                </p>
              </div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="text-center">
                <p className="text-sm font-medium text-green-800">Completed</p>
                <p className="text-xl font-bold text-green-600">
                  {tableOrders.filter(order => order.order_status === 'COMPLETED').length}
                </p>
              </div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="text-center">
                <p className="text-sm font-medium text-gray-800">Total</p>
                <p className="text-xl font-bold text-gray-600">{tableOrders.length}</p>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="mt-8">
          <Card>
            <CardContent className="py-10">
              <div className="text-center text-sm text-gray-600">
                <p>Currently no table orders.</p>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* 🔹 TABLE MANAGEMENT - Admin/layout tools at bottom */}
      <section className="mt-8">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Table Management</h2>
          <p className="text-sm text-gray-600">
            Configure table setup and seating layout ({filterCounts.all} tables set up)
          </p>
        </div>
      </section>

      {/* 🔹 RESERVATIONS - Secondary position (toggleable sidebar/drawer) */}
      {!reservationsLoading && reservations.length > 0 && (
        <div className="mt-6">
          <ReservationsPanel 
            venueId={venueId} 
            reservations={reservations}
            onActionComplete={handleTableActionComplete}
          />
        </div>
      )}

      {/* Table Grid - Shows table tiles with occupancy state */}
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
                      ? `No tables match "${searchQuery}". Try adjusting your search.`
                      : 'No tables found.'
                    }
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button 
                      variant="outline" 
                      onClick={() => setSearchQuery('')}
                    >
                      Clear Search
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <section className="mt-6">
          {/* Table Grid - Each tile shows occupancy state and badge count */}
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {filteredTables.map((table) => (
              <div key={table.id} className="relative">
                <TableCardNew
                  table={table}
                  venueId={venueId}
                  onActionComplete={handleTableActionComplete}
                  availableTables={tables}
                />
                
                {/* Overlay reservation info if table is reserved */}
                {(table.reservation_status === 'RESERVED_NOW' || table.reservation_status === 'RESERVED_LATER') && (
                  <div className="absolute top-2 right-2 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full border border-blue-200">
                    Reserved
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 🔹 SUMMARY STATS - Table occupancy overview */}
      {tables.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Table Status Overview</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Tables</p>
                    <p className="text-2xl font-bold">{filterCounts.all}</p>
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
                    <p className="text-sm font-medium text-gray-600">Reserved</p>
                    <p className="text-2xl font-bold text-blue-600">{filterCounts.reserved}</p>
                  </div>
                  <Clock className="h-8 w-8 text-blue-400" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Daily Reset Confirmation Modal */}
      <DailyResetModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onConfirm={handleConfirmReset}
        isResetting={isManualResetting}
        venueName="this venue"
      />
    </div>
  );
}
