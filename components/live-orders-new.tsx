"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RefreshCw, Clock, CheckCircle, XCircle, AlertTriangle, History, Calendar } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { OrderCard, type Order } from "@/components/order-card";
import { logger } from "@/lib/logger";

interface LiveOrdersProps {
  venueId: string;
  venueTimezone?: string;
}

export function LiveOrdersNew({ venueId, venueTimezone = 'Europe/London' }: LiveOrdersProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'live' | 'earlier' | 'history'>('live');

  console.log('[LIVE_ORDERS] Component mounted with venueId:', venueId);

  // Handle both old and new status values until migration is complete
  const ACTIVE_STATUSES = ['PLACED', 'IN_PREP', 'READY', 'SERVING', 'ACCEPTED', 'OUT_FOR_DELIVERY'];
  const TERMINAL_TODAY = ['SERVED', 'CANCELLED', 'REFUNDED', 'EXPIRED', 'COMPLETED'];

                                         // CORRECTED Helper function to get today bounds in UTC for venue timezone
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

  const fetchOrders = useCallback(async (tab: 'live' | 'earlier' | 'history') => {
    if (!venueId) return;

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      if (!supabase) {
        throw new Error('Supabase client not available');
      }

      const { startUtc, endUtc } = todayBoundsCorrected(venueTimezone);
      console.log(`[LIVE_ORDERS] Fetching ${tab} orders for venue:`, venueId);
      console.log(`[LIVE_ORDERS] Time bounds:`);
      console.log(`  - startUtc: ${startUtc}`);
      console.log(`  - endUtc: ${endUtc}`);

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
        // Live orders: active statuses from today
        query = query
          .or(`order_status.in.(${ACTIVE_STATUSES.join(',')}),status.in.(${ACTIVE_STATUSES.join(',')})`)
          .gte('created_at', startUtc)
          .lt('created_at', endUtc)
          .order('updated_at', { ascending: false });
        console.log(`[LIVE_ORDERS] Live query with statuses:`, ACTIVE_STATUSES);
      } else if (tab === 'earlier') {
        // Earlier today: terminal statuses from today
        query = query
          .or(`order_status.in.(${TERMINAL_TODAY.join(',')}),status.in.(${TERMINAL_TODAY.join(',')})`)
          .gte('created_at', startUtc)
          .lt('created_at', endUtc)
          .order('created_at', { ascending: false });
        console.log(`[LIVE_ORDERS] Earlier query with statuses:`, TERMINAL_TODAY);
      } else if (tab === 'history') {
        // History: All orders from previous days (regardless of status)
        query = query
          .lt('created_at', startUtc)
          .order('created_at', { ascending: false });
        console.log(`[LIVE_ORDERS] History query for all orders before:`, startUtc);
      }

      console.log(`[LIVE_ORDERS] Executing query for ${tab}...`);
      console.log(`[LIVE_ORDERS] Query details:`);
      console.log(`  - tab: ${tab}`);
      console.log(`  - venueId: ${venueId}`);
      console.log(`  - startUtc: ${startUtc}`);
      console.log(`  - endUtc: ${endUtc}`);
      console.log(`  - statuses:`, tab === 'live' ? ACTIVE_STATUSES : tab === 'earlier' ? TERMINAL_TODAY : ['SERVED', 'COMPLETED']);
      
      const { data, error: queryError } = await query;

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
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        console.log(`[LIVE_ORDERS] Date filtering:`, {
          now: now.toISOString(),
          today: today.toISOString(),
          tomorrow: tomorrow.toISOString(),
          startUtc,
          endUtc
        });
        
        if (tab === 'live') {
          filteredOrders = filteredOrders.filter(order => {
            const status = order.order_status || order.status;
            const created = new Date(order.created_at);
            const isActive = ACTIVE_STATUSES.includes(status);
            const isToday = created >= today && created < tomorrow;
            
            // Check if order is older than 30 minutes
            const orderAge = now.getTime() - created.getTime();
            const thirtyMinutes = 30 * 60 * 1000;
            const isNotExpired = orderAge < thirtyMinutes;
            
            console.log(`[LIVE_ORDERS] Order ${order.id}: status=${status}, created=${created.toISOString()}, isActive=${isActive}, isToday=${isToday}, isNotExpired=${isNotExpired}`);
            return isActive && isToday && isNotExpired;
          });
        } else if (tab === 'earlier') {
          filteredOrders = filteredOrders.filter(order => {
            const status = order.order_status || order.status;
            const created = new Date(order.created_at);
            const isTerminal = TERMINAL_TODAY.includes(status);
            const isToday = created >= today && created < tomorrow;
            
            // Include expired live orders (older than 30 minutes)
            const orderAge = now.getTime() - created.getTime();
            const thirtyMinutes = 30 * 60 * 1000;
            const isExpiredLive = orderAge >= thirtyMinutes && ACTIVE_STATUSES.includes(status);
            
            console.log(`[LIVE_ORDERS] Order ${order.id}: status=${status}, created=${created.toISOString()}, isTerminal=${isTerminal}, isToday=${isToday}, isExpiredLive=${isExpiredLive}`);
            return isToday && (isTerminal || isExpiredLive);
          });
        } else if (tab === 'history') {
          filteredOrders = filteredOrders.filter(order => {
            const created = new Date(order.created_at);
            const isBeforeToday = created < today;
            console.log(`[LIVE_ORDERS] Order ${order.id}: status=${order.order_status || order.status}, created=${created.toISOString()}, isBeforeToday=${isBeforeToday}`);
            return isBeforeToday; // Show all orders from previous days regardless of status
          });
        }
        
        console.log(`[LIVE_ORDERS] Fallback result:`, { 
          orderCount: filteredOrders.length, 
          orders: filteredOrders.slice(0, 2)
        });
        
        setOrders(filteredOrders);
        return;
      }

      console.log(`[LIVE_ORDERS] ${tab} query result:`);
      console.log(`  - orderCount: ${data?.length || 0}`);
      console.log(`  - rawData type: ${typeof data}`);
      console.log(`  - rawData:`, data);
      
      if (data && Array.isArray(data)) {
        console.log(`  - data is array: true`);
        console.log(`  - data length: ${data.length}`);
        if (data.length > 0) {
          console.log(`  - first order:`, data[0]);
        }
      } else {
        console.log(`  - data is array: false`);
        console.log(`  - data value:`, data);
      }
      
      if (data && data.length > 0) {
        console.log(`[LIVE_ORDERS] ${tab} - Orders found:`, data.length);
        data.forEach((order, index) => {
          console.log(`[LIVE_ORDERS] ${tab} - Order ${index + 1}:`, {
            id: order.id,
            status: order.order_status || order.status,
            payment: order.payment_status,
            created: order.created_at,
            amount: order.total_amount
          });
        });
      } else {
        console.log(`[LIVE_ORDERS] ${tab} - No orders returned from query`);
      }

      setOrders(data || []);
      logger.info(`LIVE_ORDERS: ${tab} orders fetched successfully`, {
        orderCount: data?.length || 0,
        tab,
        venueId
      });
    } catch (error: any) {
      console.error(`[LIVE_ORDERS] Failed to fetch ${activeTab} orders:`, error);
      logger.error(`LIVE_ORDERS: Failed to fetch ${activeTab} orders`, { error: error.message });
      setError(`Failed to load ${activeTab} orders: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [venueId, venueTimezone, todayBoundsCorrected]);

  // Fetch all orders for accurate tab counts
  const fetchAllOrders = useCallback(async () => {
    if (!venueId) return;
    
    try {
      const supabase = createClient();
      if (!supabase) return;
      
      const { data: allOrders, error } = await supabase
        .from('orders')
        .select('*')
        .eq('venue_id', venueId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('[LIVE_ORDERS] Error fetching all orders for counts:', error);
        return;
      }
      
      // Update orders state with all orders for accurate tab counts
      setOrders(allOrders || []);
      console.log('[LIVE_ORDERS] All orders fetched for tab counts:', allOrders?.length || 0);
    } catch (error) {
      console.error('[LIVE_ORDERS] Failed to fetch all orders for counts:', error);
    }
  }, [venueId]);

  // Fetch all orders on mount and when venueId changes
  useEffect(() => {
    fetchAllOrders();
  }, [fetchAllOrders]);

  // Fetch orders when tab changes
  useEffect(() => {
    fetchOrders(activeTab);
  }, [activeTab, fetchOrders]);

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
        () => {
          // Refresh orders when any order changes
          fetchOrders(activeTab);
          // Also refresh all orders for accurate tab counts
          fetchAllOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [venueId, activeTab, fetchOrders]);

  const handleOrderUpdate = useCallback(() => {
    fetchOrders(activeTab);
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

  const getTabCount = (tab: 'live' | 'earlier' | 'history') => {
    if (!venueId || !orders || orders.length === 0) return 0;
    
    const now = new Date();
    const venueDate = new Date(now.toLocaleString("en-US", { timeZone: venueTimezone || "Europe/London" }));
    const today = new Date(venueDate.getFullYear(), venueDate.getMonth(), venueDate.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Filter orders based on tab requirements
    switch (tab) {
      case 'live':
        // Live orders: active statuses from today, NOT older than 30 minutes
        return orders.filter(order => {
          const orderDate = new Date(order.created_at);
          const isToday = orderDate >= today && orderDate < tomorrow;
          const isActive = ['PLACED', 'ACCEPTED', 'READY'].includes(order.order_status || order.status);
          
          // Check if order is older than 30 minutes
          const orderAge = now.getTime() - orderDate.getTime();
          const thirtyMinutes = 30 * 60 * 1000; // 30 minutes in milliseconds
          const isNotExpired = orderAge < thirtyMinutes;
          
          return isToday && isActive && isNotExpired;
        }).length;
        
      case 'earlier':
        // Earlier today: orders from today that are either terminal status OR expired live orders
        return orders.filter(order => {
          const orderDate = new Date(order.created_at);
          const isToday = orderDate >= today && orderDate < tomorrow;
          
          // Terminal status orders
          const isTerminal = ['SERVED', 'COMPLETED', 'CANCELLED', 'REFUNDED'].includes(order.order_status || order.status);
          
          // Expired live orders (older than 30 minutes)
          const orderAge = now.getTime() - orderDate.getTime();
          const thirtyMinutes = 30 * 60 * 1000;
          const isExpiredLive = orderAge >= thirtyMinutes && ['PLACED', 'ACCEPTED', 'READY'].includes(order.order_status || order.status);
          
          return isToday && (isTerminal || isExpiredLive);
        }).length;
        
      case 'history':
        // History: all orders from previous days
        return orders.filter(order => {
          const orderDate = new Date(order.created_at);
          return orderDate < today;
        }).length;
        
      default:
        return 0;
    }
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
      {/* Tab Navigation - Centered with proper spacing */}
      <div className="flex justify-center mb-6">
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg shadow-sm">
          {(['live', 'earlier', 'history'] as const).map((tab) => (
            <Button
              key={tab}
              variant={activeTab === tab ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab(tab)}
              className="flex items-center space-x-2 px-4 py-2 min-w-[120px] justify-center"
            >
              {getTabIcon(tab)}
              <span className="font-medium">{getTabLabel(tab)}</span>
              <Badge variant="secondary" className="ml-1">
                {getTabCount(tab)}
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
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-600">Loading orders...</span>
          </div>
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

              return sortedDates.map((dateKey) => (
                <div key={dateKey} className="space-y-4">
                  {/* Date Header */}
                  <div className="flex items-center space-x-3">
                    <div className="h-px flex-1 bg-gray-200"></div>
                    <h3 className="text-lg font-semibold text-gray-700 bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm">
                      {dateKey}
                    </h3>
                    <div className="h-px flex-1 bg-gray-200"></div>
                  </div>
                  
                  {/* Orders Grid for this date */}
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {ordersByDate[dateKey].map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onUpdate={handleOrderUpdate}
                        venueCurrency="GBP"
                      />
                    ))}
                  </div>
                </div>
              ));
            })()}
          </div>
        )}
      </div>

      {/* Refresh Button */}
      <div className="flex justify-center">
        <Button
          onClick={() => fetchOrders(activeTab)}
          disabled={loading}
          variant="outline"
          size="sm"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
    </div>
  );
}
