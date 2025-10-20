/**
 * Hook to fetch live analytics data for dashboard charts
 */

import { useEffect, useState, useCallback } from 'react';
import { supabaseBrowser } from '@/lib/supabase';

interface AnalyticsData {
  ordersByHour: Array<{ hour: string; orders: number }>;
  revenueByCategory: Array<{ name: string; value: number; color: string }>;
  topSellingItems: Array<{ name: string; price: number; count: number }>;
  yesterdayComparison: {
    orders: number;
    revenue: number;
  };
}

const COLORS = ['#5B21B6', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

export function useAnalyticsData(venueId: string, venueTz: string) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const supabase = supabaseBrowser();
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
      const yesterdayEnd = todayStart;

      // Fetch today's orders
      const { data: todayOrders, error: ordersError } = await supabase
        .from('orders')
        .select('created_at, items, total_amount')
        .eq('venue_id', venueId)
        .gte('created_at', todayStart.toISOString())
        .order('created_at', { ascending: true });

      if (ordersError) throw ordersError;

      // Fetch yesterday's orders for comparison
      const { data: yesterdayOrders } = await supabase
        .from('orders')
        .select('created_at, total_amount')
        .eq('venue_id', venueId)
        .gte('created_at', yesterdayStart.toISOString())
        .lt('created_at', yesterdayEnd.toISOString());

      // Aggregate orders by hour
      const hourlyOrders: { [key: number]: number } = {};
      for (let i = 0; i < 24; i++) {
        hourlyOrders[i] = 0;
      }

      (todayOrders || []).forEach((order: unknown) => {
        const hour = new Date(order.created_at).getHours();
        hourlyOrders[hour]++;
      });

      const ordersByHour = Object.entries(hourlyOrders).map(([hour, orders]) => ({
        hour: `${hour}:00`,
        orders,
      }));

      // Calculate revenue by category from order items
      const categoryRevenue: { [key: string]: number } = {};
      (todayOrders || []).forEach((order: unknown) => {
        if (Array.isArray(order.items)) {
          order.items.forEach((item: unknown) => {
            const category = item.category || 'Other';
            const price = parseFloat(item.unit_price || item.price || 0);
            const qty = parseInt(item.quantity || item.qty || 1);
            categoryRevenue[category] = (categoryRevenue[category] || 0) + price * qty;
          });
        }
      });

      const revenueByCategory = Object.entries(categoryRevenue)
        .map(([name, value], index) => ({
          name,
          value,
          color: COLORS[index % COLORS.length],
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);

      // Get top selling items
      const itemCounts: { [key: string]: { name: string; price: number; count: number } } = {};
      (todayOrders || []).forEach((order: unknown) => {
        if (Array.isArray(order.items)) {
          order.items.forEach((item: unknown) => {
            const name = item.name || 'Unknown';
            const price = parseFloat(item.unit_price || item.price || 0);
            if (!itemCounts[name]) {
              itemCounts[name] = { name, price, count: 0 };
            }
            itemCounts[name].count += parseInt(item.quantity || item.qty || 1);
          });
        }
      });

      const topSellingItems = Object.values(itemCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Calculate yesterday comparison
      const yesterdayOrdersCount = yesterdayOrders?.length || 0;
      const yesterdayRevenue = (yesterdayOrders || []).reduce((sum, order) => {
        return sum + (parseFloat(order.total_amount) || 0);
      }, 0);

      setData({
        ordersByHour,
        revenueByCategory,
        topSellingItems,
        yesterdayComparison: {
          orders: yesterdayOrdersCount,
          revenue: yesterdayRevenue,
        },
      });
    } catch (err) {
      console.error('[ANALYTICS] Error fetching analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  }, [venueId, venueTz]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return { data, loading, error, refetch: fetchAnalytics };
}

