import { useEffect } from 'react';
import { supabaseBrowser } from '@/lib/supabase';

interface UseDashboardRealtimeProps {
  venueId: string;
  todayWindow: unknown;
  refreshCounts: () => Promise<void>;
  loadStats: (venueId: string, window: unknown) => Promise<void>;
  updateRevenueIncrementally: (order: Record<string, unknown>) => void;
  venue: unknown;
}

export function useDashboardRealtime({
  venueId,
  todayWindow,
  refreshCounts,
  loadStats,
  updateRevenueIncrementally,
  venue
}: UseDashboardRealtimeProps) {
  useEffect(() => {
    if (!venue?.venue_id || !todayWindow?.startUtcISO) {
      return;
    }

    const supabase = supabaseBrowser();
    
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'orders',
          filter: `venue_id=eq.${venueId}`
        }, 
        async (payload: unknown) => {

          const orderCreatedAt = (payload.new as unknown)?.created_at || (payload.old as unknown)?.created_at;
          if (!orderCreatedAt) {
            return;
          }
          
          const isInTodayWindow = orderCreatedAt >= todayWindow.startUtcISO && orderCreatedAt < todayWindow.endUtcISO;
          
          if (isInTodayWindow) {

            await refreshCounts();
            
            if (payload.eventType === 'INSERT' && payload.new) {
              updateRevenueIncrementally(payload.new);
            } else if (payload.eventType === 'UPDATE' && payload.new) {
              if (payload.new.order_status === 'CANCELLED' || payload.new.order_status === 'REFUNDED') {
                await loadStats(venue.venue_id, todayWindow);
              }
            }
          }
        }
      )
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tables',
          filter: `venue_id=eq.${venueId}`
        },
        async (payload: unknown) => {

          await refreshCounts();
        }
      )
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'table_sessions',
          filter: `venue_id=eq.${venueId}`
        },
        async (payload: unknown) => {

          await refreshCounts();
        }
      )
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'menu_items',
          filter: `venue_id=eq.${venueId}`
        },
        async (payload: unknown) => {

          try {
            const { data: menuItems } = await supabase
              .from("menu_items")
              .select("id")
              .eq("venue_id", venueId)
              .eq("is_available", true);
            
            // Update menu items count in parent component
            // This will be handled by the parent component
          } catch (error) {

          }
        }
      )
      .subscribe((status: string) => {

        if (status === 'SUBSCRIBED') {

        } else if (status === 'CHANNEL_ERROR') {

        } else if (status === 'TIMED_OUT') {

        }
      });

    const handleOrderCreated = (event: CustomEvent) => {
      if (event.detail.venueId === venueId) {

        refreshCounts();
        if (event.detail.order) {
          updateRevenueIncrementally(event.detail.order);
        }
      }
    };

    window.addEventListener('orderCreated', handleOrderCreated as EventListener);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('orderCreated', handleOrderCreated as EventListener);
    };
  }, [venueId, venue?.venue_id, todayWindow?.startUtcISO, refreshCounts, loadStats, updateRevenueIncrementally]);
}

