'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
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
  Receipt,
  CheckCircle2
} from 'lucide-react';
import { useTableGrid, useTableCounters, useReservations } from '@/hooks/useTableReservations';
import { useCounterOrders, useCounterOrderCounts, useCounterOrdersRealtime } from '@/hooks/useCounterOrders';
import { useTableOrders, useTableOrderCounts, useTableOrdersRealtime } from '@/hooks/useTableOrders';
import { useDailyReset } from '@/hooks/useDailyReset';
import { useGroupSessions } from '@/hooks/useGroupSessions';
import type { GroupSession } from '@/hooks/useGroupSessions';
import { TableCardNew } from '@/components/table-management/TableCardNew';
import { OrderCard } from '@/components/orders/OrderCard';
import { mapCounterOrderToCardData } from '@/lib/orders/mapCounterOrderToCardData';
import { TableOrderGroupCard } from '@/components/table-management/TableOrderGroupCard';
import { AddTableDialog } from '@/components/table-management/AddTableDialog';
import { ReservationsPanel } from '@/components/table-management/ReservationsPanel';
import { DailyResetModal } from '@/components/daily-reset/DailyResetModal';
import { toast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase/client';
import MobileNav from '@/components/MobileNav';

interface TableManagementClientNewProps {
  venueId: string;
}

export function TableManagementClientNew({ venueId }: TableManagementClientNewProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [isManualResetting, setIsManualResetting] = useState(false);
  
  const { 
    data: tables = [], 
    isLoading: tablesLoading, 
    error: tablesError, 
    refetch: refetchTables 
  } = useTableGrid(venueId, 30); // 30 minutes lead time - configurable
  
  // Add focus-based refresh to ensure data is fresh when navigating back to this page
  useEffect(() => {
    const handleFocus = () => {
      // Refetch all data when window gains focus (e.g., switching back from live orders)
      refetchTables();
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refetchTables]);
  
  const { 
    data: counters = { total_tables: 0, available: 0, occupied: 0, reserved_overlapping_now: 0 }, 
    isLoading: countersLoading 
  } = useTableCounters(venueId);
  
  const { 
    data: reservations = [], 
    isLoading: reservationsLoading 
  } = useReservations(venueId);

  // Manage group sessions at the parent level to prevent multiple API calls
  const { groupSessions } = useGroupSessions(venueId);

  // const autoCompleteReservations = useAutoCompleteReservations();
  // const autoCompleteRef = useRef(autoCompleteReservations);

  // Check for daily reset when component loads
  const { isChecking: isResetting, resetResult, checkAndReset } = useDailyReset(venueId);


  const handleManualReset = () => {
    // Check if there's anything to reset
    const hasActiveOrders = counterOrders.length > 0 || tableOrders.length > 0;
    const hasActiveTables = tables.some(table => table.session_status === 'OCCUPIED');
    const hasActiveReservations = reservations.some(reservation => 
      reservation.status === 'BOOKED' || reservation.status === 'CHECKED_IN'
    );
    
    // Also check for any orders that are not completed (in any status except COMPLETED)
    const hasIncompleteOrders = counterOrders.some(order => order.order_status !== 'COMPLETED') ||
                               tableOrders.some(order => order.order_status !== 'COMPLETED');
    
    const hasAnythingToReset = hasActiveOrders || hasActiveTables || hasActiveReservations || hasIncompleteOrders;
    
    if (!hasAnythingToReset) {
      // Show toast that there's nothing to reset
      toast({
        title: "Nothing to Reset",
        description: "There's currently nothing to reset. No active orders, occupied tables, or confirmed reservations found.",
        variant: "default",
      });
      return;
    }
    
    // If there's something to reset, show the confirmation modal
    setShowResetModal(true);
  };

  const handleConfirmReset = async () => {
    try {
      setIsManualResetting(true);
      
      const response = await fetch('/api/daily-reset/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({ venueId }),
      });

      const result = await response.json();

      if (response.ok) {
        
        // Refresh all data after reset
        refetchTables();
        refetchCounterOrders();
        refetchTableOrders();
        
        // Close modal and show success message
        setShowResetModal(false);
        alert(`Reset completed successfully!\n\nSummary:\n- Completed orders: ${result.summary.completedOrders}\n- Canceled reservations: ${result.summary.canceledReservations}\n- Deleted tables: ${result.summary.deletedTables}`);
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

  // Enable real-time updates for counter and table orders
  useCounterOrdersRealtime(venueId);
  useTableOrdersRealtime(venueId);

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
    // A table is only truly "free" if it has no session AND no reservation
    const freeTables = tables.filter(table => 
      table.session_status === 'FREE' && table.reservation_status === 'NONE'
    ).length;
    const occupiedTables = tables.filter(table => table.session_status === 'OCCUPIED').length;
    const reservedTables = tables.filter(table => 
      table.reservation_status === 'RESERVED_NOW' || table.reservation_status === 'RESERVED_LATER'
    ).length;
    
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
    
    // Filter out duplicate orders by ID to prevent double counting
    const uniqueOrders = tableOrders.filter((order, index, self) => 
      index === self.findIndex(o => o.id === order.id)
    );
    
    uniqueOrders.forEach(order => {
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

  // Add real-time subscriptions for instant updates
  useEffect(() => {
    if (!venueId) return;

    const supabase = createClient();
    
    // Subscribe to reservation changes for instant updates
    const reservationSubscription = supabase
      .channel(`reservations-${venueId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
          filter: `venue_id=eq.${venueId}`,
        },
        () => {
          // Invalidate and refetch reservations data
          refetchTables();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(reservationSubscription);
    };
  }, [venueId]); // Removed refetchTables from dependencies to prevent recreation

  // Auto-complete expired reservations every 5 minutes
  // TEMPORARILY DISABLED due to resource exhaustion issues
  // TODO: Re-enable once the useEffect dependency issue is resolved
  /*
  useEffect(() => {
    if (!venueId) return;

    // Update ref with current mutation function
    autoCompleteRef.current = autoCompleteReservations;

    const autoCompleteInterval = setInterval(async () => {
      try {
        await autoCompleteRef.current.mutateAsync({ venueId });
      } catch (error) {
        console.error('[AUTO COMPLETE] Error:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes

    // Also run once on component mount
    const runInitialCheck = async () => {
      try {
        await autoCompleteRef.current.mutateAsync({ venueId });
      } catch (error) {
        console.error('[AUTO COMPLETE] Initial check error:', error);
      }
    };

    runInitialCheck();

    return () => {
      clearInterval(autoCompleteInterval);
    };
  }, [venueId]); // Removed autoCompleteReservations from dependencies
  */

  const error = tablesError || counterOrdersError || tableOrdersError;
  
  // Show loading state while initial data is being fetched
  const isLoading = tablesLoading || countersLoading || reservationsLoading || 
                   counterOrdersLoading || counterOrderCountsLoading || 
                   tableOrdersLoading || tableOrderCountsLoading;

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

  // Show loading state for initial load
  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="h-8 w-8 text-purple-600 mx-auto mb-4 animate-spin" />
            <p className="text-gray-900">Loading table management...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 pb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold">Table Management</h1>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:ml-auto w-full sm:w-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-700" />
              <Input
                placeholder="Search tables…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full sm:w-56 pl-10 rounded-xl border border-slate-200 px-3 text-sm shadow-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <AddTableDialog venueId={venueId} onTableAdded={handleTableActionComplete} />
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleManualReset}
                disabled={isResetting}
                className="text-red-600 border-red-200 hover:bg-red-50 flex-shrink-0"
              >
                {isResetting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                {isResetting ? 'Resetting...' : 'Reset'}
              </Button>
            </div>
          </div>
        </div>
        
      </header>

      {/* 🔹 COUNTER ORDERS - Always at the top (lane view) */}
      {counterOrders.length > 0 ? (
        <section className="mt-6">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Counter Orders</h2>
            <p className="text-sm text-gray-900">
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
                  <OrderCard
                    order={mapCounterOrderToCardData(order)}
                    variant="counter"
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
                <p className="text-xl font-bold text-gray-900">{counterOrders.length}</p>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="mt-6">
          <Card>
            <CardContent className="py-10">
              <div className="text-center text-sm text-gray-900">
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
            <p className="text-sm text-gray-900">
              Dine-in orders requiring staff attention - grouped by table ({Object.values(groupedTableOrders).flat().length} active orders)
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
                    <span className="text-xs text-gray-900">{orders.length} active</span>
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
                        <span className="text-gray-900">#{order.id.slice(-6).toUpperCase()}</span>
                        <span className="font-medium">£{order.total_amount?.toFixed(2) || '0.00'}</span>
                      </div>
                      <div className="text-xs text-gray-900">
                        {new Date(order.created_at).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                  {orders.length > 2 && (
                    <div className="text-xs text-gray-900 text-center">
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
                      // Determine which tab to navigate to based on order age
                      const now = new Date();
                      const thirtyMinutesAgo = new Date(now.getTime() - (30 * 60 * 1000));
                      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                      
                      // Check if any orders are recent (within 30 minutes) - these go to 'live' tab
                      const hasRecentOrders = tableOrders.some(order => {
                        const orderCreatedAt = new Date(order.created_at);
                        return orderCreatedAt > thirtyMinutesAgo;
                      });
                      
                      if (hasRecentOrders) {
                        // Navigate to live tab if there are recent orders
                        router.push(`/dashboard/${venueId}/live-orders?table=${tableLabel}&tab=live`);
                        return;
                      }
                      
                      // Check if any orders are from today (but not recent) - these go to 'all' tab
                      const hasTodayOrders = tableOrders.some(order => {
                        const orderCreatedAt = new Date(order.created_at);
                        return orderCreatedAt >= startOfToday;
                      });
                      
                      if (hasTodayOrders) {
                        // Navigate to all tab if there are today's orders (but not recent)
                        router.push(`/dashboard/${venueId}/live-orders?table=${tableLabel}&tab=all`);
                        return;
                      }
                      
                      // If no today's orders, check if there are any historical orders - these go to 'history' tab
                      const hasHistoryOrders = tableOrders.some(order => {
                        const orderCreatedAt = new Date(order.created_at);
                        return orderCreatedAt < startOfToday;
                      });
                      
                      if (hasHistoryOrders) {
                        // Navigate to history tab if there are historical orders
                        router.push(`/dashboard/${venueId}/live-orders?table=${tableLabel}&tab=history`);
                        return;
                      }
                      
                      // Fallback: if no orders at all, go to live tab
                      router.push(`/dashboard/${venueId}/live-orders?table=${tableLabel}&tab=live`);
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
                <p className="text-xl font-bold text-gray-900">{tableOrders.length}</p>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="mt-8">
          <Card>
            <CardContent className="py-10">
              <div className="text-center text-sm text-gray-900">
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
          <p className="text-sm text-gray-900">
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
                    <Users className="h-8 w-8 text-gray-700" />
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
                    <Search className="h-8 w-8 text-gray-700" />
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
                  groupSessions={groupSessions}
                />
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
                    <p className="text-sm font-medium text-gray-900">Total Tables</p>
                    <p className="text-2xl font-bold">{filterCounts.all}</p>
                  </div>
                  <Users className="h-8 w-8 text-gray-700" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Available</p>
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
                    <p className="text-sm font-medium text-gray-900">Occupied</p>
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
                    <p className="text-sm font-medium text-gray-900">Reserved</p>
                    <p className="text-2xl font-bold text-blue-600">{filterCounts.reserved}</p>
                  </div>
                  <Clock className="h-8 w-8 text-blue-400" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      <DailyResetModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onConfirm={handleConfirmReset}
        isResetting={isManualResetting}
        venueName="this venue"
      />
      
      {/* Mobile Navigation */}
      <MobileNav 
        venueId={venueId}
        venueName={undefined}
        counts={{
          live_orders: 0,
          total_orders: 0,
          notifications: 0
        }}
      />
    </div>
  );
}
