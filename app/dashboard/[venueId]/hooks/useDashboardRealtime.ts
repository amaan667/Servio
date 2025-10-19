import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface UseDashboardRealtimeProps {
  venueId: string;
  todayWindow: any;
  refreshCounts: () => Promise<void>;
  loadStats: (venueId: string, window: any) => Promise<void>;
  updateRevenueIncrementally: (order: any) => void;
  venue: any;
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

    const supabase = createClient();
    
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'orders',
          filter: `venue_id=eq.${venueId}`
        }, 
        async (payload: any) => {
          console.debug('[DASHBOARD] Order update received:', payload.eventType, payload.new?.id);
          
          const orderCreatedAt = (payload.new as any)?.created_at || (payload.old as any)?.created_at;
          if (!orderCreatedAt) {
            return;
          }
          
          const isInTodayWindow = orderCreatedAt >= todayWindow.startUtcISO && orderCreatedAt < todayWindow.endUtcISO;
          
          if (isInTodayWindow) {
            console.debug('[DASHBOARD] Refreshing counts due to order change');
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
        async (payload: any) => {
          console.debug('[DASHBOARD] Table update received:', payload.eventType);
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
        async (payload: any) => {
          console.debug('[DASHBOARD] Table session update received:', payload.eventType);
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
        async (payload: any) => {
          console.debug('[DASHBOARD] Menu item update received:', payload.eventType);
          try {
            const { data: menuItems } = await supabase
              .from("menu_items")
              .select("id")
              .eq("venue_id", venueId)
              .eq("is_available", true);
            
            // Update menu items count in parent component
            // This will be handled by the parent component
          } catch (error) {
            console.error('[DASHBOARD] Error updating menu items count:', error);
          }
        }
      )
      .subscribe((status: string) => {
        console.debug('[DASHBOARD] Realtime subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.debug('[DASHBOARD] ✓ Successfully subscribed to realtime updates');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[DASHBOARD] ✗ Realtime subscription error - falling back to polling');
        } else if (status === 'TIMED_OUT') {
          console.error('[DASHBOARD] ✗ Realtime subscription timed out');
        }
      });

    const handleOrderCreated = (event: CustomEvent) => {
      if (event.detail.venueId === venueId) {
        console.debug('[DASHBOARD] Custom order created event received');
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
  }, [venueId, venueTz, venue?.venue_id, todayWindow?.startUtcISO, refreshCounts, loadStats, updateRevenueIncrementally]);
}

