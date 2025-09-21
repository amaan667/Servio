"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RefreshCw, Clock, CheckCircle, XCircle, AlertTriangle, History, Calendar } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { OrderCard } from "@/components/orders/OrderCard";
import { mapOrderToCardData } from "@/lib/orders/mapOrderToCardData";
import { deriveEntityKind } from "@/lib/orders/entity-types";
import { logger } from "@/lib/logger";
import { useTabCounts } from '@/hooks/use-tab-counts';
import { useCountsRealtime } from '@/hooks/use-counts-realtime';

interface Order {
  id: string;
  venue_id: string;
  table_number: number | null;
  table_id?: string | null;
  session_id?: string | null;
  customer_name: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  items: Array<{
    menu_item_id: string;
    item_name: string;
    quantity: number;
    price: number;
    specialInstructions?: string;
  }>;
  total_amount: number;
  created_at: string;
  updated_at?: string;
  order_status: 'PLACED' | 'ACCEPTED' | 'IN_PREP' | 'READY' | 'OUT_FOR_DELIVERY' | 'SERVING' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED' | 'EXPIRED';
  payment_status?: string;
  payment_method?: string;
  notes?: string;
  scheduled_for?: string;
  prep_lead_minutes?: number;
  source?: 'qr' | 'counter';
  table_label?: string;
  counter_label?: string;
  table?: { is_configured: boolean } | null;
}

interface LiveOrdersProps {
  venueId: string;
  venueTimezone?: string;
}

export function LiveOrdersNew({ venueId, venueTimezone = 'Europe/London' }: LiveOrdersProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'live' | 'earlier' | 'history'>('live');
  // Local counts to ensure UI stays correct even if RPC isn't updated in DB yet
  const [localCounts, setLocalCounts] = useState<{ live_count: number; earlier_today_count: number; history_count: number } | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const isFetchingRef = (typeof window !== 'undefined') ? (window as any).__liveOrdersFetchingRef || { current: false } : { current: false };
  if (typeof window !== 'undefined') {
    (window as any).__liveOrdersFetchingRef = isFetchingRef;
  }

  // Use the new RPC-based tab counts
  const { data: tabCounts, isLoading: countsLoading, refetch: refetchCounts } = useTabCounts(venueId, venueTimezone, 30);
  
  // Set up realtime updates for counts
  useCountsRealtime(venueId, venueTimezone, refetchCounts);

  // Handle both old and new status values until migration is complete
  const ACTIVE_STATUSES = ['PLACED', 'IN_PREP', 'READY', 'SERVING', 'ACCEPTED', 'OUT_FOR_DELIVERY'];
  const TERMINAL_TODAY = ['SERVED', 'CANCELLED', 'REFUNDED', 'EXPIRED', 'COMPLETED'];
  // CRITICAL: No terminal states should appear in Live orders - they belong in Earlier Today only
  const RECENT_TERMINAL_IN_LIVE: string[] = [];

  // Helper function to get today bounds in UTC for venue timezone
  const todayBoundsCorrected = useCallback((tz: string) => {
    const now = new Date();
    
    // Get the current date in the venue's timezone
    const venueDate = new Date(now.toLocaleString('en-US', { timeZone: tz }));
    
    // Create start of day in venue timezone (midnight in venue timezone)
    const startOfDay = new Date(venueDate.getFullYear(), venueDate.getMonth(), venueDate.getDate());
    
    // Convert to UTC by using the timezone offset
    // For Europe/London (UTC+1 during summer), midnight London = 11pm UTC previous day
    const startUtc = new Date(startOfDay.getTime() - (startOfDay.getTimezoneOffset() * 60000));
    
    // Create end of day (next day start) in venue timezone
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(startOfDay.getDate() + 1);
    const endUtc = new Date(endOfDay.getTime() - (endOfDay.getTimezoneOffset() * 60000));
    
    console.log(`[LIVE_ORDERS] Timezone calculation for ${tz}:`);
    console.log(`  - now: ${now.toISOString()}`);
    console.log(`  - now in venue timezone: ${now.toLocaleString('en-US', { timeZone: tz })}`);
    console.log(`  - venueDate: ${startOfDay.toISOString()}`);
    console.log(`  - startOfDay: ${startOfDay.toISOString()}`);
    console.log(`  - startUtc: ${startUtc.toISOString()}`);
    console.log(`  - endOfDay: ${endOfDay.toISOString()}`);
    console.log(`  - endUtc: ${endUtc.toISOString()}`);
    
    return { startUtc: startUtc.toISOString(), endUtc: endUtc.toISOString() };
  }, []);

  const fetchOrders = useCallback(async (tab: 'live' | 'earlier' | 'history', background: boolean = false) => {
    console.log('[FETCH_ORDERS] ===== FETCHING ORDERS =====');
    console.log('[FETCH_ORDERS] Tab:', tab.toUpperCase());
    console.log('[FETCH_ORDERS] Venue ID:', venueId);
    console.log('[FETCH_ORDERS] Venue Timezone:', venueTimezone);
    console.log('[FETCH_ORDERS] Background:', background);
    console.log('[FETCH_ORDERS] Current Orders Count:', orders.length);
    if (!venueId) {
      console.log('[LIVE_ORDERS] No venueId, returning early');
      setLoading(false);
      return;
    }

    console.log(`[LIVE_ORDERS] Starting fetchOrders for tab: ${tab}, venueId: ${venueId}`);
    if (isFetchingRef.current) {
      // avoid overlapping refreshes which cause flicker
      console.log('[LIVE_ORDERS] A fetch is already in progress, skipping');
      return;
    }
    isFetchingRef.current = true;
    if (background) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
      setError(null);
    }

    // Remove artificial timeout - let real loading states handle this

    try {
      const supabase = createClient();
      if (!supabase) {
        throw new Error('Supabase client not available');
      }

      console.log(`[LIVE_ORDERS] Supabase client created successfully`);

      const { startUtc, endUtc } = todayBoundsCorrected(venueTimezone);
      console.log(`[LIVE_ORDERS] Fetching ${tab} orders for venue:`, venueId);
      console.log(`[LIVE_ORDERS] Time bounds:`, { startUtc, endUtc });

      // First, let's check what orders exist in the database for this venue
      console.log(`[LIVE_ORDERS] Checking all orders for venue ${venueId}...`);
      const { data: allOrders, error: allOrdersError } = await supabase
        .from('orders')
        .select('id, order_status, payment_status, created_at, total_amount')
        .eq('venue_id', venueId)
        .limit(10);

      if (allOrdersError) {
        console.error(`[LIVE_ORDERS] Error fetching all orders:`, allOrdersError);
      } else {
        console.log(`[LIVE_ORDERS] All orders found:`, allOrders);
      }

      // Build query based on tab requirements
      let query = supabase
        .from('orders')
        .select('*')
        .eq('venue_id', venueId);
      console.log(`[LIVE_ORDERS] Using orders table directly`);

      if (tab === 'live') {
        // Live orders: active statuses from today AND within 30 minutes
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        console.log(`[LIVE_ORDERS] Live tab - Current time: ${new Date().toISOString()}`);
        console.log(`[LIVE_ORDERS] Live tab - 30 minutes ago: ${thirtyMinutesAgo}`);
        
        query = query
          .in('order_status', ACTIVE_STATUSES)
          .in('payment_status', ['PAID', 'UNPAID']) // Include both paid and unpaid orders
          .gte('created_at', thirtyMinutesAgo) // Only orders created within last 30 minutes
          .order('created_at', { ascending: false });
        console.log(`[LIVE_ORDERS] Live query with statuses:`, ACTIVE_STATUSES);
        console.log(`[LIVE_ORDERS] Live query time filter: >= ${thirtyMinutesAgo}`);
      } else if (tab === 'earlier') {
        // Earlier today: orders from today but more than 30 minutes ago
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        query = query
          .in('payment_status', ['PAID', 'UNPAID']) // Include both paid and unpaid orders
          .gte('created_at', startUtc)
          .lt('created_at', thirtyMinutesAgo) // Before 30 minutes ago
          .order('created_at', { ascending: false });
        console.log(`[LIVE_ORDERS] Earlier query - orders from today before 30 minutes ago`);
      } else if (tab === 'history') {
        // History: All orders from previous days (regardless of status)
        query = query
          .in('payment_status', ['PAID', 'UNPAID']) // Include both paid and unpaid orders
          .lt('created_at', startUtc)
          .order('created_at', { ascending: false });
        console.log(`[LIVE_ORDERS] History query for all orders before:`, startUtc);
      }

      console.log(`[LIVE_ORDERS] Executing query for ${tab}...`);
      console.log(`[LIVE_ORDERS] Query details:`, { tab, venueId, startUtc, endUtc });
      
      const { data, error: queryError } = await query;
      console.log(`[LIVE_ORDERS] Query completed, checking for errors...`);

      if (queryError) {
        console.error(`[LIVE_ORDERS] Query error for ${tab}:`, queryError);
        
        // Fallback: get all orders and filter in JavaScript
        console.log(`[LIVE_ORDERS] Trying fallback approach...`);
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('orders')
          .select('*')
          .eq('venue_id', venueId);
        
        if (fallbackError) {
          console.error(`[LIVE_ORDERS] Fallback also failed:`, fallbackError);
          throw queryError; // Throw original error
        }
        
        console.log(`[LIVE_ORDERS] Fallback data:`, fallbackData);
        
        // Filter orders in JavaScript based on tab
        let filteredOrders = fallbackData || [];
        const now = new Date();
        
        // Use the venue timezone bounds that were already calculated
        const today = new Date(startUtc);
        const tomorrow = new Date(endUtc);
        
        console.log(`[LIVE_ORDERS] Date filtering:`, {
          now: now.toISOString(),
          today: today.toISOString(),
          tomorrow: tomorrow.toISOString(),
          startUtc,
          endUtc,
          venueTimezone
        });
        
        if (tab === 'live') {
          filteredOrders = filteredOrders.filter((order: any) => {
            const status = order.order_status || order.status;
            const created = new Date(order.created_at);
            const isActive = ACTIVE_STATUSES.includes(status);
            const isRecentTerminal = RECENT_TERMINAL_IN_LIVE.includes(status);
            const isToday = created >= today && created < tomorrow;

            // Check if order is older than 30 minutes
            const orderAge = now.getTime() - created.getTime();
            const thirtyMinutes = 30 * 60 * 1000;
            const isNotExpired = orderAge < thirtyMinutes;

            console.log(`[LIVE_ORDERS] Order ${order.id}: status=${status}, created=${created.toISOString()}, isActive=${isActive}, isRecentTerminal=${isRecentTerminal}, isToday=${isToday}, isNotExpired=${isNotExpired}`);
            // CRITICAL: Only active orders should appear in live tab, never terminal orders
            return isActive && isToday && isNotExpired;
          });
        } else if (tab === 'earlier') {
          filteredOrders = filteredOrders.filter((order: any) => {
            const status = order.order_status || order.status;
            const created = new Date(order.created_at);
            const isTerminal = TERMINAL_TODAY.includes(status);
            const isToday = created >= today && created < tomorrow;

            // Include expired live orders (older than 30 minutes)
            const orderAge = now.getTime() - created.getTime();
            const thirtyMinutes = 30 * 60 * 1000;
            const isExpiredLive = orderAge >= thirtyMinutes && ACTIVE_STATUSES.includes(status);
            const isRecentTerminal = RECENT_TERMINAL_IN_LIVE.includes(status) && orderAge < thirtyMinutes;

            console.log(`[LIVE_ORDERS] Order ${order.id}: status=${status}, created=${created.toISOString()}, isTerminal=${isTerminal}, isToday=${isToday}, isExpiredLive=${isExpiredLive}, isRecentTerminal=${isRecentTerminal}`);
            // Earlier Today includes ALL today's orders that are not currently in live (terminal orders + expired active orders)
            return isToday && (isTerminal || isExpiredLive);
          });
        } else if (tab === 'history') {
          filteredOrders = filteredOrders.filter((order: any) => {
            const created = new Date(order.created_at);
            const isBeforeToday = created < today;
            console.log(`[LIVE_ORDERS] Order ${order.id}: status=${order.order_status || order.status}, created=${created.toISOString()}, isBeforeToday=${isBeforeToday}`);
            return isBeforeToday; // Show all orders from previous days regardless of status
          });
        }
        
        
        // // clearTimeout(timeoutId); // timeoutId not defined // timeoutId not defined
        setOrders(filteredOrders);
        if (background) {
          setIsRefreshing(false);
        } else {
          setLoading(false);
        }
        setLastUpdatedAt(new Date());
        isFetchingRef.current = false;
        return;
      }


      // clearTimeout(timeoutId); // timeoutId not defined
      setOrders(data || []);
      setLastUpdatedAt(new Date());
      
    } catch (error: any) {
      if (!background) {
        setError(`Failed to load ${activeTab} orders: ${error.message}`);
      }
    } finally {
      // clearTimeout(timeoutId); // timeoutId not defined
      if (background) {
        setIsRefreshing(false);
      } else {
        setLoading(false);
      }
      isFetchingRef.current = false;
    }
  }, [venueId, venueTimezone, todayBoundsCorrected]);

  // Recalculate counts locally (authoritative in UI)
  const recalcLocalCounts = useCallback(async () => {
    try {
      const supabase = createClient();
      if (!supabase) return;

      const { startUtc, endUtc } = todayBoundsCorrected(venueTimezone);
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

      // Count today total
      const todayTotalPromise = supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('venue_id', venueId)
        .gte('created_at', startUtc)
        .lt('created_at', endUtc);

      // Count live-eligible = active OR recent served/completed within 30m
      const liveEligiblePromise = supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('venue_id', venueId)
        .gte('created_at', startUtc)
        .lt('created_at', endUtc)
        .gte('created_at', thirtyMinutesAgo)
        .or(`order_status.in.(${ACTIVE_STATUSES.join(',')}),status.in.(${ACTIVE_STATUSES.join(',')})`);

      // Count history = all orders before today (regardless of status)
      const historyPromise = supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('venue_id', venueId)
        .lt('created_at', startUtc);

      const [{ count: todayTotal }, { count: liveEligible }, { count: historyCount }] = await Promise.all([
        todayTotalPromise,
        liveEligiblePromise,
        historyPromise,
      ]);

      const live_count = liveEligible || 0;
      const earlier_today_count = Math.max(0, (todayTotal || 0) - (liveEligible || 0));
      const history_count = historyCount || 0;

      setLocalCounts({ live_count, earlier_today_count, history_count });
    } catch (err) {
      console.error('[LIVE_ORDERS] Failed to recalc local counts', err);
    }
  }, [venueId, venueTimezone, todayBoundsCorrected, ACTIVE_STATUSES]);

  // Auto-refresh orders and counts every 15 seconds to handle aging orders
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('[LIVE_ORDERS] Auto-refreshing orders due to time passage...');
      fetchOrders(activeTab, true);
      refetchCounts();
      recalcLocalCounts();
    }, 15000); // Every 15s

    return () => clearInterval(interval);
  }, [fetchOrders, activeTab, refetchCounts, recalcLocalCounts]);

  console.log('[LIVE_ORDERS] Component mounted with venueId:', venueId);

  // Fetch orders when tab changes
  useEffect(() => {
    fetchOrders(activeTab, false);
    recalcLocalCounts();
  }, [activeTab, fetchOrders, recalcLocalCounts]);

  // Set up real-time subscription
  useEffect(() => {
    if (!venueId) return;

    const supabase = createClient();
    if (!supabase) return;

    const channel = supabase
      .channel('live-orders-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `venue_id=eq.${venueId}`
        },
        (payload: any) => {
          console.log('[LIVE_ORDERS] Real-time order update received:', payload);
          // Refresh orders when any order changes
          fetchOrders(activeTab, true);
          // Update counts (both RPC and local)
          refetchCounts();
          recalcLocalCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [venueId, activeTab, fetchOrders]);

  const handleOrderUpdate = useCallback(() => {
    fetchOrders(activeTab, true);
  }, [fetchOrders, activeTab]);

  const getTabIcon = (tab: string) => {
    switch (tab) {
      case 'live':
        return <Clock className="h-4 w-4" />;
      case 'earlier':
        return <Calendar className="h-4 w-4" />;
      case 'history':
        return <History className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  // Get tab count from RPC results
  const getTabCount = (tab: 'live' | 'earlier' | 'history') => {
    console.log(`[TAB_COUNT_DEBUG] Getting count for tab: ${tab}`);
    console.log(`[TAB_COUNT_DEBUG] tabCounts:`, tabCounts);
    // Prefer local counts when available to ensure correctness
    if (localCounts) {
      switch (tab) {
        case 'live':
          return localCounts.live_count;
        case 'earlier':
          return localCounts.earlier_today_count;
        case 'history':
          return localCounts.history_count;
        default:
          return 0;
      }
    }

    if (!tabCounts) {
      console.log(`[TAB_COUNT_DEBUG] No tabCounts, returning 0`);
      return 0;
    }
    
    let count = 0;
    switch (tab) {
      case 'live':
        count = tabCounts.live_count;
        break;
      case 'earlier':
        count = tabCounts.earlier_today_count;
        break;
      case 'history':
        count = tabCounts.history_count;
        break;
      default:
        count = 0;
    }
    
    console.log(`[TAB_COUNT_DEBUG] Tab ${tab} count: ${count}`);
    return count;
  };

  const getTabLabel = (tab: string) => {
    switch (tab) {
      case 'live':
        return 'Live Orders';
      case 'earlier':
        return 'Earlier Today';
      case 'history':
        return 'History';
      default:
        return 'Live Orders';
    }
  };

  const getTabDescription = (tab: string) => {
    switch (tab) {
      case 'live':
        return "Today's active orders that need attention";
      case 'earlier':
        return "Today's completed, cancelled, and refunded orders";
      case 'history':
        return "All orders from previous days";
      default:
        return "Today's active orders that need attention";
    }
  };

  if (error) {
    return (
      <Alert className="mb-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Debug Panel - Remove this after fixing */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <h3 className="text-sm font-semibold text-yellow-800 mb-2">Debug Info</h3>
          <div className="text-xs text-yellow-700 space-y-1">
            <div>Tab Counts: {JSON.stringify(tabCounts)}</div>
            <div>Loading: {countsLoading ? 'Yes' : 'No'}</div>
            <div>Error: {error || 'None'}</div>
            <div>Orders Length: {orders.length}</div>
          </div>
        </div>
      )}
      
      {/* Tab Navigation - Centered with proper spacing */}
      <div className="flex justify-center mb-6">
        <div className="flex space-x-1 bg-muted p-1 rounded-lg shadow-sm">
          {(['live', 'earlier', 'history'] as const).map((tab) => (
            <Button
              key={tab}
              variant={activeTab === tab ? 'default' : 'ghost'}
              size="sm"
              onClick={() => {
                console.log('[TAB_SELECTION] ===== TAB SELECTED =====');
                console.log('[TAB_SELECTION] Previous Tab:', activeTab);
                console.log('[TAB_SELECTION] New Tab:', tab);
                console.log('[TAB_SELECTION] Venue ID:', venueId);
                console.log('[TAB_SELECTION] Venue Timezone:', venueTimezone);
                console.log('[TAB_SELECTION] Current Order Count:', orders.length);
                console.log('[TAB_SELECTION] Tab Counts:', {
                  live: getTabCount('live'),
                  earlier: getTabCount('earlier'),
                  history: getTabCount('history')
                });
                console.log('[TAB_SELECTION] ===== END TAB SELECTION =====');
                setActiveTab(tab);
              }}
              className="flex items-center space-x-2 px-4 py-2 min-w-[120px] justify-center"
            >
              {getTabIcon(tab)}
              <span className="font-medium">{getTabLabel(tab)}</span>
              <Badge variant="secondary" className="ml-1">
                {localCounts ? getTabCount(tab) : (countsLoading ? '...' : tabCounts ? getTabCount(tab) : '?')}
              </Badge>
            </Button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div>
        <div className="mb-4">
          <h2 className="text-xl font-semibold flex items-center space-x-2">
            {getTabIcon(activeTab)}
            <span>{getTabLabel(activeTab)}</span>
          </h2>
          <p className="text-gray-600">{getTabDescription(activeTab)}</p>
        </div>

        {/* Orders List */}
        {error ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Alert variant="destructive" className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
              <Button onClick={() => fetchOrders(activeTab)} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </CardContent>
          </Card>
        ) : orders.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <div className="text-gray-500">
                {activeTab === 'live' && "No active orders at the moment"}
                {activeTab === 'earlier' && "No orders completed earlier today"}
                {activeTab === 'history' && "No order history available"}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {isRefreshing && (
              <div className="flex items-center justify-center text-xs text-gray-500">
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> Updating...
              </div>
            )}
            {(() => {
              // Group orders by date
              const ordersByDate = orders.reduce((acc, order) => {
                const orderDate = new Date(order.created_at);
                const dateKey = orderDate.toLocaleDateString('en-GB', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                });
                
                if (!acc[dateKey]) {
                  acc[dateKey] = [];
                }
                acc[dateKey].push(order);
                return acc;
              }, {} as Record<string, typeof orders>);

              // Sort dates (most recent first)
              const sortedDates = Object.keys(ordersByDate).sort((a, b) => {
                const dateA = new Date(ordersByDate[a][0].created_at);
                const dateB = new Date(ordersByDate[b][0].created_at);
                return dateB.getTime() - dateA.getTime();
              });

              return sortedDates.map((dateKey) => {
                const dateOrders = ordersByDate[dateKey];
                
                // Group orders by type (table vs counter)
                const tableOrders = dateOrders.filter(order => {
                  // Use the original order data to determine entity kind
                  const entityData = {
                    table_id: order.table_id || null,
                    table: order.table || null,
                    source: order.source as any
                  };
                  const entityKind = deriveEntityKind(entityData);
                  
                  // Debug logging
                  console.log(`[ORDER GROUPING] Order ${order.id}:`, {
                    table_number: order.table_number,
                    table_id: order.table_id,
                    source: order.source,
                    table: order.table,
                    entityKind
                  });
                  
                  return entityKind === 'table';
                });
                
                const counterOrders = dateOrders.filter(order => {
                  // Use the original order data to determine entity kind
                  const entityData = {
                    table_id: order.table_id || null,
                    table: order.table || null,
                    source: order.source as any
                  };
                  const entityKind = deriveEntityKind(entityData);
                  return entityKind === 'counter';
                });

                return (
                  <div key={dateKey} className="space-y-6">
                    {/* Date Header */}
                    <div className="flex items-center space-x-3">
                      <div className="h-px flex-1 bg-gray-200"></div>
                      <h3 className="text-lg font-semibold text-gray-700 bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm">
                        {dateKey} ({dateOrders.length} orders)
                      </h3>
                      <div className="h-px flex-1 bg-gray-200"></div>
                    </div>
                    
                    {/* Table Orders Section */}
                    {tableOrders.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="h-px flex-1 bg-blue-200"></div>
                          <h4 className="text-md font-semibold text-blue-700 bg-blue-50 px-3 py-1 rounded-lg border border-blue-200">
                            Table Orders ({tableOrders.length})
                          </h4>
                          <div className="h-px flex-1 bg-blue-200"></div>
                        </div>
                        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
                          {tableOrders.map((order) => {
                            const orderForCard = mapOrderToCardData(order, 'GBP');
                            return (
                              <OrderCard
                                key={order.id}
                                order={orderForCard}
                                variant="table"
                                venueId={venueId}
                                showActions={true}
                                onActionComplete={handleOrderUpdate}
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Counter Orders Section */}
                    {counterOrders.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="h-px flex-1 bg-orange-200"></div>
                          <h4 className="text-md font-semibold text-orange-700 bg-orange-50 px-3 py-1 rounded-lg border border-orange-200">
                            Counter Orders ({counterOrders.length})
                          </h4>
                          <div className="h-px flex-1 bg-orange-200"></div>
                        </div>
                        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
                          {counterOrders.map((order) => {
                            const orderForCard = mapOrderToCardData(order, 'GBP');
                            return (
                              <OrderCard
                                key={order.id}
                                order={orderForCard}
                                variant="counter"
                                venueId={venueId}
                                showActions={true}
                                onActionComplete={handleOrderUpdate}
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>

      {/* Auto-refresh enabled; manual refresh button removed per product requirement */}
    </div>
  );
}
