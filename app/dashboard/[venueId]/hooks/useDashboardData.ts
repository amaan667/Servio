import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { withSupabaseRetry } from '@/lib/retry';
import { todayWindowForTZ } from '@/lib/time';

export interface DashboardCounts {
  live_count: number;
  earlier_today_count: number;
  history_count: number;
  today_orders_count: number;
  active_tables_count: number;
  tables_set_up: number;
  tables_in_use: number;
  tables_reserved_now: number;
}

export interface DashboardStats {
  revenue: number;
  menuItems: number;
  unpaid: number;
}

export function useDashboardData(venueId: string, venueTz: string, initialVenue: unknown, initialCounts?: DashboardCounts, initialStats?: DashboardStats) {
  console.log('[useDashboardData] Hook called with:', { venueId, venueTz, hasInitialVenue: !!initialVenue, hasInitialCounts: !!initialCounts, hasInitialStats: !!initialStats });
  
  const [venue, setVenue] = useState<unknown>(initialVenue);
  const [loading, setLoading] = useState(!initialVenue);
  const [counts, setCounts] = useState<DashboardCounts>(initialCounts || {
    live_count: 0,
    earlier_today_count: 0,
    history_count: 0,
    today_orders_count: 0,
    active_tables_count: 0,
    tables_set_up: 0,
    tables_in_use: 0,
    tables_reserved_now: 0
  });
  const [stats, setStats] = useState<DashboardStats>(initialStats || { revenue: 0, menuItems: 0, unpaid: 0 });
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [todayWindow, setTodayWindow] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  console.log('[useDashboardData] Initial state:', { loading, hasVenue: !!venue, hasTodayWindow: !!todayWindow, hasError: !!error });

  const loadStats = useCallback(async (venueId: string, window: unknown) => {
    try {
      const supabase = createClient();
      
      const { data: orders } = await supabase
        .from('orders')
        .select('total_amount, order_status')
        .eq('venue_id', venueId)
        .gte('created_at', window.startUtcISO)
        .lt('created_at', window.endUtcISO)
        .neq('order_status', 'CANCELLED');

      const { data: menuItems } = await supabase
        .from('menu_items')
        .select('id')
        .eq('venue_id', venueId)
        .eq('is_available', true);

      const revenue = orders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
      const unpaid = orders?.filter((o: unknown) => o.order_status === 'UNPAID').length || 0;

      setStats({
        revenue,
        menuItems: menuItems?.length || 0,
        unpaid
      });
      setStatsLoaded(true);
    } catch (err) {
      console.error('[DASHBOARD] Error loading stats:', err);
    }
  }, []);

  const refreshCounts = useCallback(async () => {
    try {
      setError(null);
      const supabase = createClient();
      
      const { data: newCounts, error } = await withSupabaseRetry(
        () => supabase.rpc('dashboard_counts', { 
          p_venue_id: venueId, 
          p_tz: venueTz, 
          p_live_window_mins: 30 
        }).single()
      );
      
      if (error) {
        console.warn('[DASHBOARD] Failed to refresh counts:', error);
        setError('Failed to refresh dashboard data');
        return;
      }

      const { data: tableCounters } = await withSupabaseRetry(
        () => supabase.rpc('api_table_counters', {
          p_venue_id: venueId
        })
      );

      if (newCounts && typeof newCounts === 'object') {
        const counts = newCounts as DashboardCounts;
        
        if (tableCounters && Array.isArray(tableCounters) && tableCounters.length > 0) {
          const tableCounter = tableCounters[0] as unknown;
          setCounts({
            ...counts,
            tables_set_up: tableCounter.tables_set_up || 0,
            tables_in_use: tableCounter.tables_in_use || 0,
            tables_reserved_now: tableCounter.tables_reserved_now || 0,
            active_tables_count: tableCounter.active_tables_count || 0
          });
        } else {
          setCounts(counts);
        }
      }
    } catch (err) {
      console.error('[DASHBOARD] Error refreshing counts:', err);
      setError('Failed to refresh dashboard data');
    }
  }, [venueId, venueTz]);

  const updateRevenueIncrementally = useCallback((order: unknown) => {
    if (order.order_status !== 'CANCELLED' && order.total_amount) {
      setStats(prev => ({
        ...prev,
        revenue: prev.revenue + order.total_amount
      }));
    }
  }, []);

  useEffect(() => {
    console.log('[useDashboardData] useEffect triggered:', { hasVenue: !!venue, loading, venueTz, statsLoaded });
    
    const loadVenueAndStats = async () => {
      try {
        if (venue && !loading) {
          console.log('[useDashboardData] Loading venue and stats...');
          const window = todayWindowForTZ(venueTz);
          console.log('[useDashboardData] Today window:', window);
          setTodayWindow(window);
          
          if (!statsLoaded) {
            console.log('[useDashboardData] Loading stats...');
            await loadStats(venue.venue_id, window);
          }
        } else {
          console.log('[useDashboardData] Skipping load - venue:', !!venue, 'loading:', loading);
        }
      } catch (err) {
        console.error('[useDashboardData] Error loading venue and stats:', err);
        setError('Failed to load dashboard data');
      } finally {
        console.log('[useDashboardData] Setting loading to false');
        setLoading(false);
      }
    };

    loadVenueAndStats();
  }, [venue, loading, venueTz, statsLoaded, loadStats]);

  return {
    venue,
    setVenue,
    loading,
    setLoading,
    counts,
    setCounts,
    stats,
    setStats,
    todayWindow,
    error,
    setError,
    refreshCounts,
    loadStats,
    updateRevenueIncrementally
  };
}

