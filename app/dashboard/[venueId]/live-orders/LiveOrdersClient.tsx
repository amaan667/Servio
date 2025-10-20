"use client";

/**
 * LiveOrdersClient - Order Management Component
 * 
 * Tab Logic:
 * - Live Orders: Recent orders with active statuses
 * - Earlier Today: Orders from today that are not in live orders (orders from earlier today)
 * - History: Orders from previous days
 * 
 * Orders automatically move from "Live Orders" to "Earlier Today" after a period of time
 */

import React, { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useTabCounts } from "@/hooks/use-tab-counts";
import { OrderCard } from '@/components/orders/OrderCard';
import { mapOrderToCardData } from '@/lib/orders/mapOrderToCardData';
import MobileNav from '@/components/MobileNav';

// Hooks
import { useOrderManagement } from './hooks/useOrderManagement';
import { useBulkOperations } from './hooks/useBulkOperations';

// Components
import { OrderTabs } from './components/OrderTabs';
import { StatusHeader } from './components/StatusHeader';
import { EmptyState } from './components/EmptyState';
import { BulkCompleteButton } from './components/BulkCompleteButton';

// Utils
import { isCounterOrder } from './utils/orderHelpers';
import { LIVE_ORDER_WINDOW_MS, LIVE_WINDOW_STATUSES, LIVE_TABLE_ORDER_STATUSES } from './constants';

// Types
import { LiveOrdersClientProps } from './types';

export default function LiveOrdersClient({ venueId, venueName: venueNameProp }: LiveOrdersClientProps) {
  const searchParams = useSearchParams();
  const tableFilter = searchParams?.get('table');
  const tabParam = searchParams?.get('tab');
  
  const parsedTableFilter = tableFilter ? 
    (tableFilter.startsWith('Table ') ? tableFilter.replace('Table ', '') : tableFilter) : 
    null;
  
  const [activeTab, setActiveTab] = useState(tabParam || "live");
  const [venueName, setVenueName] = useState<string>(venueNameProp || '');
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(120000);
  const autoRefreshRef = useRef<NodeJS.Timeout | null>(null);

  // Use custom hooks
  const { 
    orders, 
    allTodayOrders, 
    groupedHistoryOrders, 
    loading, 
    todayWindow,
    setOrders,
    setAllTodayOrders
  } = useOrderManagement(venueId);

  const { data: tabCounts, refetch: refetchCounts } = useTabCounts(venueId, 'Europe/London', 30);
  const { isBulkCompleting, bulkCompleteAllOrders } = useBulkOperations(venueId);

  // Update active tab when URL parameter changes
  useEffect(() => {
    if (tabParam && ['live', 'all', 'history'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  // Load venue name
  useEffect(() => {
    if (!venueNameProp) {
      const client = createClient();
      if (!client) return;
      
      client
        .from('venues')
        .select('venue_name')
        .eq('venue_id', venueId)
        .single()
        .then(({ data }: { data: any }) => setVenueName(data?.venue_name || ''));
    }
  }, [venueId, venueNameProp]);

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefreshEnabled) {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
        autoRefreshRef.current = null;
      }
      return;
    }

    autoRefreshRef.current = setInterval(() => {
      refetchCounts();
    }, refreshInterval);

    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
        autoRefreshRef.current = null;
      }
    };
  }, [autoRefreshEnabled, refreshInterval, refetchCounts]);

  // Periodically check if orders need to be moved from live to all today
  useEffect(() => {
    if (!todayWindow) return;

    const interval = setInterval(() => {
      const now = new Date();
      const cutoff = new Date(now.getTime() - LIVE_ORDER_WINDOW_MS);
      
      setOrders(prevOrders => {
        const stillLive = prevOrders.filter(order => {
          const orderCreatedAt = new Date(order.created_at);
          const isRecent = orderCreatedAt > cutoff;
          const isLiveStatus = LIVE_WINDOW_STATUSES.includes(order.order_status);
          return isRecent && isLiveStatus;
        });
        
        const movedToAllToday = prevOrders.filter(order => {
          const orderCreatedAt = new Date(order.created_at);
          return orderCreatedAt <= cutoff || !LIVE_WINDOW_STATUSES.includes(order.order_status);
        });
        
        if (movedToAllToday.length > 0) {
          setAllTodayOrders(prev => [...movedToAllToday, ...prev]);
          refetchCounts();
        }
        
        return stillLive;
      });
    }, 60000);

    return () => clearInterval(interval);
  }, [todayWindow, setOrders, setAllTodayOrders, refetchCounts]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('tab', tab);
    if (parsedTableFilter) {
      newUrl.searchParams.set('table', `Table ${parsedTableFilter}`);
    }
    window.history.replaceState({}, '', newUrl.toString());
  };

  const handleBulkComplete = () => {
    const currentOrders = activeTab === 'live' ? orders : allTodayOrders;
    const activeOrders = currentOrders.filter(order => 
      ['PLACED', 'IN_PREP', 'READY', 'SERVING', 'SERVED', 'COMPLETED'].includes(order.order_status)
    );
    bulkCompleteAllOrders(activeOrders, () => {
      window.location.reload();
    });
  };

  const getDisplayCount = (key: 'live' | 'all' | 'history') => {
    const rpc = key === 'live' ? tabCounts?.live_count : key === 'all' ? tabCounts?.earlier_today_count : tabCounts?.history_count;
    return typeof rpc === 'number' ? rpc : 0;
  };

  const renderOrderCard = (order: any, showActions: boolean = true) => {
    const legacyOrder = {
      ...order,
      table_number: order.table_number,
      customer_name: order.customer_name || '',
      customer_phone: order.customer_phone || undefined,
      customer_email: order.customer_email || undefined,
    };
    const orderForCard = mapOrderToCardData(legacyOrder, 'GBP');
    
    return (
      <OrderCard
        key={order.id}
        order={orderForCard}
        variant="auto"
        venueId={venueId}
        showActions={showActions}
        onActionComplete={() => refetchCounts()}
      />
    );
  };

  const renderOrdersSection = (ordersToRender: any[], title: string, iconColor: string) => {
    const filteredOrders = ordersToRender.filter(order => 
      !parsedTableFilter || order.table_number?.toString() === parsedTableFilter
    );

    if (filteredOrders.length === 0) return null;

    return (
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full bg-${iconColor}-500`}></span>
          {title} ({filteredOrders.length})
        </h3>
        <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
          {filteredOrders.map((order) => renderOrderCard(order, true))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-800">Loading orders...</div>
          </div>
        </div>
      </div>
    );
  }

  const counts = {
    live: getDisplayCount('live'),
    earlier: getDisplayCount('all'),
    history: getDisplayCount('history')
  };

  return (
    <div className="w-full">
      <section className="flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-6">
        <StatusHeader
          autoRefreshEnabled={autoRefreshEnabled}
          refreshInterval={refreshInterval}
          onToggleAutoRefresh={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
          onChangeRefreshInterval={(interval) => setRefreshInterval(interval * 1000)}
          tableFilter={parsedTableFilter}
          venueId={venueId}
        />

        <OrderTabs
          activeTab={activeTab}
          onTabChange={handleTabChange}
          counts={counts}
        />

        {activeTab === 'live' && (
          <div className="flex justify-center">
            <div className="hidden md:flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm text-white ring-1 ring-rose-100">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              <span>Live Orders – recent orders (including completed orders)</span>
            </div>
          </div>
        )}
      </section>

      <main className="mt-4 space-y-6 pb-20">
        {activeTab === 'live' && (
          <div className="space-y-6">
            {orders.length === 0 ? (
              <EmptyState 
                title="No Live Orders"
                description="Recent orders will appear here"
              />
            ) : (
              <>
                <BulkCompleteButton
                  count={orders.filter(order => ['PLACED', 'IN_PREP', 'READY', 'SERVING', 'SERVED'].includes(order.order_status)).length}
                  isCompleting={isBulkCompleting}
                  onClick={handleBulkComplete}
                />
                
                {renderOrdersSection(
                  orders.filter(order => isCounterOrder(order)),
                  'Counter Orders',
                  'orange'
                )}
                
                {renderOrdersSection(
                  orders.filter(order => !isCounterOrder(order) && LIVE_TABLE_ORDER_STATUSES.includes(order.order_status)),
                  'Table Orders',
                  'blue'
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'all' && (
          <div className="space-y-6">
            {allTodayOrders.length === 0 ? (
              <EmptyState 
                title="No Earlier Orders Today"
                description="Orders from earlier today will appear here"
              />
            ) : (
              <>
                <BulkCompleteButton
                  count={allTodayOrders.filter(order => ['PLACED', 'IN_PREP', 'READY', 'SERVING', 'SERVED'].includes(order.order_status)).length}
                  isCompleting={isBulkCompleting}
                  onClick={handleBulkComplete}
                />
                
                {renderOrdersSection(
                  allTodayOrders.filter(order => isCounterOrder(order)),
                  'Counter Orders',
                  'orange'
                )}
                
                {renderOrdersSection(
                  allTodayOrders.filter(order => !isCounterOrder(order)),
                  'Table Orders',
                  'blue'
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-6">
            {Object.keys(groupedHistoryOrders).length === 0 ? (
              <EmptyState 
                title="No Historical Orders"
                description="Previous orders will appear here"
              />
            ) : (
              Object.entries(groupedHistoryOrders).map(([date, ordersForDate]) => (
                <div key={date} className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-semibold text-gray-900">{date}</h3>
                    <span className="bg-slate-100 text-gray-700 text-xs px-2 py-1 rounded-full">{ordersForDate.length} orders</span>
                  </div>
                  
                  {renderOrdersSection(
                    ordersForDate.filter(order => isCounterOrder(order)),
                    'Counter Orders',
                    'orange'
                  )}
                  
                  {renderOrdersSection(
                    ordersForDate.filter(order => !isCounterOrder(order)),
                    'Table Orders',
                    'blue'
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </main>
      
      <MobileNav 
        venueId={venueId}
        venueName={venueName}
        counts={{
          live_orders: counts.live,
          total_orders: counts.earlier,
          notifications: 0
        }}
      />
    </div>
  );
}
