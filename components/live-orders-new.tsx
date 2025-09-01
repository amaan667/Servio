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

  const ACTIVE_STATUSES = ['PLACED', 'IN_PREP', 'READY', 'SERVING'];
  const TERMINAL_TODAY = ['SERVED', 'CANCELLED', 'REFUNDED', 'EXPIRED'];

  // Helper function to get today bounds in UTC for venue timezone
  const todayBounds = useCallback((tz: string) => {
    const now = new Date();
    const start = new Date(new Intl.DateTimeFormat('en-GB', { 
      timeZone: tz, 
      year:'numeric', 
      month:'2-digit', 
      day:'2-digit'
    }).format(now) + ' 00:00:00');
    const end = new Date(start); 
    end.setDate(start.getDate()+1);
    return { startUtc: start.toISOString(), endUtc: end.toISOString() };
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

      const { startUtc, endUtc } = todayBounds(venueTimezone);
      console.log(`[LIVE_ORDERS] Fetching ${tab} orders for venue:`, venueId);
      console.log(`[LIVE_ORDERS] Time bounds:`, { startUtc, endUtc });

      // Try to use orders_with_totals view first, fallback to orders table
      let query;
      try {
        query = supabase
          .from('orders_with_totals')
          .select('*')
          .eq('venue_id', venueId);
        console.log(`[LIVE_ORDERS] Using orders_with_totals view`);
      } catch (viewError) {
        console.log(`[LIVE_ORDERS] View not available, using orders table:`, viewError);
        query = supabase
          .from('orders')
          .select('*')
          .eq('venue_id', venueId);
      }

      if (tab === 'live') {
        query = query
          .in('order_status', ACTIVE_STATUSES)
          .gte('created_at', startUtc)
          .lt('created_at', endUtc)
          .order('updated_at', { ascending: false });
        console.log(`[LIVE_ORDERS] Live query with statuses:`, ACTIVE_STATUSES);
      } else if (tab === 'earlier') {
        query = query
          .in('order_status', TERMINAL_TODAY)
          .gte('created_at', startUtc)
          .lt('created_at', endUtc)
          .order('created_at', { ascending: false });
        console.log(`[LIVE_ORDERS] Earlier query with statuses:`, TERMINAL_TODAY);
      } else if (tab === 'history') {
        query = query
          .eq('order_status', 'SERVED')
          .lt('created_at', startUtc)
          .order('created_at', { ascending: false });
        console.log(`[LIVE_ORDERS] History query for SERVED orders before:`, startUtc);
      }

      console.log(`[LIVE_ORDERS] Executing query for ${tab}...`);
      const { data, error: queryError } = await query;

      if (queryError) {
        console.error(`[LIVE_ORDERS] Query error for ${tab}:`, queryError);
        throw queryError;
      }

      console.log(`[LIVE_ORDERS] ${tab} query result:`, { 
        orderCount: data?.length || 0, 
        orders: data?.slice(0, 2) // Log first 2 orders for debugging
      });

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
  }, [venueId, venueTimezone, todayBounds]);

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
        return "Served orders from previous days";
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
              {orders.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {orders.length}
                </Badge>
              )}
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onUpdate={handleOrderUpdate}
                venueCurrency="GBP"
              />
            ))}
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
