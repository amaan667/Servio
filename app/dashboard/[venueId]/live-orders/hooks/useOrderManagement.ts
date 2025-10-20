import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { todayWindowForTZ } from "@/lib/time";
import { Order } from "../types";

const LIVE_ORDER_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
const LIVE_WINDOW_STATUSES = ['PLACED', 'IN_PREP', 'READY', 'SERVING', 'SERVED', 'COMPLETED'];

export function useOrderManagement(venueId: string) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [allTodayOrders, setAllTodayOrders] = useState<Order[]>([]);
  const [historyOrders, setHistoryOrders] = useState<Order[]>([]);
  const [groupedHistoryOrders, setGroupedHistoryOrders] = useState<Record<string, Order[]>>({});
  const [loading, setLoading] = useState(true);
  const [todayWindow, setTodayWindow] = useState<{ startUtcISO: string; endUtcISO: string } | null>(null);

  useEffect(() => {
    const loadOrders = async () => {
      const window = todayWindowForTZ('Europe/London');
      if (window.startUtcISO && window.endUtcISO) {
        setTodayWindow({
          startUtcISO: window.startUtcISO,
          endUtcISO: window.endUtcISO
        });
      }

      const liveOrdersCutoff = new Date(Date.now() - LIVE_ORDER_WINDOW_MS).toISOString();
      
      const { data: liveData, error: liveError } = await createClient()
        .from('orders')
        .select('*')
        .eq('venue_id', venueId)
        .in('order_status', LIVE_WINDOW_STATUSES)
        .gte('created_at', window.startUtcISO)
        .lt('created_at', window.endUtcISO)
        .gte('created_at', liveOrdersCutoff)
        .order('created_at', { ascending: false });

      const { data: allData, error: allError } = await createClient()
        .from('orders')
        .select('*')
        .eq('venue_id', venueId)
        .gte('created_at', window.startUtcISO)
        .lt('created_at', liveOrdersCutoff)
        .order('created_at', { ascending: false });

      const { data: historyData, error: historyError } = await createClient()
        .from('orders')
        .select('*')
        .eq('venue_id', venueId)
        .lt('created_at', window.startUtcISO)
        .order('created_at', { ascending: false })
        .limit(100);

      if (!liveError && liveData) {
        setOrders(liveData as Order[]);
      }
      
      if (!allError && allData) {
        const liveOrderIds = new Set((liveData || []).map((order: any) => order.id));
        const allTodayFiltered = allData.filter((order: any) => !liveOrderIds.has(order.id));
        setAllTodayOrders(allTodayFiltered as Order[]);
      }
      
      if (!historyError && historyData) {
        const processedHistory = (historyData as Order[]).map((order: Order) => ({
          ...order,
          payment_status: 'PAID',
          order_status: 'COMPLETED' as const
        }));
        
        setHistoryOrders(processedHistory);
        
        const grouped = processedHistory.reduce((acc: Record<string, Order[]>, order) => {
          const date = new Date(order.created_at).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          });
          if (!acc[date]) acc[date] = [];
          acc[date].push(order);
          return acc;
        }, {});
        setGroupedHistoryOrders(grouped);
      }

      setLoading(false);
    };

    loadOrders();

    // Set up real-time subscription
    const channel = createClient()
      .channel('orders')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'orders',
          filter: `venue_id=eq.${venueId}`
        }, 
        (payload: any) => {
          const newOrder = payload.new as Order;
          const oldOrder = payload.old as Order;
          
          if (payload.eventType === 'INSERT') {
            handleOrderInsert(newOrder);
          } else if (payload.eventType === 'UPDATE') {
            handleOrderUpdate(newOrder);
          } else if (payload.eventType === 'DELETE') {
            handleOrderDelete(oldOrder);
          }
        }
      )
      .subscribe();

    return () => {
      createClient().removeChannel(channel);
    };
  }, [venueId]);

  const handleOrderInsert = (order: Order) => {
    const isLiveOrder = LIVE_WINDOW_STATUSES.includes(order.order_status);
    const orderCreatedAt = new Date(order.created_at);
    const isRecentOrder = orderCreatedAt > new Date(Date.now() - LIVE_ORDER_WINDOW_MS);
    
    if (isLiveOrder && isRecentOrder) {
      setOrders(prev => [order, ...prev]);
    }
    
    const isInTodayWindow = orderCreatedAt && todayWindow && 
      orderCreatedAt >= new Date(todayWindow.startUtcISO) && 
      orderCreatedAt < new Date(todayWindow.endUtcISO);
    
    if (isInTodayWindow && !(isLiveOrder && isRecentOrder)) {
      setAllTodayOrders(prev => [order, ...prev]);
    } else if (!isInTodayWindow) {
      const processedOrder = {
        ...order,
        payment_status: 'PAID',
        order_status: 'COMPLETED' as const
      };
      setHistoryOrders(prev => [processedOrder, ...prev]);
      
      const date = new Date(order.created_at).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
      setGroupedHistoryOrders(prev => ({
        ...prev,
        [date]: [processedOrder, ...(prev[date] || [])]
      }));
    }
  };

  const handleOrderUpdate = (order: Order) => {
    const isLiveOrder = LIVE_WINDOW_STATUSES.includes(order.order_status);
    const orderCreatedAt = new Date(order.created_at);
    const isRecentOrder = orderCreatedAt > new Date(Date.now() - LIVE_ORDER_WINDOW_MS);
    
    if (isLiveOrder && isRecentOrder) {
      setOrders(prev => {
        const exists = prev.find(o => o.id === order.id);
        if (!exists) return [order, ...prev];
        return prev.map(o => o.id === order.id ? order : o);
      });
      setAllTodayOrders(prev => prev.filter(o => o.id !== order.id));
    } else {
      setOrders(prev => prev.filter(o => o.id !== order.id));
      
      if (todayWindow && orderCreatedAt >= new Date(todayWindow.startUtcISO) && orderCreatedAt < new Date(todayWindow.endUtcISO)) {
        setAllTodayOrders(prev => {
          const exists = prev.find(o => o.id === order.id);
          if (!exists) return [order, ...prev];
          return prev.map(o => o.id === order.id ? order : o);
        });
      }
    }
    
    setHistoryOrders(prev => prev.map(o => o.id === order.id ? order : o));
  };

  const handleOrderDelete = (order: Order) => {
    setOrders(prev => prev.filter(o => o.id !== order.id));
    setAllTodayOrders(prev => prev.filter(o => o.id !== order.id));
    setHistoryOrders(prev => prev.filter(o => o.id !== order.id));
  };

  return {
    orders,
    allTodayOrders,
    historyOrders,
    groupedHistoryOrders,
    loading,
    todayWindow,
    setOrders,
    setAllTodayOrders
  };
}

